import { Controller, Get } from '@nestjs/common';

@Controller('admin/system-config')
export class AdminConfigController {
  @Get()
  getConfigKeys() {
    // TODO: вернуть реальные параметры из system_config
    return {
      rateLimitPerMinute: 15,
      initRateDelayMin: 8,
      initRateDelayMax: 20,
    };
  }
}

