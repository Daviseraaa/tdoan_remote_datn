type PinoLogMethod = (this: unknown, ...args: unknown[]) => void;

type PinoLogHook = (
  args: Parameters<PinoLogMethod>,
  method: PinoLogMethod,
  level: number,
) => void;

const LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const MODES = new Set(['all', 'action']);

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function textArg(v: unknown): string {
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

function trimForTelegram(s: string, max = 3800): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function createSender(serviceName: string): (level: number, args: unknown[]) => void {
  const enabled = boolEnv('TELEGRAM_LOG_ENABLED', false);
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const minLevelName = (process.env.TELEGRAM_LOG_MIN_LEVEL || 'error')
    .trim()
    .toLowerCase();
  const minLevel = LEVELS[minLevelName] ?? LEVELS.error;
  const modeRaw = (process.env.TELEGRAM_LOG_MODE || 'all').trim().toLowerCase();
  const mode = MODES.has(modeRaw) ? modeRaw : 'all';

  if (!enabled || !token || !chatId || mode !== 'all') {
    return () => undefined;
  }

  return (level: number, args: unknown[]) => {
    if (level < minLevel) return;
    const body = trimForTelegram(
      [`[${serviceName}]`, `level=${level}`, ...args.map((a) => textArg(a))].join('\n'),
    );
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    }).catch(() => undefined);
  };
}

export function createPinoTelegramHook(serviceName: string): PinoLogHook {
  const send = createSender(serviceName);
  return function logMethod(this: unknown, args, method, level) {
    method.apply(this, args);
    send(level, args);
  };
}
