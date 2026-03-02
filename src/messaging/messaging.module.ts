import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { OffHoursScheduler } from './off-hours.scheduler';
import { DatabaseModule } from '../database/database.module';
import { DialogModule } from '../dialog/dialog.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { FollowupModule } from '../followup/followup.module';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [DatabaseModule, DialogModule, IntegrationsModule, FollowupModule, AppConfigModule],
  providers: [MessagingService, OffHoursScheduler],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}

