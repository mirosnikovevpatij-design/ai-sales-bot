import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { DatabaseModule } from '../database/database.module';
import { StopListModule } from '../stop-list/stop-list.module';

@Module({
  imports: [
    DatabaseModule,
    StopListModule,
    BullModule.registerQueue({ name: 'init_queue' }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}

