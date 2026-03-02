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

  /** Ближайший момент начала рабочего окна (для отложенной отправки init / off-hours). */
  getNextWorkingWindowStart(from: Date = new Date()): Date {
    const d = new Date(from);
    const [startH, startM] = this.sendWindowStart.split(':').map(Number);
    const currentMin = d.getHours() * 60 + d.getMinutes();
    const startMin = startH * 60 + startM;
    const day = d.getDay();
    const isoDay = day === 0 ? 7 : day;

    if (this.isWithinWorkingHours(d)) return d;

    d.setHours(startH, startM, 0, 0);
    if (currentMin > startMin || !this.workDays.includes(isoDay)) {
      d.setDate(d.getDate() + 1);
      for (let i = 0; i < 8; i++) {
        const nextDay = d.getDay() === 0 ? 7 : d.getDay();
        if (this.workDays.includes(nextDay)) return d;
        d.setDate(d.getDate() + 1);
      }
    }
    return d;
  }

  /** Задержка перед отправкой init (rate limit + джиттер), мс. */
  getInitRateDelayMs(): number {
    const min = this.config.get<number>('INIT_RATE_DELAY_MIN', 5) * 1000;
    const max = this.config.get<number>('INIT_RATE_DELAY_MAX', 30) * 1000;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  get initMaxAttempts(): number {
    return this.config.get<number>('INIT_MAX_ATTEMPTS', 3);
  }

  /** Задержки для follow-up: часы для шага 1, дни для 2 и 3. */
  get followup1DelayHours(): number {
    return this.config.get<number>('FOLLOWUP_1_DELAY_HOURS', 24);
  }
  get followup2DelayDays(): number {
    return this.config.get<number>('FOLLOWUP_2_DELAY_DAYS', 3);
  }
  get followup3DelayDays(): number {
    return this.config.get<number>('FOLLOWUP_3_DELAY_DAYS', 10);
  }

  /** Часы до просрочки handoff (SLA). */
  get handoffSlaHours(): number {
    return this.config.get<number>('HANDOFF_SLA_HOURS', 2);
  }
}
