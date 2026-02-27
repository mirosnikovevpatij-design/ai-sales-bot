import { Body, Controller, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DialogService } from '../../dialog/dialog.service';
import { LeadSessionStatus } from '@prisma/client';

const TEST_INIT_MESSAGE =
  'Здравствуйте! Это тестовое init-сообщение от бота. Напишите что-нибудь в ответ.';

@Controller('admin/test')
export class AdminTestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dialog: DialogService,
  ) {}

  @Post('scenario/start')
  async start() {
    const amoDealId = BigInt(999000000 + (Date.now() % 10000000));
    const phone = '+79000000000';
    const session = await this.prisma.leadSession.create({
      data: {
        amoDealId,
        phone,
        status: LeadSessionStatus.INIT_SENT,
        initSentAt: new Date(),
      },
    });
    await this.prisma.message.create({
      data: {
        leadSessionId: session.id,
        direction: 'OUT',
        channel: 'WHATSAPP',
        messageType: 'text',
        text: TEST_INIT_MESSAGE,
        status: 'SENT',
      },
    });
    await this.prisma.leadSession.update({
      where: { id: session.id },
      data: { lastBotMessageAt: new Date() },
    });
    return {
      sessionId: session.id,
      initMessage: TEST_INIT_MESSAGE,
    };
  }

  @Post(':sessionId/send')
  async send(
    @Param('sessionId') sessionId: string,
    @Body() body: { text?: string },
  ) {
    const text = (body?.text ?? '').trim() || '(пусто)';
    const reply = await this.dialog.handleIncomingMessage(sessionId, text);
    return { reply };
  }

  @Post(':sessionId/end')
  async end(@Param('sessionId') sessionId: string) {
    await this.prisma.leadSession.update({
      where: { id: sessionId },
      data: { status: LeadSessionStatus.CLOSED },
    });
    return { ok: true };
  }
}
