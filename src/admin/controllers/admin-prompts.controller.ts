import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { DEFAULT_INIT_MESSAGE, INIT_MESSAGE_KEY } from '../../constants/prompt-defaults';
import { DEFAULT_SYSTEM_PROMPT } from '../../dialog/dialog.service';
import { PrismaService } from '../../database/prisma.service';

const MAIN_PROMPT_KEY = 'dialog_system';
const FUNNEL_STEPS_CONFIG_KEY = 'funnel_steps';
const PROMPT_RULES_CONFIG_KEY = 'prompt_rules';

const ALL_STEP_KEYS = ['ENGAGED', 'QUALIFYING', 'PRESENTING', 'SCHEDULING_ZOOM', 'ZOOM_BOOKED'] as const;

const DEFAULT_FUNNEL_STEPS: { step: string; label: string; description: string; phrases: { text: string; fixed: boolean }[] }[] = [
  { step: 'ENGAGED', label: 'Вовлечение', description: 'Первый контакт с лидом, установление диалога.', phrases: [] },
  { step: 'QUALIFYING', label: 'Квалификация', description: 'Уточнение ниши, цели, объёма базы, географии.', phrases: [] },
  { step: 'PRESENTING', label: 'Презентация', description: 'Рассказ о продукте/услуге и выгодах.', phrases: [] },
  { step: 'SCHEDULING_ZOOM', label: 'Приглашение на Zoom', description: 'Предложение встречи в Zoom, выбор даты и времени.', phrases: [] },
  { step: 'ZOOM_BOOKED', label: 'Zoom забронирован', description: 'Встреча подтверждена, ожидание звонка.', phrases: [] },
];

const DEFAULT_RULES = {
  refusals: '',
  negativity: '',
  outOfScope: '',
  custom: '',
};

