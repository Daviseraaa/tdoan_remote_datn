import { Injectable } from '@nestjs/common';

type NotifyMode = 'all' | 'action';

const MODES = new Set<NotifyMode>(['all', 'action']);

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function toText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'object' && v != null) {
    try {
      return JSON.stringify(v);
    } catch {
      return '[unserializable object]';
    }
  }
  return String(v);
}

function modeEnv(): NotifyMode {
  const raw = (process.env.TELEGRAM_LOG_MODE || 'all').trim().toLowerCase();
  return MODES.has(raw as NotifyMode) ? (raw as NotifyMode) : 'all';
}

@Injectable()
export class TelegramActionNotifierService {
  private readonly enabled = boolEnv('TELEGRAM_LOG_ENABLED', false);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  private readonly chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  private readonly mode = modeEnv();

  async notify(event: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.enabled || !this.token || !this.chatId) return;
    if (this.mode !== 'action') return;
    const lines = [`[action] ${event}`];
    if (data && Object.keys(data).length > 0) {
      lines.push(toText(data));
    }
    const text = lines.join('\n').slice(0, 3800);
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
    } catch {
      // swallow to avoid affecting request flow
    }
  }
}
