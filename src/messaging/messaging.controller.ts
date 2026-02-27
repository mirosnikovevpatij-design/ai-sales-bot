import { Body, Controller, Post } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('webhooks/whatsapp')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('incoming')
  async handleIncomingMessage(@Body() body: any) {
    const reply = await this.messagingService.handleIncomingFromWebhook(body);
    return { ok: true, reply };
  }
}

