import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DialogService } from '../dialog/dialog.service';
import { AmoChatsService } from '../integrations/amo-chats.service';
import { FollowupService } from '../followup/followup.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialogService: DialogService,
    private readonly amoChats: AmoChatsService,
    private readonly followupService: FollowupService,
  ) {}

  async sendInitMessage(sessionId: string) {
    this.logger.log(`Sending init message for session ${sessionId}`);

    const session = await this.prisma.leadSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    const text =
      'Здравствуйте! Это тестовое init-сообщение от бота. Напишите что-нибудь в ответ.';

    let conversationId = session.conversationId;
    let externalMessageId: string | null = null;

    if (this.amoChats.isConfigured && session.amoContactId) {
      try {
        if (!conversationId) {
          conversationId = await this.amoChats.createChat(Number(session.amoContactId));
          if (conversationId) {
            await this.prisma.leadSession.update({
              where: { id: sessionId },
              data: { conversationId },
            });
          }
        }
        if (conversationId) {
          const sent = await this.amoChats.sendMessage({
            conversationId,
            contactId: Number(session.amoContactId),
            contactName: 'Клиент',
            text,
          });
          externalMessageId = sent?.messageId ?? null;
        }
      } catch (err) {
        this.logger.warn(`AmoCRM send failed, saving to DB only: ${err}`);
      }
    }

    await this.prisma.message.create({
      data: {
        leadSessionId: sessionId,
        direction: 'OUT',
        channel: 'WHATSAPP',
        messageType: 'text',
        text,
        status: 'SENT',
        externalMessageId,
      },
    });

    await this.prisma.leadSession.update({
      where: { id: sessionId },
      data: {
        status: 'INIT_SENT',
        initSentAt: new Date(),
        lastBotMessageAt: new Date(),
        ...(externalMessageId && { initMessageId: externalMessageId }),
      },
    });

    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 24);
    await this.followupService.scheduleFollowup(sessionId, 1, dueAt);
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

    await this.followupService.cancelForSession(sessionId, 'client_replied');

    return this.dialogService.handleIncomingMessage(sessionId, text || '(пусто)');
  }
}

