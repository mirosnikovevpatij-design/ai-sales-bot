import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DialogModule } from '../dialog/dialog.module';
import { EscalationModule } from '../escalation/escalation.module';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminEscalationController } from './controllers/admin-escalation.controller';
import { AdminManagersController } from './controllers/admin-managers.controller';
import { AdminTestController } from './controllers/admin-test.controller';

@Module({
  imports: [DatabaseModule, EscalationModule, DialogModule],
  controllers: [
    AdminConfigController,
    AdminManagersController,
    AdminEscalationController,
    AdminTestController,
  ],
})
export class AdminModule {}

