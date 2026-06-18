import { Injectable, Logger } from '@nestjs/common';
import { WorkflowTriggerType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TriggerDispatcherService } from '../trigger-dispatcher.service';
import type { TelegramMatchConfig, TelegramTriggerPayload } from './telegram.types';
import { extractTelegramCommandArgs } from './telegram-command-args';
import { isTelegramSenderAllowed } from './telegram-bot-access';

@Injectable()
export class TelegramUpdateService {
  private readonly logger = new Logger(TelegramUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: TriggerDispatcherService,
  ) {}

  /** Xử lý update concurrent — mỗi binding dispatch riêng. */
  processUpdate(botId: string, update: Record<string, unknown>) {
    void this.handleUpdate(botId, update).catch((err) => {
      this.logger.error(`Telegram update error bot=${botId}`, err);
    });
  }

  private async handleUpdate(botId: string, update: Record<string, unknown>) {
    const bot = await this.prisma.telegramBot.findFirst({
      where: { id: botId, enabled: true },
    });
    if (!bot) return;

    const parsed = this.parseUpdate(update);
    if (!parsed) return;

    if (
      !isTelegramSenderAllowed(
        parsed.chatId,
        parsed.userId,
        bot.allowedChatIds,
        bot.allowedUserIds,
      )
    ) {
      this.logger.warn(
        `Telegram update rejected bot=${botId} chat=${parsed.chatId} user=${parsed.userId} (không trong danh sách cho phép)`,
      );
      return;
    }

    const triggers = await this.prisma.workflowTrigger.findMany({
      where: {
        telegramBotId: botId,
        type: WorkflowTriggerType.TELEGRAM,
        enabled: true,
      },
      include: { workflow: { select: { isActive: true } } },
    });

    if (triggers.length === 0) {
      this.logger.warn(`No TELEGRAM triggers for bot ${botId}`);
      return;
    }

    let dispatched = 0;
    for (const trigger of triggers) {
      if (!trigger.workflow.isActive) {
        this.logger.warn(
          `Trigger ${trigger.id} skipped: workflow inactive (bật workflow trên admin)`,
        );
        continue;
      }
      const match = trigger.matchConfig as TelegramMatchConfig | null;
      if (!this.matches(parsed, match)) {
        this.logger.debug(
          `Trigger ${trigger.id} no match event=${parsed.event} command=${parsed.command ?? '-'}`,
        );
        continue;
      }

      this.logger.log(
        `Dispatch workflow trigger=${trigger.id} event=${parsed.event} chat=${parsed.chatId}`,
      );
      this.dispatcher.dispatch(trigger.id, trigger.userId, {
        telegram: parsed,
      });
      dispatched++;
    }
    if (dispatched === 0) {
      this.logger.warn(
        `Telegram update bot=${botId} event=${parsed.event} — no trigger matched (kiểm tra lệnh /run và events)`,
      );
    }
  }

  private matches(
    payload: TelegramTriggerPayload,
    config: TelegramMatchConfig | null,
  ): boolean {
    if (!config) return payload.event === 'message';

    let events = config.events?.length
      ? [...config.events]
      : ['message', 'command', 'callback_query'];

    if (config.commands?.length && !events.includes('command')) {
      events.push('command');
    }

    if (!events.includes(payload.event as never)) return false;

    if (config.commands?.length) {
      const cmd = payload.command ?? this.extractCommand(payload.text);
      if (!cmd) return false;
      const normalized = cmd.toLowerCase();
      return config.commands.some((c) => {
        const want = c.trim().toLowerCase();
        const withSlash = want.startsWith('/') ? want : `/${want}`;
        return normalized === withSlash || normalized === want;
      });
    }

    return true;
  }

  private extractCommand(text?: string): string | undefined {
    if (!text?.startsWith('/')) return undefined;
    const part = text.split(/\s/)[0]?.split('@')[0];
    return part;
  }

  parseUpdate(update: Record<string, unknown>): TelegramTriggerPayload | null {
    const updateId = Number(update.update_id ?? 0);
    const ts = new Date().toISOString();

    const cb = update.callback_query as Record<string, unknown> | undefined;
    if (cb) {
      const from = cb.from as Record<string, unknown> | undefined;
      const msg = cb.message as Record<string, unknown> | undefined;
      const chat = msg?.chat as Record<string, unknown> | undefined;
      return {
        updateId,
        event: 'callback_query',
        timestamp: ts,
        chatId: String(chat?.id ?? ''),
        userId: String(from?.id ?? ''),
        username: from?.username as string | undefined,
        text: (msg?.text as string) ?? undefined,
        messageId: msg?.message_id != null ? String(msg.message_id) : undefined,
        callbackData: cb.data as string | undefined,
      };
    }

    const msg =
      (update.message as Record<string, unknown> | undefined) ??
      (update.edited_message as Record<string, unknown> | undefined);

    if (!msg) return null;

    const chat = msg.chat as Record<string, unknown> | undefined;
    const from = msg.from as Record<string, unknown> | undefined;
    const text = msg.text as string | undefined;
    const command = this.extractCommand(text);

    let event: TelegramTriggerPayload['event'] = update.edited_message
      ? 'edited_message'
      : 'message';
    if (command) event = 'command';
    if (msg.document) event = 'document';
    if (msg.photo) event = 'photo';

    const { args, argsText } = extractTelegramCommandArgs(text, command);

    const file = msg.document
      ? (msg.document as Record<string, unknown>)
      : Array.isArray(msg.photo)
        ? (msg.photo as unknown[])[(msg.photo as unknown[]).length - 1] as Record<
            string,
            unknown
          >
        : undefined;

    return {
      updateId,
      event,
      timestamp: ts,
      chatId: String(chat?.id ?? ''),
      userId: String(from?.id ?? ''),
      username: from?.username as string | undefined,
      text,
      messageId: msg.message_id != null ? String(msg.message_id) : undefined,
      command,
      ...(args.length ? { args, argsText } : argsText ? { argsText } : {}),
      file,
    };
  }
}
