/** Parse danh sách ID từ chuỗi phân tách dấu phẩy (UI). */
export function parseTelegramIdListText(text?: string | null): string[] {
  if (!text?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(',')) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeTelegramIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function telegramIdListToText(raw: unknown): string {
  return normalizeTelegramIdList(raw).join(', ');
}

export function isTelegramSenderAllowed(
  chatId: string,
  userId: string,
  allowedChatIds: unknown,
  allowedUserIds: unknown,
): boolean {
  const chats = normalizeTelegramIdList(allowedChatIds);
  const users = normalizeTelegramIdList(allowedUserIds);
  if (chats.length > 0 && !chats.includes(chatId)) return false;
  if (users.length > 0 && !users.includes(userId)) return false;
  return true;
}
