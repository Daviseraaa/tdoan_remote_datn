export type TaskTrendRange = '1H' | '24H' | '7D';

export interface TaskTrendPoint {
  at: string;
  date: string;
  completed: number;
  failed: number;
}

const RANGE_MS: Record<TaskTrendRange, number> = {
  '1H': 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

export const TASK_TREND_RANGES: TaskTrendRange[] = ['1H', '24H', '7D'];

/** Lọc bucket 7 ngày từ API theo khung thời gian (không gọi thêm API). */
export function filterTaskTrendByRange(
  trend: TaskTrendPoint[],
  range: TaskTrendRange,
): TaskTrendPoint[] {
  const since = Date.now() - RANGE_MS[range];
  return trend.filter((p) => new Date(p.at).getTime() >= since);
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function aggregateByHour(points: TaskTrendPoint[]): TaskTrendPoint[] {
  const byHour = new Map<number, { completed: number; failed: number }>();
  for (const p of points) {
    const d = new Date(p.at);
    d.setMinutes(0, 0, 0);
    const key = d.getTime();
    const cur = byHour.get(key) ?? { completed: 0, failed: 0 };
    cur.completed += p.completed;
    cur.failed += p.failed;
    byHour.set(key, cur);
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, counts]) => {
      const d = new Date(t);
      return {
        at: d.toISOString(),
        date: formatTimeLabel(d),
        completed: counts.completed,
        failed: counts.failed,
      };
    });
}

function aggregateByDay(points: TaskTrendPoint[]): TaskTrendPoint[] {
  const byDay = new Map<string, { completed: number; failed: number; sortKey: string }>();
  for (const p of points) {
    const d = new Date(p.at);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cur = byDay.get(sortKey) ?? { completed: 0, failed: 0, sortKey };
    cur.completed += p.completed;
    cur.failed += p.failed;
    byDay.set(sortKey, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, counts]) => {
      const [, m, day] = sortKey.split('-');
      return {
        at: `${sortKey}T00:00:00.000Z`,
        date: `${Number(m)}/${Number(day)}`,
        completed: counts.completed,
        failed: counts.failed,
      };
    });
}

export function taskTrendToChartData(
  points: TaskTrendPoint[],
  range: TaskTrendRange,
): Array<{ time: string; success: number; failure: number }> {
  const normalized =
    range === '24H' ? aggregateByHour(points) : range === '7D' ? aggregateByDay(points) : points;

  return normalized.map((p) => ({
    time: range === '7D' ? p.date : formatTimeLabel(new Date(p.at)),
    success: p.completed,
    failure: p.failed,
  }));
}

export function taskTrendRangeLabel(range: TaskTrendRange): string {
  switch (range) {
    case '1H':
      return 'Last hour';
    case '24H':
      return 'Last 24 hours';
    case '7D':
      return 'Last 7 days';
  }
}
