/** Nhãn phụ thời hạn (1 tháng, 3 tháng, …) — null nếu không khớp preset phổ biến. */
export function planDurationSubLabel(days: number): string | null {
  if (days === 1) return '1 ngày';
  if (days === 7) return '1 tuần';
  if (days === 30) return '1 tháng';
  if (days === 90) return '3 tháng';
  if (days === 180) return '6 tháng';
  if (days === 365) return '12 tháng';
  if (days >= 365 && days % 365 === 0) return `${days / 365} năm`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} tháng`;
  return null;
}

export const PLAN_DURATION_PRESETS = [7, 30, 90, 365] as const;

export function formatMaxAgents(n: number): string {
  return n === 1 ? '1 agent' : `${n} agent`;
}
