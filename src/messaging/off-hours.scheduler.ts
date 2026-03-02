import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { DialogService } from '../dialog/dialog.service';

@Injectable()
export class OffHoursScheduler {
  private readonly logger = new Logger(OffHoursScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialogService: DialogService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDue() {
    const now = new Date();
    const due = await this.prisma.offHoursQueue.findMany({
      where: { status: 'PENDING', scheduledReplyAt: { lte: now } },
    });

    for (const row of due) {
      try {
        const message = await this.prisma.message.findUnique({
          where: { id: row.messageId },
        });
        if (!message?.text) {
          await this.prisma.offHoursQueue.update({
            where: { id: row.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
          continue;
        }
        await this.dialogService.handleIncomingMessage(row.leadSessionId, message.text, {
          skipCreateInMessage: true,
        });
        await this.prisma.offHoursQueue.update({
          where: { id: row.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(`OffHoursQueue ${row.id} failed: ${err}`);
      }
    }
  }
}
