import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { LeadsModule } from './leads/leads.module';
import { MessagingModule } from './messaging/messaging.module';
import { DialogModule } from './dialog/dialog.module';
import { QueueModule } from './queue/queue.module';
import { AdminModule } from './admin/admin.module';
import { ObservabilityModule } from './observability/observability.module';
import { StopListModule } from './stop-list/stop-list.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LlmModule } from './llm/llm.module';
import { AppConfigModule } from './config/config.module';
import { CalendlyModule } from './calendly/calendly.module';
import { RagModule } from './rag/rag.module';
import { FollowupModule } from './followup/followup.module';
import { EscalationModule } from './escalation/escalation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    LeadsModule,
    MessagingModule,
    DialogModule,
    QueueModule,
    AdminModule,
    ObservabilityModule,
    StopListModule,
    IntegrationsModule,
    LlmModule,
    AppConfigModule,
    CalendlyModule,
    RagModule,
    FollowupModule,
    EscalationModule,
  ],
})
export class AppModule {}

