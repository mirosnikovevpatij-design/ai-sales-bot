import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClientLanguage } from '@prisma/client';

const LANGUAGES: ClientLanguage[] = ['RU', 'KZ', 'SHALAKAZ', 'OTHER'];
const VARIANTS = ['A', 'B'];

@Controller('admin/followup-templates')
export class AdminFollowupTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const list = await this.prisma.followupTemplate.findMany({
      orderBy: [{ step: 'asc' }, { language: 'asc' }, { variant: 'asc' }],
    });
    return {
      templates: list,
      languages: LANGUAGES,
      variants: VARIANTS,
      steps: [1, 2, 3],
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      step: number;
      language: string;
      variant: string;
      content: string;
      isActive?: boolean;
    },
  ) {
    const step = Math.min(3, Math.max(1, Number(body?.step) || 1));
    const language = this.parseLanguage(body?.language);
    const variant = VARIANTS.includes(String(body?.variant || 'A').toUpperCase())
      ? String(body.variant).toUpperCase()
      : 'A';
    const content = (body?.content ?? '').trim();
    if (!content) throw new HttpException({ message: 'content is required' }, 400);
    const template = await this.prisma.followupTemplate.create({
      data: {
        step,
        language,
        variant,
        content,
        isActive: body?.isActive !== false,
      },
    });
    return template;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      step?: number;
      language?: string;
      variant?: string;
      content?: string;
      isActive?: boolean;
    },
  ) {
    const idNum = parseInt(id, 10);
    const data: { step?: number; language?: ClientLanguage; variant?: string; content?: string; isActive?: boolean } = {};
    if (body?.step !== undefined) data.step = Math.min(3, Math.max(1, Number(body.step) || 1));
    if (body?.language !== undefined) data.language = this.parseLanguage(body.language);
    if (body?.variant !== undefined && VARIANTS.includes(String(body.variant).toUpperCase()))
      data.variant = String(body.variant).toUpperCase();
    if (typeof body?.content === 'string') data.content = body.content.trim();
    if (body?.isActive !== undefined) data.isActive = !!body.isActive;
    const template = await this.prisma.followupTemplate.update({
      where: { id: idNum },
      data,
    });
    return template;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.prisma.followupTemplate.delete({ where: { id: parseInt(id, 10) } });
    return { ok: true };
  }

  private parseLanguage(v: unknown): ClientLanguage {
    const s = String(v ?? 'RU').toUpperCase();
    if (LANGUAGES.includes(s as ClientLanguage)) return s as ClientLanguage;
    return 'RU';
  }
}
