import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MessagingService } from '../../messaging/messaging.service';

@Processor('init_queue')
export class InitQueueProcessor extends WorkerHost {
  constructor(private readonly messagingService: MessagingService) {
    super();
  }

  async process(job: Job<{ leadSessionId: string }>): Promise<void> {
    const { leadSessionId } = job.data;
    await this.messagingService.sendInitMessage(leadSessionId);
  }
}

