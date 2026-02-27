import { Body, Controller, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('webhooks/amo')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('lead-created')
  async handleLeadCreated(@Body() body: any) {
    const session = await this.leadsService.createLeadSessionFromAmoWebhook(body);
    return { ok: true, leadSessionId: session.id };
  }
}

