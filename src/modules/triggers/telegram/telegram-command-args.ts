/**
 * Tách tham số sau lệnh Telegram.
 * Hỗ trợ quote ASCII và smart quote từ mobile:
 * `/run doc "Tin nhắn có dấu"` hoặc `/run doc “Tin nhắn có dấu”`
 * → `['doc', 'Tin nhắn có dấu']`.
 */
export function tokenizeTelegramCommandArgs(rest: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = rest.trim();
  const quotePairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    '“': '”',
    '‘': '’',
  };

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;

    const ch = s[i];
    const quoteEnd = quotePairs[ch];
    if (quoteEnd) {
      i += 1;
      let buf = '';
      while (i < s.length) {
        if (s[i] === quoteEnd) {
          if (quoteEnd === "'" && i + 1 < s.length && s[i + 1] === "'") {
            buf += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        if ((quoteEnd === '"' || quoteEnd === '”') && s[i] === '\\' && i + 1 < s.length) {
          i += 1;
          buf += s[i];
          i += 1;
          continue;
        }
        buf += s[i];
        i += 1;
      }
      tokens.push(buf);
      continue;
    }

    let buf = '';
    while (i < s.length && !/\s/.test(s[i])) {
      buf += s[i];
      i += 1;
    }
    if (buf) tokens.push(buf);
  }

  return tokens;
}

/** Tách tham số sau lệnh Telegram — `/run foo bar` → args `['foo','bar']`, argsText `foo bar`. */
export function extractTelegramCommandArgs(
  text?: string,
  command?: string,
): { args: string[]; argsText: string } {
  if (!text?.trim()) return { args: [], argsText: '' };

  let rest = text.trim();
  const cmdBase = command?.split('@')[0]?.trim();

  if (cmdBase) {
    const escaped = cmdBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withBot = new RegExp(`^${escaped}(?:@\\w+)?\\s*`, 'i');
    if (withBot.test(rest)) {
      rest = rest.replace(withBot, '').trim();
    }
  } else if (rest.startsWith('/')) {
    rest = rest.replace(/^\/\S+(?:@\w+)?\s*/, '').trim();
  }

  if (!rest) return { args: [], argsText: '' };

  const tokens = tokenizeTelegramCommandArgs(rest);
  return { args: tokens, argsText: rest };
}
