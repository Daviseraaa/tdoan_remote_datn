/** Payload TELEGRAM_SEND — khớp `agent/core/src/tasks/handlers/telegram_send.rs` */

export type TelegramSendMode = 'message' | 'photo' | 'document';

export interface TelegramSendFormState {
  mode: TelegramSendMode;
  telegramBotId: string;
  chatId: string;
  text: string;
  filePath: string;
  caption: string;
  fileName: string;
}

export const DEFAULT_TELEGRAM_RECIPIENT = '{{telegram.userId}}';

export const DEFAULT_TELEGRAM_SEND_FORM: TelegramSendFormState = {
  mode: 'message',
  telegramBotId: '',
  chatId: DEFAULT_TELEGRAM_RECIPIENT,
  text: '',
  filePath: 'C:/Users/Public',
  caption: '',
  fileName: '',
};

export function parseTelegramSendForm(
  payload?: Record<string, unknown> | null,
): TelegramSendFormState {
  const p = payload ?? {};
  const modeRaw = String(p.mode ?? p.sendAs ?? p.telegramSendAs ?? 'message').toLowerCase();
  let mode: TelegramSendMode = 'message';
  if (modeRaw === 'photo') mode = 'photo';
  else if (modeRaw === 'document' || modeRaw === 'file') mode = 'document';
  else if (modeRaw === 'message' || modeRaw === 'text') mode = 'message';
  else if (p.filePath || p.file_path || p.path) mode = 'document';

  return {
    mode,
    telegramBotId:
      typeof p.telegramBotId === 'string'
        ? p.telegramBotId
        : DEFAULT_TELEGRAM_SEND_FORM.telegramBotId,
    chatId:
      typeof p.chatId === 'string'
        ? p.chatId
        : typeof p.chat_id === 'string'
          ? p.chat_id
          : DEFAULT_TELEGRAM_SEND_FORM.chatId,
    text:
      typeof p.text === 'string'
        ? p.text
        : typeof p.message === 'string'
          ? p.message
          : typeof p.content === 'string'
            ? p.content
            : DEFAULT_TELEGRAM_SEND_FORM.text,
    filePath:
      typeof p.filePath === 'string'
        ? p.filePath
        : typeof p.file_path === 'string'
          ? p.file_path
          : typeof p.path === 'string'
            ? p.path
            : DEFAULT_TELEGRAM_SEND_FORM.filePath,
    caption: typeof p.caption === 'string' ? p.caption : DEFAULT_TELEGRAM_SEND_FORM.caption,
    fileName:
      typeof p.fileName === 'string'
        ? p.fileName
        : typeof p.file_name === 'string'
          ? p.file_name
          : typeof p.telegramFileName === 'string'
            ? p.telegramFileName
            : DEFAULT_TELEGRAM_SEND_FORM.fileName,
  };
}

export function buildTelegramSendPayload(form: TelegramSendFormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    mode: form.mode,
    telegramBotId: form.telegramBotId.trim() || undefined,
    chatId: form.chatId.trim(),
  };
  if (form.mode === 'message') {
    base.text = form.text.trim();
    return base;
  }
  base.filePath = form.filePath.trim();
  if (form.caption.trim()) base.caption = form.caption.trim();
  if (form.fileName.trim()) base.fileName = form.fileName.trim();
  return base;
}

export function buildTelegramSendTask(form: TelegramSendFormState): {
  command: string;
  payload: Record<string, unknown>;
} {
  return {
    command: 'send',
    payload: buildTelegramSendPayload(form),
  };
}
