import { Injectable } from '@nestjs/common';
import { LeadSessionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class DialogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async handleIncomingMessage(leadSessionId: string, text: string): Promise<string> {
    const session = await this.prisma.leadSession.findUnique({
      where: { id: leadSessionId },
    });

    if (!session) {
      throw new Error('Lead session not found');
    }

    await this.prisma.message.create({
      data: {
        leadSessionId,
        direction: 'IN',
        channel: 'WHATSAPP',
        messageType: 'text',
        text,
        status: 'DELIVERED',
      },
    });

    const nextStatus = this.getNextStatus(session.status);

    await this.prisma.leadSession.update({
      where: { id: leadSessionId },
      data: {
        status: nextStatus,
        lastClientMessageAt: new Date(),
      },
    });

    let reply: string;
    if (this.llm.isConfigured) {
      const lastMessages = await this.prisma.message.findMany({
        where: { leadSessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const userMessages = lastMessages
        .filter((m) => m.text)
        .reverse()
        .map((m) => ({
          role: m.direction === 'IN' ? ('user' as const) : ('assistant' as const),
          content: m.text!,
        }));
      const systemPrompt = `Ты — продавец отдела продаж. Цель: записать клиента на Zoom-встречу. Отвечай коротко, не более 400 символов. Один вопрос за раз. Не упоминай слова "бот", "ИИ", "автоматический". Текущий этап: ${nextStatus}.`;
      const llmReply = await this.llm.generateReply(systemPrompt, userMessages);
      reply = llmReply && llmReply.length > 0 ? llmReply : this.buildReply(nextStatus);
    } else {
      reply = this.buildReply(nextStatus);
    }

    await this.prisma.message.create({
      data: {
        leadSessionId,
        direction: 'OUT',
        channel: 'WHATSAPP',
        messageType: 'text',
        text: reply,
        status: 'SENT',
      },
    });

    await this.prisma.leadSession.update({
      where: { id: leadSessionId },
      data: {
        lastBotMessageAt: new Date(),
      },
    });

    return reply;
  }

  private getNextStatus(current: LeadSessionStatus): LeadSessionStatus {
    switch (current) {
      case LeadSessionStatus.PENDING_INIT:
      case LeadSessionStatus.INIT_SENT:
        return LeadSessionStatus.ENGAGED;
      case LeadSessionStatus.ENGAGED:
        return LeadSessionStatus.QUALIFYING;
      case LeadSessionStatus.QUALIFYING:
        return LeadSessionStatus.PRESENTING;
      case LeadSessionStatus.PRESENTING:
        return LeadSessionStatus.SCHEDULING_ZOOM;
      case LeadSessionStatus.SCHEDULING_ZOOM:
        return LeadSessionStatus.ZOOM_BOOKED;
      default:
        return current;
    }
  }

  private buildReply(status: LeadSessionStatus): string {
    switch (status) {
      case LeadSessionStatus.ENGAGED:
        return 'Спасибо за ответ! Давайте начнём с небольшого уточнения по вашему бизнесу.';
      case LeadSessionStatus.QUALIFYING:
        return 'Записал информацию. Расскажите, пожалуйста, какой сейчас объём базы для обзвона?';
      case LeadSessionStatus.PRESENTING:
        return 'Понимаю вашу ситуацию. Расскажу коротко, как автообзвоны помогают увеличивать количество заявок.';
      case LeadSessionStatus.SCHEDULING_ZOOM:
        return 'Предлагаю созвониться в Zoom, чтобы пройтись по цифрам и кейсам. Какой день вам удобнее?';
      case LeadSessionStatus.ZOOM_BOOKED:
        return 'Отлично, встречу зафиксировали. Если нужно будет перенести — просто напишите здесь.';
      default:
        return 'Спасибо за сообщение! Это тестовый ответ бота.';
    }
  }
}

