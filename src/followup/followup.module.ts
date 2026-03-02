import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AppConfigModule } from '../config/config.module';
import { FollowupScheduler } from './followup.scheduler';
import { FollowupService } from './followup.service';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  providers: [FollowupService, FollowupScheduler],
  exports: [FollowupService],
})
export class FollowupModule {}
