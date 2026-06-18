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

  const tokens =
    rest.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((s) => s.replace(/^"|"$/g, '')) ?? [];
  return { args: tokens, argsText: rest };
}
