import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;
  private readonly model = 'gpt-4o-mini';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateReply(systemPrompt: string, userMessages: { role: 'user' | 'assistant'; content: string }[]): Promise<string | null> {
    if (!this.isConfigured) return null;

    try {
      const messages: { role: string; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...userMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const { data } = await axios.post<{ choices?: { message?: { content?: string } }[] }>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages,
          max_tokens: 400,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const content = data?.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 400) {
        return content.slice(0, 397) + '...';
      }
      return content ?? null;
    } catch (err: any) {
      this.logger.warn(`OpenAI call failed: ${err.message}`);
      return null;
    }
  }
}
