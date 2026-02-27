import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { EscalationService } from '../../escalation/escalation.service';
import { PrismaService } from '../../database/prisma.service';
import { LeadSessionStatus } from '@prisma/client';

@Controller('admin/lead-sessions')
export class AdminEscalationController {
  constructor(
    private readonly escalation: EscalationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    const sessions = await this.prisma.leadSession.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        phone: true,
        phoneMasked: true,
        status: true,
        amoDealId: true,
        createdAt: true,
        assignedManagerId: true,
        handoffAt: true,
      },
    });
    return sessions.map((s) => ({ ...s, amoDealId: String(s.amoDealId) }));
  }

  @Post(':id/handoff')
  async handoff(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const managerId = await this.escalation.handoff(
      id,
      body.reason ?? 'manual_from_admin',
    );
    return { ok: true, assignedManagerId: managerId };
  }

  @Delete(':id')
  async deleteSession(@Param('id') id: string) {
    await this.prisma.leadSession.delete({ where: { id } });
    return { ok: true };
  }

  @Post()
  async createSession(@Body() body: { phone: string }) {
    const phone = (body?.phone ?? '').trim();
    if (!phone) throw new Error('phone is required');
    const amoDealId = BigInt(900000000 + (Date.now() % 100000000));
    const session = await this.prisma.leadSession.create({
      data: {
        phone,
        amoDealId,
        status: LeadSessionStatus.PENDING_INIT,
      },
      select: {
        id: true,
        phone: true,
        phoneMasked: true,
        status: true,
        amoDealId: true,
        createdAt: true,
        assignedManagerId: true,
        handoffAt: true,
      },
    });
    return { ...session, amoDealId: String(session.amoDealId) };
  }
}
