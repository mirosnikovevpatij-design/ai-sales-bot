import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InitQueueProcessor } from './workers/init-queue.processor';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'init_queue',
    }),
    MessagingModule,
  ],
  providers: [InitQueueProcessor],
  exports: [],
})
export class QueueModule {}

