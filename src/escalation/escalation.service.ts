import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handoff(leadSessionId: string, reason: string): Promise<number | null> {
    const managers = await this.prisma.manager.findMany({
      where: { active: true, excludeFromRotation: false },
      orderBy: { currentRoundPosition: 'asc', id: 'asc' },
    });

    if (managers.length === 0) {
      this.logger.warn('No managers in rotation for handoff');
      return null;
    }

    const next = managers[0];
    const newPosition = (next.currentRoundPosition + 1) % 1000;

    await this.prisma.$transaction([
      this.prisma.manager.update({
        where: { id: next.id },
        data: { currentRoundPosition: newPosition },
      }),
      this.prisma.handoffAssignment.create({
        data: {
          leadSessionId,
          managerId: next.id,
          reason,
        },
      }),
      this.prisma.leadSession.update({
        where: { id: leadSessionId },
        data: {
          status: 'HANDOFF_TO_HUMAN',
          handoffReason: reason,
          handoffAt: new Date(),
          assignedManagerId: next.id,
        },
      }),
    ]);

    return next.id;
  }
}
