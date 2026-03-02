import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { maskPhoneForLog } from './mask.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>() as any;
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const payload = {
          timestamp: new Date().toISOString(),
          level: 'log',
          context: 'HTTP',
          method,
          url: maskPhoneForLog(url),
          durationMs: ms,
        };
        process.stdout.write(JSON.stringify(payload) + '\n');
      }),
    );
  }
}

