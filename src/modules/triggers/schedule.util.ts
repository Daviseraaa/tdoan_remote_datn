import CronExpressionParser from 'cron-parser';
import { ScheduleKind } from '@prisma/client';

function nextCronDate(expression: string, from: Date, tz: string): Date | null {
  try {
    const expr = CronExpressionParser.parse(expression, { currentDate: from, tz });
    return expr.next().toDate();
  } catch {
    return null;
  }
}

export function computeNextRunAt(
  trigger: {
    scheduleKind: ScheduleKind | null;
    cronExpression?: string | null;
    intervalSeconds?: number | null;
    runAt?: Date | null;
    dailyHour?: number | null;
    dailyMinute?: number | null;
    timezone: string;
  },
  from: Date = new Date(),
): Date | null {
  const tz = trigger.timezone || 'UTC';
  const kind = trigger.scheduleKind;

  if (!kind) return null;

  if (kind === ScheduleKind.ONCE) {
    if (!trigger.runAt) return null;
    const at = new Date(trigger.runAt);
    return at > from ? at : null;
  }

  if (kind === ScheduleKind.INTERVAL && trigger.intervalSeconds) {
    return new Date(from.getTime() + trigger.intervalSeconds * 1000);
  }

  if (kind === ScheduleKind.CRON && trigger.cronExpression?.trim()) {
    return nextCronDate(trigger.cronExpression.trim(), from, tz);
  }

  if (kind === ScheduleKind.DAILY) {
    const hour = trigger.dailyHour ?? 8;
    const minute = trigger.dailyMinute ?? 0;
    return nextCronDate(`${minute} ${hour} * * *`, from, tz);
  }

  if (kind === ScheduleKind.HOURLY) {
    return nextCronDate('0 * * * *', from, tz);
  }

  return null;
}
