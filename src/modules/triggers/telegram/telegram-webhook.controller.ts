import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/index';
import { PrismaService } from '../../../prisma/prisma.service';
import { TelegramUpdateService } from './telegram-update.service';

@ApiTags('Webhooks / Telegram')
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updates: TelegramUpdateService,
  ) {}

  @Public()
  @Post(':botId/:secret')
  async handleWebhook(
    @Param('botId') botId: string,
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') headerSecret: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const bot = await this.prisma.telegramBot.findFirst({
      where: { id: botId, enabled: true },
    });
    if (!bot?.webhookSecret) {
      return { ok: false };
    }
    const token = headerSecret ?? secret;
    if (token !== bot.webhookSecret) {
      return { ok: false };
    }

    this.updates.processUpdate(botId, body);
    return { ok: true };
  }
}
