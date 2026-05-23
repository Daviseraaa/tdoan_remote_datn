import { Injectable, Logger } from '@nestjs/common';

const API_BASE = 'https://api.telegram.org';
const MIN_INTERVAL_MS = 55;
const MAX_RETRIES = 3;

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private lastCallAt = 0;
  private chain: Promise<void> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCallAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();
      return fn();
    });
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  async callApi<T>(
    botToken: string,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    return this.enqueue(async () => {
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(`${API_BASE}/bot${botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
          if (!json.ok) {
            throw new Error(json.description ?? `Telegram API ${method} failed`);
          }
          return json.result as T;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw lastErr ?? new Error('Telegram API failed');
    });
  }

  async getMe(botToken: string) {
    return this.callApi<{ username?: string; id: number }>(botToken, 'getMe', {});
  }

  async deleteWebhook(botToken: string) {
    return this.callApi<boolean>(botToken, 'deleteWebhook', { drop_pending_updates: false });
  }

  async setWebhook(botToken: string, url: string, secretToken?: string) {
    return this.callApi(botToken, 'setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: [
        'message',
        'edited_message',
        'callback_query',
      ],
    });
  }

  async sendMessage(
    botToken: string,
    params: {
      chat_id: string | number;
      text: string;
      reply_to_message_id?: number;
      reply_markup?: unknown;
      parse_mode?: string;
    },
  ) {
    return this.callApi<{ message_id: number }>(botToken, 'sendMessage', params);
  }

  async sendPhoto(
    botToken: string,
    params: {
      chat_id: string | number;
      photo: string;
      caption?: string;
      reply_to_message_id?: number;
    },
  ) {
    return this.callApi<{ message_id: number }>(botToken, 'sendPhoto', params);
  }

  async sendDocument(
    botToken: string,
    params: {
      chat_id: string | number;
      document: string;
      caption?: string;
    },
  ) {
    return this.callApi<{ message_id: number }>(botToken, 'sendDocument', params);
  }

  async editMessageText(
    botToken: string,
    params: {
      chat_id: string | number;
      message_id: number;
      text: string;
      reply_markup?: unknown;
    },
  ) {
    return this.callApi(botToken, 'editMessageText', params);
  }

}
