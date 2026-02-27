import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FollowupStatus } from '@prisma/client';

const FOLLOWUP_TEXTS: Record<number, string> = {
  1: 'Подскажите, актуально ли вам сейчас увеличить поток заявок через автообзвоны?',
  2: 'Могу рассказать, какие ниши сейчас лучше всего заходят и какие цифры по конверсии.',
  3: 'Не буду отвлекать. Когда тема автообзвонов снова станет актуальной — просто напишите "актуально".',
};

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scheduleFollowup(leadSessionId: string, step: 1 | 2 | 3, dueAt: Date) {
    return this.prisma.followup.create({
      data: {
        leadSessionId,
        step,
        templateVariant: 'A',
        dueAt,
        status: FollowupStatus.SCHEDULED,
      },
    });
  }

  async cancelForSession(leadSessionId: string, reason: string) {
    await this.prisma.followup.updateMany({
      where: { leadSessionId, status: FollowupStatus.SCHEDULED },
      data: { status: FollowupStatus.CANCELLED, cancelReason: reason },
    });
  }

  async processDue() {
    const now = new Date();
    const due = await this.prisma.followup.findMany({
      where: { status: FollowupStatus.SCHEDULED, dueAt: { lte: now } },
      include: { leadSession: true },
    });

    for (const f of due) {
      try {
        const text = FOLLOWUP_TEXTS[f.step] ?? FOLLOWUP_TEXTS[1];
        const msg = await this.prisma.message.create({
          data: {
            leadSessionId: f.leadSessionId,
            direction: 'OUT',
            channel: 'WHATSAPP',
            messageType: 'text',
            text,
            status: 'SENT',
          },
        });
        await this.prisma.followup.update({
          where: { id: f.id },
          data: { status: FollowupStatus.SENT, sentAt: new Date(), messageId: msg.id },
        });
        await this.prisma.leadSession.update({
          where: { id: f.leadSessionId },
          data: {
            lastBotMessageAt: new Date(),
            status: f.step === 1 ? 'FOLLOWUP_1' : f.step === 2 ? 'FOLLOWUP_2' : 'FOLLOWUP_3',
          },
        });
      } catch (err) {
        this.logger.warn(`Followup ${f.id} failed: ${err}`);
        await this.prisma.followup.update({
          where: { id: f.id },
          data: { status: FollowupStatus.FAILED, cancelReason: String(err) },
        });
      }
    }
  }
}
