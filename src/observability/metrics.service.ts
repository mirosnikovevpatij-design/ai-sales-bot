import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  // Заглушка под интеграцию с Prometheus или другим сборщиком
  incrementCounter(_name: string, _labels?: Record<string, string>) {
    // no-op
  }
}

