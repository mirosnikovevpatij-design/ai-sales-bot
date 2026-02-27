import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DialogModule } from '../dialog/dialog.module';
import { EscalationModule } from '../escalation/escalation.module';
import { RagModule } from '../rag/rag.module';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminEscalationController } from './controllers/admin-escalation.controller';
import { AdminManagersController } from './controllers/admin-managers.controller';
import { AdminTestController } from './controllers/admin-test.controller';
import { AdminFollowupTemplatesController } from './controllers/admin-followup-templates.controller';
import { AdminKnowledgeController } from './controllers/admin-knowledge.controller';
import { AdminPromptsController } from './controllers/admin-prompts.controller';

@Module({
  imports: [DatabaseModule, EscalationModule, DialogModule, RagModule],
  controllers: [
    AdminConfigController,
    AdminManagersController,
    AdminEscalationController,
    AdminTestController,
    AdminKnowledgeController,
    AdminPromptsController,
    AdminFollowupTemplatesController,
  ],
})
export class AdminModule {}

