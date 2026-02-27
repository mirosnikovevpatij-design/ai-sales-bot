import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [DatabaseModule, LlmModule],
  providers: [DialogService],
  exports: [DialogService],
})
export class DialogModule {}

