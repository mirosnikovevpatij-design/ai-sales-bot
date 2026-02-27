import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AmoChatsService {
  private readonly logger = new Logger(AmoChatsService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    const subdomain = this.config.get<string>('AMOCRM_SUBDOMAIN', '');
    this.baseUrl = subdomain ? `https://${subdomain}.amocrm.ru` : '';
    this.token = this.config.get<string>('AMOCRM_ACCESS_TOKEN', '');
  }

  get isConfigured(): boolean {
    return !!this.baseUrl && !!this.token;
  }

  async createChat(contactId: number): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('AmoCRM Chats: not configured, skipping createChat');
      return null;
    }
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/api/v4/chats`,
        { contact_id: contactId },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      return data?.id ?? null;
    } catch (err: any) {
      this.logger.error(`createChat failed: ${err.message}`);
      throw err;
    }
  }

  async sendMessage(params: {
    conversationId: string;
    contactId: number;
    contactName: string;
    text: string;
  }): Promise<{ messageId: string } | null> {
    if (!this.isConfigured) {
      this.logger.warn('AmoCRM Chats: not configured, skipping sendMessage');
      return null;
    }
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/api/v4/chats/messages`,
        {
          conversation_id: params.conversationId,
          receiver: { id: String(params.contactId), name: params.contactName },
          message: { type: 'text', text: params.text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      const messageId = data?.message?.id ?? null;
      return messageId ? { messageId } : null;
    } catch (err: any) {
      this.logger.error(`sendMessage failed: ${err.message}`);
      throw err;
    }
  }
}
