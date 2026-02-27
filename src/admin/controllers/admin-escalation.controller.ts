import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EscalationService } from '../../escalation/escalation.service';
import { PrismaService } from '../../database/prisma.service';

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
    return sessions;
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
}
