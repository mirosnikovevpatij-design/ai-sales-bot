import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const MAX_FRAGMENTS_TO_SCORE = 2000;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly minConfidence = 0.65;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Поиск по релевантности к запросу: фрагменты, в которых больше всего совпадают слова запроса.
   * Без эмбеддингов — лексическое совпадение (что подходит к запросу по словам).
   */
  async search(query: string, topK = 6): Promise<{ content: string; score: number }[]> {
    const all = await this.prisma.knowledgeFragment.findMany({
      take: MAX_FRAGMENTS_TO_SCORE,
      orderBy: { updatedAt: 'desc' },
    });
    if (all.length === 0) return [];

    const queryWords = this.normalizeToWords(query);
    if (queryWords.length === 0) {
      return all.slice(0, topK).map((d) => ({ content: d.content, score: 0.5 }));
    }

    const scored = all.map((d) => {
      const score = this.relevanceScore(d.content, queryWords);
      return { content: d.content, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  private normalizeToWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sа-яёa-z]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /** Доля слов запроса, встретившихся во фрагменте (0..1). Плюс бонус за частоту. */
  private relevanceScore(fragmentContent: string, queryWords: string[]): number {
    const lower = fragmentContent.toLowerCase();
    let matches = 0;
    for (const w of queryWords) {
      if (lower.includes(w)) matches += 1;
    }
    const ratio = matches / queryWords.length;
    return ratio;
  }

  shouldEscalate(scores: number[]): boolean {
    const max = scores.length ? Math.max(...scores) : 0;
    return max < this.minConfidence;
  }
}
