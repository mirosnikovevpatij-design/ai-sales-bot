import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [DatabaseModule, LlmModule, RagModule],
  providers: [DialogService],
  exports: [DialogService],
})
export class DialogModule {}

