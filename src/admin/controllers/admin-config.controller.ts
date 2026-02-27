import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/system-config')
export class AdminConfigController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getConfigKeys() {
    const rows = await this.prisma.systemConfig.findMany();
    const map: Record<string, unknown> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    if (Object.keys(map).length === 0) {
      return {
        rateLimitPerMinute: 15,
        initRateDelayMin: 8,
        initRateDelayMax: 20,
        SEND_WINDOW_START: '09:00',
        SEND_WINDOW_END: '21:00',
        TIMEZONE: 'Asia/Almaty',
      };
    }
    return map;
  }
}

