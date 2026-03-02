import { LoggerService } from '@nestjs/common';
import { maskPhoneForLog } from './mask.util';

export class JsonLoggerService implements LoggerService {
  log(message: string, context?: string) {
    this.write('log', message, context);
  }
  error(message: string, trace?: string, context?: string) {
    this.write('error', message, context, { trace });
  }
  warn(message: string, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: string, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: string, context?: string) {
    this.write('verbose', message, context);
  }

  private write(level: string, message: string, context?: string, extra?: object) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message: maskPhoneForLog(message),
      ...extra,
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
