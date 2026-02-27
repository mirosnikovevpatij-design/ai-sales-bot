import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CalendlyService {
  private readonly logger = new Logger(CalendlyService.name);
  private readonly token: string;
  private readonly baseUrl = 'https://api.calendly.com';

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('CALENDLY_API_TOKEN', '');
  }

  get isConfigured(): boolean {
    return !!this.token;
  }

  async getAvailableTimes(
    eventTypeUuid: string,
    startTime: string,
    endTime: string,
  ): Promise<{ start_time: string }[]> {
    if (!this.isConfigured) return [];
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/event_type_available_times`,
        {
          params: {
            event_type: `https://api.calendly.com/event_types/${eventTypeUuid}`,
            start_time: startTime,
            end_time: endTime,
          },
          headers: { Authorization: `Bearer ${this.token}` },
          timeout: 10000,
        },
      );
      return data?.collection ?? [];
    } catch (err: any) {
      this.logger.warn(`Calendly getAvailableTimes failed: ${err.message}`);
      return [];
    }
  }
}
