import { Injectable } from '@nestjs/common';
import { resolveTemplateString, type WorkflowRunScope } from '../../automation/workflow-variables';
import { TelegramApiService } from './telegram-api.service';
import type { TelegramStepConfig } from './telegram.types';

@Injectable()
export class TelegramActionService {
  constructor(private readonly api: TelegramApiService) {}

  async runAction(
    botToken: string,
    config: TelegramStepConfig,
    scope: WorkflowRunScope,
  ): Promise<{ messageId?: number; result: string }> {
    const chatId = resolveTemplateString(
      config.chatId ?? '{{telegram.userId}}',
      scope,
    );
    const text = config.text
      ? resolveTemplateString(config.text, scope)
      : '';

    const replyTo = config.replyToMessageId
      ? Number(resolveTemplateString(String(config.replyToMessageId), scope))
      : undefined;

    const action = config.action ?? 'send_message';

    const needsText =
      action === 'send_message' ||
      action === 'reply_message' ||
      action === 'edit_message';
    if (needsText && !text.trim()) {
      const keys = Object.keys(scope.steps);
      throw new Error(
        keys.length > 0
          ? `Nội dung Telegram rỗng sau khi thay biến. Các khóa step: ${keys.join(', ')}. Thử {{steps.<khóa>.stdout}} hoặc {{prev.stdout}} (khóa khớp badge trên node task).`
          : 'Nội dung Telegram rỗng — không có output bước task phía trước trên nhánh này.',
      );
    }

    if (action === 'send_photo') {
      const photo = resolveTemplateString(config.photoUrl ?? '', scope);
      const res = await this.api.sendPhoto(botToken, {
        chat_id: chatId,
        photo,
        caption: text || undefined,
        reply_to_message_id: replyTo,
      });
      const mid = res.message_id;
      return { messageId: mid, result: `photo:${mid}` };
    }

    if (action === 'send_document') {
      const doc = resolveTemplateString(config.documentUrl ?? '', scope);
      const res = await this.api.sendDocument(botToken, {
        chat_id: chatId,
        document: doc,
        caption: text || undefined,
      });
      const mid = res.message_id;
      return { messageId: mid, result: `document:${mid}` };
    }

    if (action === 'edit_message') {
      const mid = Number(
        resolveTemplateString(String(config.messageId ?? ''), scope),
      );
      await this.api.editMessageText(botToken, {
        chat_id: chatId,
        message_id: mid,
        text,
        reply_markup: config.inlineKeyboard
          ? { inline_keyboard: config.inlineKeyboard }
          : undefined,
      });
      return { messageId: mid, result: `edited:${mid}` };
    }

    const replyMarkup =
      action === 'inline_keyboard' && config.inlineKeyboard
        ? { inline_keyboard: config.inlineKeyboard }
        : undefined;

    const res = await this.api.sendMessage(botToken, {
      chat_id: chatId,
      text,
      reply_to_message_id:
        action === 'reply_message' ? replyTo : undefined,
      parse_mode: config.parseMode,
      reply_markup: replyMarkup,
    });

    return {
      messageId: res?.message_id,
      result: text.slice(0, 500),
    };
  }
}
