import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MessagingService } from '../../messaging/messaging.service';
import { PrismaService } from '../../database/prisma.service';

@Processor('init_queue')
export class InitQueueProcessor extends WorkerHost {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ leadSessionId: string }>): Promise<void> {
    const { leadSessionId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;
    try {
      await this.messagingService.sendInitMessage(leadSessionId);
    } catch (err) {
      if (job.attemptsMade + 1 >= maxAttempts) {
        await this.prisma.leadSession.update({
          where: { id: leadSessionId },
          data: { status: 'INIT_FAILED' },
        });
      }
      throw err;
    }
  }
}

