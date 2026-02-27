import { Module } from '@nestjs/common';
import { StopListService } from './stop-list.service';
import { StopListController } from './stop-list.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [StopListService],
  controllers: [StopListController],
  exports: [StopListService],
})
export class StopListModule {}
