export type TelegramMatchConfig = {
  events?: (
    | 'message'
    | 'command'
    | 'callback_query'
    | 'document'
    | 'photo'
    | 'edited_message'
  )[];
  commands?: string[];
  /** Tham số lệnh (args[0], args[1], …) gán vào biến workflow cùng tên khi chạy. */
  variableArgs?: string[];
};

export type TelegramTriggerPayload = {
  chatId: string;
  userId: string;
  username?: string;
  text?: string;
  messageId?: string;
  updateId?: number;
  timestamp: string;
  event: string;
  command?: string;
  callbackData?: string;
  /** Tham số sau lệnh hoặc nội dung tách theo khoảng trắng. */
  args?: string[];
  /** Phần còn lại sau lệnh (chuỗi gốc). */
  argsText?: string;
  file?: Record<string, unknown>;
};

export type TelegramStepConfig = {
  action:
    | 'send_message'
    | 'send_photo'
    | 'send_document'
    | 'reply_message'
    | 'edit_message'
    | 'inline_keyboard';
  botToken?: string;
  chatId?: string;
  text?: string;
  photoUrl?: string;
  documentUrl?: string;
  replyToMessageId?: number | string;
  messageId?: number | string;
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
};
