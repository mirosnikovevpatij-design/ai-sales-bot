import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalendlyService } from './calendly.service';

@Module({
  imports: [ConfigModule],
  providers: [CalendlyService],
  exports: [CalendlyService],
})
export class CalendlyModule {}