@Controller('admin/prompts')
export class AdminPromptsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Текущий основной промпт бота (один блок, редактирование в админке). */
  @Get('main')
  async getMain() {
    try {
      const row = await this.prisma.prompt.findFirst({
        where: { key: MAIN_PROMPT_KEY, isActive: true },
        orderBy: { version: 'desc' },
      });
      return { content: row?.content?.trim() ?? DEFAULT_SYSTEM_PROMPT };
    } catch {
      return { content: '' };
    }
  }

  /** Сохранить основной промпт (новая версия, делается активной). */
  @Put('main')
  async putMain(@Body() body: { content?: string }) {
    const content = typeof body?.content === 'string' ? body.content : '';
    const latest = await this.prisma.prompt.findFirst({
      where: { key: MAIN_PROMPT_KEY },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await this.prisma.prompt.create({
      data: {
        key: MAIN_PROMPT_KEY,
        version,
        content,
        isActive: true,
      },
    });
    await this.prisma.prompt.updateMany({
      where: { key: MAIN_PROMPT_KEY, id: { not: created.id } },
      data: { isActive: false },
    });
    return { content: created.content };
  }

  /** Текущее приветственное сообщение (отправляется лиду после нажатия кнопки на автозвоне). */
  @Get('init-message')
  async getInitMessage() {
    try {
      const row = await this.prisma.prompt.findFirst({
        where: { key: INIT_MESSAGE_KEY, isActive: true },
        orderBy: { version: 'desc' },
      });
      return { content: row?.content?.trim() ?? DEFAULT_INIT_MESSAGE };
    } catch {
      return { content: DEFAULT_INIT_MESSAGE };
    }
  }

  /** Сохранить приветственное сообщение. */
  @Put('init-message')
  async putInitMessage(@Body() body: { content?: string }) {
    const content = typeof body?.content === 'string' ? body.content : '';
    const latest = await this.prisma.prompt.findFirst({
      where: { key: INIT_MESSAGE_KEY },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await this.prisma.prompt.create({
      data: {
        key: INIT_MESSAGE_KEY,
        version,
        content: content || DEFAULT_INIT_MESSAGE,
        isActive: true,
      },
    });
    await this.prisma.prompt.updateMany({
      where: { key: INIT_MESSAGE_KEY, id: { not: created.id } },
      data: { isActive: false },
    });
    return { content: created.content };
  }

  /** Список шагов воронки (название, описание, фразы с флагом «зафиксировать»). */
  @Get('funnel-steps')
  async getFunnelSteps() {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: FUNNEL_STEPS_CONFIG_KEY },
      });
      const value = row?.value;
      if (Array.isArray(value) && value.length > 0) {
        const steps = value
          .filter((s) => s && typeof s === 'object' && typeof (s as any).step === 'string')
          .map((s) => ({
            step: String((s as any).step),
            label: typeof (s as any).label === 'string' ? (s as any).label : '',
            description: typeof (s as any).description === 'string' ? (s as any).description : '',
            phrases: Array.isArray((s as any).phrases)
              ? (s as any).phrases
                  .filter((p: any) => p && typeof p === 'object')
                  .map((p: any) => ({
                    text: typeof p.text === 'string' ? p.text : '',
                    fixed: !!p.fixed,
                  }))
              : [],
          }));
        if (steps.length) return { steps, allStepKeys: ALL_STEP_KEYS };
      }
    } catch {}
    return { steps: DEFAULT_FUNNEL_STEPS, allStepKeys: ALL_STEP_KEYS };
  }

  /** Сохранить шаги воронки (порядок, названия, описания, фразы). Ключи step — из фиксированного набора. */
  @Put('funnel-steps')
  async putFunnelSteps(
    @Body()
    body: {
      steps?: Array<{
        step: string;
        label?: string;
        description?: string;
        phrases?: Array<{ text: string; fixed?: boolean }>;
      }>;
    },
  ) {
    const input = Array.isArray(body?.steps) ? body.steps : [];
    const steps = input
      .filter((s) => s && ALL_STEP_KEYS.includes(s.step as any))
      .map((s) => {
        const def = DEFAULT_FUNNEL_STEPS.find((d) => d.step === s.step);
        const phrases = Array.isArray(s.phrases)
          ? s.phrases.map((p) => ({
              text: typeof p?.text === 'string' ? p.text.trim() : '',
              fixed: !!p?.fixed,
            }))
          : [];
        return {
          step: s.step,
          label: typeof s.label === 'string' ? s.label.trim() || def?.label || '' : def?.label || '',
          description: typeof s.description === 'string' ? s.description.trim() || def?.description || '' : def?.description || '',
          phrases,
        };
      });
    const unique = steps.filter((s, i) => steps.findIndex((x) => x.step === s.step) === i);
    await this.prisma.systemConfig.upsert({
      where: { key: FUNNEL_STEPS_CONFIG_KEY },
      create: { key: FUNNEL_STEPS_CONFIG_KEY, value: unique as any },
      update: { value: unique as any },
    });
    return { steps: unique, allStepKeys: ALL_STEP_KEYS };
  }

  /** Правила и безопасность (приоритет над воронкой в промпте). */
  @Get('rules')
  async getRules() {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: PROMPT_RULES_CONFIG_KEY },
      });
      const v = row?.value as any;
      if (v && typeof v === 'object') {
        return {
          refusals: typeof v.refusals === 'string' ? v.refusals : DEFAULT_RULES.refusals,
          negativity: typeof v.negativity === 'string' ? v.negativity : DEFAULT_RULES.negativity,
          outOfScope: typeof v.outOfScope === 'string' ? v.outOfScope : DEFAULT_RULES.outOfScope,
          custom: typeof v.custom === 'string' ? v.custom : DEFAULT_RULES.custom,
        };
      }
    } catch {}
    return { ...DEFAULT_RULES };
  }

  @Put('rules')
  async putRules(
    @Body() body: { refusals?: string; negativity?: string; outOfScope?: string; custom?: string },
  ) {
    const refusals = typeof body?.refusals === 'string' ? body.refusals.trim() : '';
    const negativity = typeof body?.negativity === 'string' ? body.negativity.trim() : '';
    const outOfScope = typeof body?.outOfScope === 'string' ? body.outOfScope.trim() : '';
    const custom = typeof body?.custom === 'string' ? body.custom.trim() : '';
    await this.prisma.systemConfig.upsert({
      where: { key: PROMPT_RULES_CONFIG_KEY },
      create: { key: PROMPT_RULES_CONFIG_KEY, value: { refusals, negativity, outOfScope, custom } as any },
      update: { value: { refusals, negativity, outOfScope, custom } as any },
    });
    return { refusals, negativity, outOfScope, custom };
  }

  @Get()
  async list() {
    try {
      const prompts = await this.prisma.prompt.findMany({
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
      });
      const byKey: Record<string, typeof prompts> = {};
      for (const p of prompts) {
        if (!byKey[p.key]) byKey[p.key] = [];
        byKey[p.key].push(p);
      }
      return Object.entries(byKey).map(([key, versions]) => ({
        key,
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          isActive: v.isActive,
          isAbTest: v.isAbTest,
          abTrafficPercent: v.abTrafficPercent,
          content: v.content,
          variablesDesc: v.variablesDesc,
          createdAt: v.createdAt,
        })),
      }));
    } catch {
      return [];
    }
  }

  @Get('key/:key')
  async getByKey(@Param('key') key: string) {
    const versions = await this.prisma.prompt.findMany({
      where: { key },
      orderBy: { version: 'desc' },
    });
    if (!versions.length) throw new HttpException({ message: 'Prompt not found' }, 404);
    return { key, versions };
  }

  @Post()
  async create(
    @Body()
    body: {
      key: string;
      content: string;
      variablesDesc?: unknown;
      isAbTest?: boolean;
      abTrafficPercent?: number;
    },
  ) {
    const key = (body?.key ?? '').trim();
    if (!key) throw new HttpException({ message: 'key is required' }, 400);
    const content = typeof body?.content === 'string' ? body.content : '';
    const latest = await this.prisma.prompt.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const prompt = await this.prisma.prompt.create({
      data: {
        key,
        version,
        content,
        variablesDesc: (body?.variablesDesc ?? null) as any,
        isActive: !latest,
        isAbTest: body?.isAbTest ?? false,
        abTrafficPercent: body?.abTrafficPercent ?? null,
      },
    });
    return prompt;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { content?: string; variablesDesc?: unknown },
  ) {
    const data: { content?: string; variablesDesc?: any } = {};
    if (typeof body?.content === 'string') data.content = body.content;
    if (body?.variablesDesc !== undefined) data.variablesDesc = body.variablesDesc as any;
    const prompt = await this.prisma.prompt.update({
      where: { id: parseInt(id, 10) },
      data,
    });
    return prompt;
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    const idNum = parseInt(id, 10);
    const isActive = !!body?.isActive;
    const prompt = await this.prisma.prompt.findUnique({ where: { id: idNum } });
    if (!prompt) throw new HttpException({ message: 'Prompt not found' }, 404);
    if (isActive) {
      await this.prisma.prompt.updateMany({
        where: { key: prompt.key },
        data: { isActive: false },
      });
    }
    const updated = await this.prisma.prompt.update({
      where: { id: idNum },
      data: { isActive },
    });
    return updated;
  }

  @Patch(':id/ab-test')
  async setAbTest(
    @Param('id') id: string,
    @Body() body: { isAbTest: boolean; abTrafficPercent?: number },
  ) {
    const updated = await this.prisma.prompt.update({
      where: { id: parseInt(id, 10) },
      data: {
        isAbTest: !!body?.isAbTest,
        abTrafficPercent: body?.abTrafficPercent ?? null,
      },
    });
    return updated;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.prisma.prompt.delete({ where: { id: parseInt(id, 10) } });
    return { ok: true };
  }
}
