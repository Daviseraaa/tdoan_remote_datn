/** UUID an toàn — crypto.randomUUID() không chạy trên HTTP (điện thoại qua LAN). */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* secure context required */
    }
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function randomIdShort(): string {
  return randomId().slice(0, 8);
}
