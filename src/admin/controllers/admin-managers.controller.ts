import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/managers')
export class AdminManagersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.manager.findMany({ orderBy: { id: 'asc' } });
    return rows.map((m) => ({
      ...m,
      amoUserId: String(m.amoUserId),
      telegramId: m.telegramId != null ? String(m.telegramId) : null,
    }));
  }

  @Post()
  async create(
    @Body()
    body: {
      amoUserId: number;
      name: string;
      telegramId?: number;
      whatsappPhone?: string;
      active?: boolean;
      excludeFromRotation?: boolean;
      weight?: number;
    },
  ) {
    const row = await this.prisma.manager.create({
      data: {
        amoUserId: BigInt(body.amoUserId),
        name: body.name,
        telegramId: body.telegramId ?? null,
        whatsappPhone: body.whatsappPhone ?? null,
        active: body.active ?? true,
        excludeFromRotation: body.excludeFromRotation ?? false,
        weight: body.weight ?? 1,
      },
    });
    return {
      ...row,
      amoUserId: String(row.amoUserId),
      telegramId: row.telegramId != null ? String(row.telegramId) : null,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      telegramId?: number;
      whatsappPhone?: string;
      active?: boolean;
      excludeFromRotation?: boolean;
      weight?: number;
    },
  ) {
    const row = await this.prisma.manager.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.telegramId != null && { telegramId: body.telegramId }),
        ...(body.whatsappPhone != null && { whatsappPhone: body.whatsappPhone }),
        ...(body.active != null && { active: body.active }),
        ...(body.excludeFromRotation != null && { excludeFromRotation: body.excludeFromRotation }),
        ...(body.weight != null && { weight: body.weight }),
      },
    });
    return {
      ...row,
      amoUserId: String(row.amoUserId),
      telegramId: row.telegramId != null ? String(row.telegramId) : null,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.manager.delete({
      where: { id: parseInt(id, 10) },
    });
    return { ok: true };
  }
}
