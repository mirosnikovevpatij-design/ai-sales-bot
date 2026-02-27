import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AmoChatsService } from './amo-chats.service';

@Module({
  imports: [ConfigModule],
  providers: [AmoChatsService],
  exports: [AmoChatsService],
})
export class IntegrationsModule {}
