/** Bỏ dấu tiếng Việt rồi slug ASCII — "Thông tin hệ thống" → "thong_tin_he_thong". */
export function asciiSlugKey(raw: string, maxLen = 48): string {
  const folded = raw
    .trim()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const t = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return t.length ? t.slice(0, maxLen) : '';
}
