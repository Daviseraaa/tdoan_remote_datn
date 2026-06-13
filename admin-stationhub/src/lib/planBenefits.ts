/** Chuẩn hóa benefits từ API (JSON array). */
export function normalizePlanBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseBenefitsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function benefitsToText(benefits?: string[] | null): string {
  return benefits?.join('\n') ?? '';
}
