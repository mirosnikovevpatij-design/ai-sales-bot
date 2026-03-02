import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AppConfigModule } from '../config/config.module';
import { EscalationService } from './escalation.service';
import { SlaScheduler } from './sla.scheduler';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  providers: [EscalationService, SlaScheduler],
  exports: [EscalationService],
})
export class EscalationModule {}
