import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
