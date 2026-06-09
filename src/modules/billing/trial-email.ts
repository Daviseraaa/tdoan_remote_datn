/** Chuẩn hóa email để chống đăng ký trial trùng (gmail alias, +tag, hoa/thường). */
export function normalizeTrialEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  local = local.split('+')[0] ?? local;

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    return `${local}@gmail.com`;
  }

  return `${local}@${domain}`;
}
