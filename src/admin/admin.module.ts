import { Module } from '@nestjs/common';
import { AdminConfigController } from './controllers/admin-config.controller';

@Module({
  controllers: [AdminConfigController],
})
export class AdminModule {}

