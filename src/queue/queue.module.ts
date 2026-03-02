import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InitQueueProcessor } from './workers/init-queue.processor';
import { MessagingModule } from '../messaging/messaging.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'init_queue',
    }),
    MessagingModule,
    DatabaseModule,
  ],
  providers: [InitQueueProcessor],
  exports: [],
})
export class QueueModule {}

