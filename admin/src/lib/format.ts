import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('vi');

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '-';
  return dayjs(value).format('DD/MM/YYYY HH:mm:ss');
}

export function formatRelative(value?: string | Date | null): string {
  if (!value) return '-';
  return dayjs(value).fromNow();
}

export function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}
