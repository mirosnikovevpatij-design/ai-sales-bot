import { Body, Controller, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('webhooks/amo')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * Единая точка приёма вебхуков amoCRM.
   * В настройках amoCRM укажите: destination = https://ВАШ_ДОМЕН/api/webhooks/amo
   * и подпишитесь на события add_lead, status_lead.
   */
  @Post()
  async handleAmoWebhook(@Body() body: any) {
    const results = await this.leadsService.processAmoWebhookPayload(body);
    return { ok: true, processed: results.length, results };
  }

  /** Тестовый/ручной вызов: POST /api/webhooks/amo/lead-created с телом { deal_id, phone [, contact_id ] } */
  @Post('lead-created')
  async handleLeadCreated(@Body() body: any) {
    const result = await this.leadsService.createLeadSessionFromAmoWebhook(body);
    return {
      ok: true,
      leadSessionId: result.session.id,
      skipped: result.skipped ?? false,
      reason: result.reason ?? null,
    };
  }
}

