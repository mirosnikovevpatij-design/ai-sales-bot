import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly minConfidence = 0.65;

  constructor(private readonly prisma: PrismaService) {}

  async search(_query: string, _topK = 6): Promise<{ content: string; score: number }[]> {
    // Заглушка: pgvector и knowledge_fragments с embedding — отдельная миграция и индексация.
    const docs = await this.prisma.knowledgeFragment.findMany({ take: _topK });
    return docs.map((d) => ({ content: d.content, score: 0.8 }));
  }

  shouldEscalate(scores: number[]): boolean {
    const max = scores.length ? Math.max(...scores) : 0;
    return max < this.minConfidence;
  }
}
