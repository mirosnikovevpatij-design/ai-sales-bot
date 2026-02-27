import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DialogService } from '../dialog/dialog.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialogService: DialogService,
  ) {}

  async sendInitMessage(sessionId: string) {
    this.logger.log(`Sending init message for session ${sessionId}`);

    const text =
      'Здравствуйте! Это тестовое init-сообщение от бота. Напишите что-нибудь в ответ.';

    await this.prisma.message.create({
      data: {
        leadSessionId: sessionId,
        direction: 'OUT',
        channel: 'WHATSAPP',
        messageType: 'text',
        text,
        status: 'SENT',
      },
    });

    await this.prisma.leadSession.update({
      where: { id: sessionId },
      data: {
        status: 'INIT_SENT',
        initSentAt: new Date(),
        lastBotMessageAt: new Date(),
      },
    });
  }

  async handleIncomingFromWebhook(body: any): Promise<string> {
    const text =
      body?.message?.add?.[0]?.text ??
      body?.text ??
      body?.message?.text ??
      '';
    const leadSessionId =
      body?.leadSessionId ??
      body?.lead_session_id;
    const phone = body?.message?.add?.[0]?.author?.id ?? body?.phone ?? '';
    const conversationId = body?.message?.add?.[0]?.chat_id ?? body?.conversation_id;

    let sessionId = leadSessionId;

    if (!sessionId && (phone || conversationId)) {
      const session = await this.prisma.leadSession.findFirst({
        where: conversationId
          ? { conversationId }
          : { phone: { equals: phone, mode: 'insensitive' } },
        orderBy: { updatedAt: 'desc' },
      });
      sessionId = session?.id ?? null;
    }

    if (!sessionId) {
      this.logger.warn('Incoming message: no leadSessionId, phone or conversation_id');
      return 'Сессия не найдена. Обратитесь к менеджеру.';
    }

    return this.dialogService.handleIncomingMessage(sessionId, text || '(пусто)');
  }
}

