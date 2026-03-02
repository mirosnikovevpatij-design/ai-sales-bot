import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ClientLanguage, FollowupStatus } from '@prisma/client';
import { AppConfigService } from '../config/config.service';

const FALLBACK_TEXTS: Record<number, string> = {
  1: 'Подскажите, актуально ли вам сейчас увеличить поток заявок через автообзвоны?',
  2: 'Могу рассказать, какие ниши сейчас лучше всего заходят и какие цифры по конверсии.',
  3: 'Не буду отвлекать. Когда тема автообзвонов снова станет актуальной — просто напишите "актуально".',
};

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Дата/время для отправки follow-up по шагу (из конфига FOLLOWUP_1_DELAY_HOURS, FOLLOWUP_2/3_DELAY_DAYS). */
  getFollowupDueAt(step: 1 | 2 | 3): Date {
    const now = new Date();
    const d = new Date(now);
    if (step === 1) {
      d.setHours(d.getHours() + this.appConfig.followup1DelayHours);
    } else if (step === 2) {
      d.setDate(d.getDate() + this.appConfig.followup2DelayDays);
    } else {
      d.setDate(d.getDate() + this.appConfig.followup3DelayDays);
    }
    return d;
  }

  /** Текст шаблона по шагу, языку сессии и варианту (A/B). */
  async getTemplateText(
    step: 1 | 2 | 3,
    language: ClientLanguage | null,
    variant: string = 'A',
  ): Promise<string> {
    const lang = language ?? 'RU';
    const v = variant === 'B' ? 'B' : 'A';
    const template = await this.prisma.followupTemplate.findFirst({
      where: { step, language: lang, variant: v, isActive: true },
    });
    if (template?.content) return template.content;
    return FALLBACK_TEXTS[step] ?? FALLBACK_TEXTS[1];
  }

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
        const text = await this.getTemplateText(
          f.step as 1 | 2 | 3,
          f.leadSession.clientLanguage,
          f.templateVariant ?? 'A',
        );
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
        if (f.step === 1) {
          await this.scheduleFollowup(f.leadSessionId, 2, this.getFollowupDueAt(2));
        } else if (f.step === 2) {
          await this.scheduleFollowup(f.leadSessionId, 3, this.getFollowupDueAt(3));
        }
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
