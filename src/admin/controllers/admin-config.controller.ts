import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/system-config')
export class AdminConfigController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getConfigKeys() {
    const rows = await this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const map: Record<string, unknown> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  }

  @Post()
  async setKey(@Body() body: { key: string; value?: unknown }) {
    const key = (body?.key ?? '').trim();
    if (!key) throw new Error('key is required');
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: (body.value ?? null) as any },
      update: { value: (body.value ?? null) as any },
    });
    return { ok: true };
  }

  @Delete(':key')
  async deleteKey(@Param('key') key: string) {
    await this.prisma.systemConfig.delete({ where: { key } }).catch(() => {});
    return { ok: true };
  }
}

