import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('init_queue') private readonly initQueue: Queue,
  ) {}

  async createLeadSessionFromAmoWebhook(payload: any) {
    // TODO: нормализовать payload amoCRM и создать lead_session
    const amoDealId = BigInt(payload.deal_id);

    const session = await this.prisma.leadSession.upsert({
      where: { amoDealId },
      update: {},
      create: {
        amoDealId,
        phone: payload.phone ?? '',
        status: 'PENDING_INIT',
      },
    });

    await this.initQueue.add('init', { leadSessionId: session.id });

    return session;
  }
}

