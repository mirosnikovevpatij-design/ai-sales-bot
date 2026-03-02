import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_INIT_MESSAGE, INIT_MESSAGE_KEY } from '../constants/prompt-defaults';
import { PrismaService } from '../database/prisma.service';
import { DialogService } from '../dialog/dialog.service';
import { AmoChatsService } from '../integrations/amo-chats.service';
import { FollowupService } from '../followup/followup.service';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialogService: DialogService,
    private readonly amoChats: AmoChatsService,
    private readonly followupService: FollowupService,
    private readonly appConfig: AppConfigService,
  ) {}

  async sendInitMessage(sessionId: string) {
    this.logger.log(`Sending init message for session ${sessionId}`);

    const session = await this.prisma.leadSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    const row = await this.prisma.prompt.findFirst({
      where: { key: INIT_MESSAGE_KEY, isActive: true },
      orderBy: { version: 'desc' },
    });
    const text = (row?.content?.trim() || DEFAULT_INIT_MESSAGE) as string;

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

    const dueAt = this.followupService.getFollowupDueAt(1);
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

    const content = (text || '').trim() || '(пусто)';

    if (this.isClientStopPhrase(content)) {
      await this.prisma.message.create({
        data: {
          leadSessionId: sessionId,
          direction: 'IN',
          channel: 'WHATSAPP',
          messageType: 'text',
          text: content,
          status: 'DELIVERED',
        },
      });
      await this.prisma.leadSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED', followupStopped: true, lastClientMessageAt: new Date() },
      });
      return 'Вы отписаны. Мы больше не будем писать.';
    }

    if (!this.appConfig.isWithinWorkingHours()) {
      const msg = await this.prisma.message.create({
        data: {
          leadSessionId: sessionId,
          direction: 'IN',
          channel: 'WHATSAPP',
          messageType: 'text',
          text: content,
          status: 'DELIVERED',
        },
      });
      const scheduledReplyAt = this.appConfig.getNextWorkingWindowStart();
      await this.prisma.offHoursQueue.create({
        data: {
          leadSessionId: sessionId,
          messageId: msg.id,
          scheduledReplyAt,
          status: 'PENDING',
        },
      });
      return 'Мы ответим в рабочее время (пн–сб 9:00–21:00).';
    }

    return this.dialogService.handleIncomingMessage(sessionId, content);
  }

  /** Стоп-слова/фразы клиента: отписка, удаление данных (ТЗ). */
  private isClientStopPhrase(text: string): boolean {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const stopPhrases = [
      'стоп',
      'отпишитесь',
      'отписаться',
      'удалите данные',
      'удалите мои данные',
      'удалите меня',
      'не пишите',
      'хватит',
      'прекратите',
      'отказ',
      'не интересно',
    ];
    return stopPhrases.some((phrase) => normalized === phrase || normalized.includes(phrase));
  }
}

