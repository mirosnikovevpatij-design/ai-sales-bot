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
import { DEFAULT_SYSTEM_PROMPT } from '../../dialog/dialog.service';
import { PrismaService } from '../../database/prisma.service';

const MAIN_PROMPT_KEY = 'dialog_system';

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
