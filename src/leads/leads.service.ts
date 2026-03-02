import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { StopListService } from '../stop-list/stop-list.service';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stopListService: StopListService,
    private readonly appConfig: AppConfigService,
    @InjectQueue('init_queue') private readonly initQueue: Queue,
  ) {}

  /**
   * Обрабатывает тело вебхука amoCRM (формат с account, leads.add, leads.status)
   * или один объект сделки. Возвращает массив результатов по каждой обработанной сделке.
   */
  async processAmoWebhookPayload(body: any): Promise<{ dealId: string; leadSessionId?: string; skipped?: boolean; reason?: string }[]> {
    const results: { dealId: string; leadSessionId?: string; skipped?: boolean; reason?: string }[] = [];

    if (body.deal_id != null || (body.leads == null && body.id != null)) {
      const payload = body.deal_id != null
        ? body
        : { deal_id: body.id, phone: body.phone ?? body._embedded?.contacts?.[0]?.phone, contact_id: body.contact_id ?? body._embedded?.contacts?.[0]?.id };
      const result = await this.createLeadSessionFromAmoWebhook(payload);
      results.push({
        dealId: String(result.session.amoDealId),
        leadSessionId: result.session.id,
        skipped: result.skipped ?? false,
        reason: result.reason ?? undefined,
      });
      return results;
    }

    const add = body.leads?.add ?? [];
    const status = body.leads?.status ?? [];
    const toProcess: { deal_id: number; phone?: string; contact_id?: number }[] = [];

    for (const lead of add) {
      const phone = this.extractPhone(lead);
      toProcess.push({
        deal_id: lead.id,
        phone,
        contact_id: lead._embedded?.contacts?.[0]?.id ?? lead.contact_id,
      });
    }
    for (const lead of status) {
      const phone = this.extractPhone(lead);
      toProcess.push({
        deal_id: lead.id,
        phone,
        contact_id: lead._embedded?.contacts?.[0]?.id ?? lead.contact_id,
      });
    }

    for (const payload of toProcess) {
      try {
        const result = await this.createLeadSessionFromAmoWebhook(payload);
        results.push({
          dealId: String(result.session.amoDealId),
          leadSessionId: result.session.id,
          skipped: result.skipped ?? false,
          reason: result.reason ?? undefined,
        });
      } catch (e) {
        results.push({ dealId: String(payload.deal_id), reason: 'error' });
      }
    }

    return results;
  }

  private extractPhone(lead: any): string {
    const contact = lead._embedded?.contacts?.[0];
    if (contact?.phone) return contact.phone;
    const contactCf = contact?.custom_fields_values ?? contact?.custom_fields ?? [];
    const contactPhone = contactCf.find((f: any) => f.field_code === 'PHONE' || f.field_name === 'Телефон');
    if (contactPhone?.values?.[0]?.value) return contactPhone.values[0].value;
    const cf = lead.custom_fields_values ?? lead.custom_fields ?? [];
    const phoneField = cf.find((f: any) => f.field_code === 'PHONE' || f.field_name === 'Телефон');
    return phoneField?.values?.[0]?.value ?? lead.phone ?? '';
  }

  async createLeadSessionFromAmoWebhook(payload: any) {
    const amoDealId = BigInt(payload.deal_id ?? 0);
    const rawPhone = payload.phone ?? payload.contact?.phone ?? '';
    const phone = this.normalizePhone(rawPhone);

    if (!phone) {
      const session = await this.prisma.leadSession.upsert({
        where: { amoDealId },
        update: {},
        create: {
          amoDealId,
          phone: '',
          status: 'INIT_FAILED',
        },
      });
      return { session, skipped: true, reason: 'no_phone' };
    }

    const inStopList = await this.stopListService.isInStopList(phone);
    if (inStopList) {
      const session = await this.prisma.leadSession.upsert({
        where: { amoDealId },
        update: {},
        create: {
          amoDealId,
          phone,
          status: 'INIT_FAILED',
        },
      });
      return { session, skipped: true, reason: 'stop_list' };
    }

    const phoneMasked = phone.length >= 8
      ? phone.slice(0, 4) + '***' + phone.slice(-4)
      : phone;

    const session = await this.prisma.leadSession.upsert({
      where: { amoDealId },
      update: {},
      create: {
        amoDealId,
        amoContactId: payload.contact_id ? BigInt(payload.contact_id) : null,
        phone,
        phoneMasked,
        status: 'PENDING_INIT',
        source: payload.source ?? null,
      },
    });

    const now = new Date();
    let delayMs = 0;
    if (!this.appConfig.isWithinWorkingHours(now)) {
      const runAt = this.appConfig.getNextWorkingWindowStart(now);
      delayMs = Math.max(0, runAt.getTime() - now.getTime());
    } else {
      delayMs = this.appConfig.getInitRateDelayMs();
    }
    await this.initQueue.add(
      'init',
      { leadSessionId: session.id },
      {
        delay: delayMs,
        attempts: this.appConfig.initMaxAttempts,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    return { session, skipped: false };
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) {
      const rest = digits.slice(-10);
      return '+7' + rest;
    }
    return raw;
  }
}

