import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FollowupService } from './followup.service';

@Injectable()
export class FollowupScheduler {
  constructor(private readonly followupService: FollowupService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.followupService.processDue();
  }
}
