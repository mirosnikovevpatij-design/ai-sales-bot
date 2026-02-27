import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FollowupScheduler } from './followup.scheduler';
import { FollowupService } from './followup.service';

@Module({
  imports: [DatabaseModule],
  providers: [FollowupService, FollowupScheduler],
  exports: [FollowupService],
})
export class FollowupModule {}
