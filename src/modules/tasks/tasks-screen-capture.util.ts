import { PrismaService } from '../../prisma/prisma.service';

export type ScreenCapturePayload = Record<string, unknown>;

/** Bổ sung botToken khi gửi WS — không lưu token vào DB (chỉ lúc emit). */
export async function resolveScreenCaptureEmitPayload(
  prisma: PrismaService,
  userId: string,
  payload: unknown,
): Promise<ScreenCapturePayload> {
  const p: ScreenCapturePayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as ScreenCapturePayload) }
      : {};

  if (!p.sendTelegram) {
    return p;
  }

  const botId = typeof p.telegramBotId === 'string' ? p.telegramBotId.trim() : '';
  if (!botId) {
    throw new Error('SCREEN_CAPTURE: sendTelegram cần telegramBotId');
  }

  const chatId = typeof p.chatId === 'string' ? p.chatId.trim() : '';
  if (!chatId) {
    throw new Error('SCREEN_CAPTURE: sendTelegram cần chatId');
  }

  const bot = await prisma.telegramBot.findFirst({
    where: { id: botId, userId },
    select: { botToken: true },
  });
  if (!bot?.botToken) {
    throw new Error('SCREEN_CAPTURE: không tìm thấy bot Telegram');
  }

  return { ...p, botToken: bot.botToken };
}
