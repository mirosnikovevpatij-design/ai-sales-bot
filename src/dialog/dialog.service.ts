import { Injectable } from '@nestjs/common';
import { LeadSessionStatus } from '@prisma/client';
import { DEFAULT_INIT_MESSAGE, INIT_MESSAGE_KEY } from '../constants/prompt-defaults';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';

/** Ключ системного промпта бота в таблице Prompt (редактируется в админке). */
export const DIALOG_SYSTEM_PROMPT_KEY = 'dialog_system';

/** Встроенный промпт по умолчанию (если в БД нет активной записи). */
export const DEFAULT_SYSTEM_PROMPT = `Ты — продавец отдела продаж. Цель: записать клиента на Zoom-встречу. Отвечай коротко, не более 400 символов. Один вопрос за раз. Не упоминай слова "бот", "ИИ", "автоматический". Текущий этап: {{currentStep}}.`;

/** Состояние диалога для квалификации и счётчика фраз в шаге. */
export interface ConversationState {
  niche?: string;
  goal?: string;
  volume?: string;
  geography?: string;
  currentStep?: string;
  /** Сколько сообщений бота отправлено в текущем шаге (для зафиксированных фраз). */
  messageCountInStep?: number;
  lastUpdatedAt?: string;
}

@Injectable()
export class DialogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
  ) {}

  async handleIncomingMessage(
    leadSessionId: string,
    text: string,
    options?: { skipCreateInMessage?: boolean },
  ): Promise<string> {
    const session = await this.prisma.leadSession.findUnique({
      where: { id: leadSessionId },
    });

    if (!session) {
      throw new Error('Lead session not found');
    }

    if (!options?.skipCreateInMessage) {
      await this.prisma.message.create({
        data: {
          leadSessionId,
          direction: 'IN',
          channel: 'WHATSAPP',
          messageType: 'text',
          text,
          status: 'DELIVERED',
        },
      });
    }

    const nextStatus = await this.getNextStatus(session.status);
    const now = new Date();
    const prevState = (session.conversationStateJson as ConversationState | null) ?? {};
    const isNewStep = prevState.currentStep !== nextStatus;
    const messageCountInStep = isNewStep ? 0 : (prevState.messageCountInStep ?? 0);
    const conversationStateJson: ConversationState = {
      ...prevState,
      currentStep: nextStatus,
      messageCountInStep,
      lastUpdatedAt: now.toISOString(),
    };

    await this.prisma.leadSession.update({
      where: { id: leadSessionId },
      data: {
        status: nextStatus,
        lastClientMessageAt: now,
        conversationStateJson: conversationStateJson as object,
      },
    });

    const stepConfig = await this.getStepConfig(nextStatus);
    const fixedPhrase = stepConfig?.phrases?.[messageCountInStep]?.fixed
      ? stepConfig.phrases[messageCountInStep].text?.trim()
      : null;

    let reply: string;
    if (fixedPhrase) {
      reply = fixedPhrase;
    } else if (this.llm.isConfigured) {
      const lastMessages = await this.prisma.message.findMany({
        where: { leadSessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const userMessages = lastMessages
        .filter((m) => m.text)
        .reverse()
        .map((m) => ({
          role: m.direction === 'IN' ? ('user' as const) : ('assistant' as const),
          content: m.text!,
        }));
      const basePrompt = await this.getSystemPromptTemplate(nextStatus, stepConfig);
      const systemPrompt = await this.buildSystemPromptWithRag(basePrompt, text);
      const llmReply = await this.llm.generateReply(systemPrompt, userMessages);
      reply = llmReply && llmReply.length > 0 ? llmReply : this.buildReply(nextStatus);
    } else {
      reply = this.buildReply(nextStatus);
    }

    await this.prisma.message.create({
      data: {
        leadSessionId,
        direction: 'OUT',
        channel: 'WHATSAPP',
        messageType: 'text',
        text: reply,
        status: 'SENT',
      },
    });

    const nextCount = messageCountInStep + 1;
    await this.prisma.leadSession.update({
      where: { id: leadSessionId },
      data: {
        lastBotMessageAt: new Date(),
        conversationStateJson: { ...conversationStateJson, messageCountInStep: nextCount } as object,
      },
    });

    return reply;
  }

  private async getOrderedSteps(): Promise<string[]> {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: 'funnel_steps' },
      });
      const value = row?.value;
      if (Array.isArray(value) && value.length > 0) {
        const keys = value
          .filter((s) => s && typeof s === 'object' && typeof (s as any).step === 'string')
          .map((s) => String((s as any).step));
        if (keys.length) return keys;
      }
    } catch {}
    return ['ENGAGED', 'QUALIFYING', 'PRESENTING', 'SCHEDULING_ZOOM', 'ZOOM_BOOKED'];
  }

  private async getStepConfig(step: LeadSessionStatus): Promise<{ label: string; description: string; phrases: { text: string; fixed: boolean }[] } | null> {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: 'funnel_steps' },
      });
      const value = row?.value;
      if (Array.isArray(value)) {
        const found = value.find((s: any) => s && s.step === step) as any;
        if (found)
          return {
            label: typeof found.label === 'string' ? found.label : '',
            description: typeof found.description === 'string' ? found.description : '',
            phrases: Array.isArray(found.phrases)
              ? found.phrases.map((p: any) => ({ text: typeof p?.text === 'string' ? p.text : '', fixed: !!p?.fixed }))
              : [],
          };
      }
    } catch {}
    return null;
  }

  private async getRules(): Promise<{ refusals: string; negativity: string; outOfScope: string; custom: string }> {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: 'prompt_rules' },
      });
      const v = row?.value as any;
      if (v && typeof v === 'object')
        return {
          refusals: typeof v.refusals === 'string' ? v.refusals : '',
          negativity: typeof v.negativity === 'string' ? v.negativity : '',
          outOfScope: typeof v.outOfScope === 'string' ? v.outOfScope : '',
          custom: typeof v.custom === 'string' ? v.custom : '',
        };
    } catch {}
    return { refusals: '', negativity: '', outOfScope: '', custom: '' };
  }

  private async getNextStatus(current: LeadSessionStatus): Promise<LeadSessionStatus> {
    const ordered = await this.getOrderedSteps();
    if (current === LeadSessionStatus.PENDING_INIT || current === LeadSessionStatus.INIT_SENT) {
      return (ordered.includes('ENGAGED') ? LeadSessionStatus.ENGAGED : (ordered[0] as LeadSessionStatus)) ?? LeadSessionStatus.ENGAGED;
    }
    const idx = ordered.indexOf(current);
    if (idx >= 0 && idx < ordered.length - 1) return ordered[idx + 1] as LeadSessionStatus;
    return current;
  }

  private buildReply(status: LeadSessionStatus): string {
    switch (status) {
      case LeadSessionStatus.ENGAGED:
        return 'Напишите, пожалуйста, как к вам обращаться и чем занимается ваша компания?';
      case LeadSessionStatus.QUALIFYING:
        return 'Записал информацию. Расскажите, пожалуйста, какой сейчас объём базы для обзвона?';
      case LeadSessionStatus.PRESENTING:
        return 'Понимаю вашу ситуацию. Расскажу коротко, как автообзвоны помогают увеличивать количество заявок.';
      case LeadSessionStatus.SCHEDULING_ZOOM:
        return 'Предлагаю созвониться в Zoom, чтобы пройтись по цифрам и кейсам. Какой день вам удобнее?';
      case LeadSessionStatus.ZOOM_BOOKED:
        return 'Отлично, встречу зафиксировали. Если нужно будет перенести — просто напишите здесь.';
      default:
        return 'Спасибо за сообщение! Это тестовый ответ бота.';
    }
  }

  /** Текст приветственного сообщения (из БД или дефолт) — для лидов и для тестового чата. */
  async getInitMessageContent(): Promise<string> {
    const row = await this.prisma.prompt.findFirst({
      where: { key: INIT_MESSAGE_KEY, isActive: true },
      orderBy: { version: 'desc' },
    });
    return (row?.content?.trim() || DEFAULT_INIT_MESSAGE) as string;
  }

  /** Начальное сообщение для тестового чата — то же приветствие, что и лидам (из БД). */
  getTestInitialMessage(): string {
    return this.buildReply(LeadSessionStatus.ENGAGED);
  }

  /**
   * Ответ бота по истории переписки — только LLM/логика, без обращения к БД лидов/сообщений.
   * Используется только в админском тестовом чате.
   */
  async generateReplyForTest(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    newUserText: string,
  ): Promise<string> {
    const userMessages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: newUserText }];
    const syntheticStatus = this.getTestSyntheticStatus(userMessages.length);
    const stepConfig = await this.getStepConfig(syntheticStatus);
    const basePrompt = await this.getSystemPromptTemplate(syntheticStatus, stepConfig);
    const systemPrompt = await this.buildSystemPromptWithRag(basePrompt, newUserText);
    if (this.llm.isConfigured) {
      const llmReply = await this.llm.generateReply(systemPrompt, userMessages);
      if (llmReply && llmReply.length > 0) return llmReply;
    }
    return this.buildReply(syntheticStatus);
  }

  /** Берёт шаблон системного промпта из БД или дефолт. Подставляет {{currentStep}}. Правила (Блок 3) — высший приоритет. */
  private async getSystemPromptTemplate(
    currentStep: LeadSessionStatus,
    stepConfig?: { label: string; description: string; phrases: { text: string; fixed: boolean }[] } | null,
  ): Promise<string> {
    const rules = await this.getRules();
    const rulesBlock = [rules.refusals, rules.negativity, rules.outOfScope, rules.custom]
      .filter(Boolean)
      .join('\n\n');
    const rulesSection = rulesBlock
      ? `\n\n---\nПравила (соблюдай в первую очередь):\n${rulesBlock}`
      : '';

    const row = await this.prisma.prompt.findFirst({
      where: { key: DIALOG_SYSTEM_PROMPT_KEY, isActive: true },
      orderBy: { version: 'desc' },
    });
    const template = row?.content?.trim() || DEFAULT_SYSTEM_PROMPT;
    const withStep = template.replace(/\{\{\s*currentStep\s*\}\}/gi, String(currentStep));
    const stepContext =
      stepConfig?.description
        ? `\n\nТекущий этап воронки: ${stepConfig.label}. Цель этапа: ${stepConfig.description}.`
        : '';
    const phrasesContext =
      stepConfig?.phrases?.length
        ? `\nВарианты фраз для этого этапа (используй по смыслу, если не отправлены дословно): ${stepConfig.phrases.map((p) => `«${p.text}»`).join('; ')}.`
        : '';
    const nameRule =
      '\n\nОбращение: если клиент назвал имя — обращайся по имени и на «вы», иначе только на «вы». Не придумывай имена. Не начинай каждое сообщение со слова «Отлично». База знаний: инструкции из блока ниже всегда соблюдай. Веди клиента по этапам воронки; при уходе от темы мягко возвращай к цели.';
    return rulesSection + withStep + stepContext + phrasesContext + nameRule;
  }

  /** Добавляет к системному промпту релевантные фрагменты из базы знаний (инструкции для бота). */
  private async buildSystemPromptWithRag(basePrompt: string, userQuery: string): Promise<string> {
    const query = (userQuery || 'общение с клиентом').trim().slice(0, 200);
    const results = await this.rag.search(query, 8);
    if (!results.length) return basePrompt;
    const chunks = results.map((r) => r.content.trim()).filter(Boolean);
    if (!chunks.length) return basePrompt;
    const knowledgeBlock = chunks.join('\n\n');
    return `${basePrompt}\n\n---\nИнструкция из базы знаний (соблюдай при ответе):\n${knowledgeBlock}`;
  }

  private getTestSyntheticStatus(messageCount: number): LeadSessionStatus {
    const steps: LeadSessionStatus[] = [
      LeadSessionStatus.ENGAGED,
      LeadSessionStatus.QUALIFYING,
      LeadSessionStatus.PRESENTING,
      LeadSessionStatus.SCHEDULING_ZOOM,
      LeadSessionStatus.ZOOM_BOOKED,
    ];
    const index = Math.min(Math.floor(messageCount / 2), steps.length - 1);
    return steps[index];
  }
}

