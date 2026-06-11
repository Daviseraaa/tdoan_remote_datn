import { PrismaService } from '../../prisma/prisma.service';

export type TelegramSendPayload = Record<string, unknown>;

/** Inject botToken khi emit WS — không lưu token vào DB. */
export async function resolveTelegramSendEmitPayload(
  prisma: PrismaService,
  userId: string,
  payload: unknown,
): Promise<TelegramSendPayload> {
  const p: TelegramSendPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as TelegramSendPayload) }
      : {};

  const botId =
    typeof p.telegramBotId === 'string' ? p.telegramBotId.trim() : '';
  if (!botId) {
    throw new Error('TELEGRAM_SEND: thiếu telegramBotId');
  }

  const chatId = typeof p.chatId === 'string' ? p.chatId.trim() : '';
  if (!chatId) {
    throw new Error('TELEGRAM_SEND: thiếu chatId');
  }

  const bot = await prisma.telegramBot.findFirst({
    where: { id: botId, userId },
    select: { botToken: true },
  });
  if (!bot?.botToken) {
    throw new Error('TELEGRAM_SEND: không tìm thấy bot Telegram');
  }

  return { ...p, botToken: bot.botToken };
}
