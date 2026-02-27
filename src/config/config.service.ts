import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get timezone(): string {
    return this.config.get<string>('TIMEZONE', 'Asia/Almaty');
  }

  get sendWindowStart(): string {
    return this.config.get<string>('SEND_WINDOW_START', '09:00');
  }

  get sendWindowEnd(): string {
    return this.config.get<string>('SEND_WINDOW_END', '21:00');
  }

  get workDays(): number[] {
    const raw = this.config.get<string>('WORK_DAYS', '1,2,3,4,5,6');
    return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  }

  isWithinWorkingHours(date: Date = new Date()): boolean {
    // Упрощённо: проверка по часам в локальной таймзоне не подключая moment/tz. В проде лучше использовать date-fns-tz или luxon.
    const h = date.getHours();
    const m = date.getMinutes();
    const [startH, startM] = this.sendWindowStart.split(':').map(Number);
    const [endH, endM] = this.sendWindowEnd.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const currentMin = h * 60 + m;
    if (currentMin < startMin || currentMin > endMin) return false;
    const day = date.getDay();
    const workDays = this.workDays;
    return workDays.includes(day === 0 ? 7 : day);
  }
}
