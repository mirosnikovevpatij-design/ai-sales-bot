import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { DatabaseModule } from '../database/database.module';
import { DialogModule } from '../dialog/dialog.module';

@Module({
  imports: [DatabaseModule, DialogModule],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}

