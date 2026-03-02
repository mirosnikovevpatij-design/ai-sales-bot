import { Body, Controller, HttpException, Param, Post } from '@nestjs/common';
import { DialogService } from '../../dialog/dialog.service';
import { randomUUID } from 'crypto';

/** Тестовый чат не создаёт и не изменяет записи в БД лидов/сообщений — только проверка диалога с ботом. */
@Controller('admin/test')
export class AdminTestController {
  constructor(private readonly dialog: DialogService) {}

  @Post('scenario/start')
  async start() {
    try {
      const initMessage = await this.dialog.getInitMessageContent();
      return {
        sessionId: randomUUID(),
        initMessage,
      };
    } catch (err: any) {
      const message = err?.message || String(err);
      throw new HttpException(
        { message: `Ошибка запуска сценария: ${message}` },
        500,
      );
    }
  }

  @Post(':sessionId/send')
  async send(
    @Param('sessionId') _sessionId: string,
    @Body() body: { text?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  ) {
    try {
      const text = (body?.text ?? '').trim() || '(пусто)';
      const history = Array.isArray(body?.history) ? body.history : [];
      const reply = await this.dialog.generateReplyForTest(history, text);
      return { reply: reply ?? 'Нет ответа от бота.' };
    } catch (err: any) {
      const message = err?.message || String(err);
      throw new HttpException(
        { message: `Ошибка ответа бота: ${message}` },
        500,
      );
    }
  }

  @Post(':sessionId/end')
  async end(@Param('sessionId') _sessionId: string) {
    return { ok: true };
  }
}
