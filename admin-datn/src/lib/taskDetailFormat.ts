/** Giống admin/src/lib/format.ts — không thêm dayjs. */
export function formatTaskDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

export function formatTaskDurationMs(ms?: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

export interface TaskLogLike {
  id?: string;
  createdAt: string;
  level: string;
  message: string;
}

export function dedupeTaskLogs(logs: TaskLogLike[] | undefined): TaskLogLike[] {
  if (!logs?.length) return [];
  const seen = new Set<string>();
  return logs.filter((log) => {
    const key = `${log.createdAt}|${log.level}|${log.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
