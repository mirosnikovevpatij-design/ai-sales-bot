import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { LeadsModule } from './leads/leads.module';
import { MessagingModule } from './messaging/messaging.module';
import { DialogModule } from './dialog/dialog.module';
import { QueueModule } from './queue/queue.module';
import { AdminModule } from './admin/admin.module';
import { ObservabilityModule } from './observability/observability.module';

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
    DatabaseModule,
    LeadsModule,
    MessagingModule,
    DialogModule,
    QueueModule,
    AdminModule,
    ObservabilityModule,
  ],
})
export class AppModule {}

