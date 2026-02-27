import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EscalationService } from './escalation.service';

@Module({
  imports: [DatabaseModule],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
