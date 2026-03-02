import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class SlaScheduler {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Cron('*/15 * * * *')
  async markOverdueHandoffs() {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() - this.appConfig.handoffSlaHours);

    const updated = await this.prisma.leadSession.updateMany({
      where: {
        status: 'HANDOFF_TO_HUMAN',
        handoffAt: { lt: deadline },
        slaNotified: false,
      },
      data: { slaNotified: true, slaNotifiedAt: new Date() },
    });

    if (updated.count > 0) {
      this.logger.warn(`SLA: отмечено просроченных handoff: ${updated.count}`);
    }
  }
}
