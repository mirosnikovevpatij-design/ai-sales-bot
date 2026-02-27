import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminManagersController } from './controllers/admin-managers.controller';
import { AdminEscalationController } from './controllers/admin-escalation.controller';
import { EscalationModule } from '../escalation/escalation.module';

@Module({
  imports: [DatabaseModule, EscalationModule],
  controllers: [
    AdminConfigController,
    AdminManagersController,
    AdminEscalationController,
  ],
})
export class AdminModule {}

