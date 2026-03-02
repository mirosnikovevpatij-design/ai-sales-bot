import { Injectable } from '@nestjs/common';
import { LeadSessionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';

/** Ключ системного промпта бота в таблице Prompt (редактируется в админке). */
export const DIALOG_SYSTEM_PROMPT_KEY = 'dialog_system';

/** Встроенный промпт по умолчанию (если в БД нет активной записи). */
export const DEFAULT_SYSTEM_PROMPT = `Ты — продавец отдела продаж. Цель: записать клиента на Zoom-встречу. Отвечай коротко, не более 400 символов. Один вопрос за раз. Не упоминай слова "бот", "ИИ", "автоматический". Текущий этап: {{currentStep}}.`;

/** Состояние диалога для квалификации (ТЗ: ниша, цель, объём, география). */
export interface ConversationState {
  niche?: string;
  goal?: string;
  volume?: string;
  geography?: string;
  currentStep?: string;
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

    const nextStatus = this.getNextStatus(session.status);
    const now = new Date();
    const prevState = (session.conversationStateJson as ConversationState | null) ?? {};
    const conversationStateJson: ConversationState = {
      ...prevState,
      currentStep: nextStatus,
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

    let reply: string;
    if (this.llm.isConfigured) {
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
      const basePrompt = await this.getSystemPromptTemplate(nextStatus);
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

    await this.prisma.leadSession.update({
      where: { id: leadSessionId },
      data: { lastBotMessageAt: new Date() },
    });

    return reply;
  }

  private getNextStatus(current: LeadSessionStatus): LeadSessionStatus {
    switch (current) {
      case LeadSessionStatus.PENDING_INIT:
      case LeadSessionStatus.INIT_SENT:
        return LeadSessionStatus.ENGAGED;
      case LeadSessionStatus.ENGAGED:
        return LeadSessionStatus.QUALIFYING;
      case LeadSessionStatus.QUALIFYING:
        return LeadSessionStatus.PRESENTING;
      case LeadSessionStatus.PRESENTING:
        return LeadSessionStatus.SCHEDULING_ZOOM;
      case LeadSessionStatus.SCHEDULING_ZOOM:
        return LeadSessionStatus.ZOOM_BOOKED;
      default:
        return current;
    }
  }

  private buildReply(status: LeadSessionStatus): string {
    switch (status) {
      case LeadSessionStatus.ENGAGED:
        return 'Спасибо за ответ! Давайте начнём с небольшого уточнения по вашему бизнесу.';
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

  /** Начальное сообщение для тестового чата (без записи в БД). */
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
    const basePrompt = await this.getSystemPromptTemplate(syntheticStatus);
    const systemPrompt = await this.buildSystemPromptWithRag(basePrompt, newUserText);
    if (this.llm.isConfigured) {
      const llmReply = await this.llm.generateReply(systemPrompt, userMessages);
      if (llmReply && llmReply.length > 0) return llmReply;
    }
    return this.buildReply(syntheticStatus);
  }

  /** Берёт шаблон системного промпта из БД (ключ dialog_system) или дефолт. Подставляет {{currentStep}}. */
  private async getSystemPromptTemplate(currentStep: LeadSessionStatus): Promise<string> {
    const row = await this.prisma.prompt.findFirst({
      where: { key: DIALOG_SYSTEM_PROMPT_KEY, isActive: true },
      orderBy: { version: 'desc' },
    });
    const template = row?.content?.trim() || DEFAULT_SYSTEM_PROMPT;
    return template.replace(/\{\{\s*currentStep\s*\}\}/gi, String(currentStep));
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

