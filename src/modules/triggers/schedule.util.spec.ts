import { ScheduleKind } from '@prisma/client';
import { computeNextRunAt } from './schedule.util';

describe('computeNextRunAt', () => {
  const from = new Date('2026-05-20T06:00:00.000Z');

  it('interval adds seconds', () => {
    const next = computeNextRunAt(
      {
        scheduleKind: ScheduleKind.INTERVAL,
        intervalSeconds: 300,
        timezone: 'UTC',
      },
      from,
    );
    expect(next?.getTime()).toBe(from.getTime() + 300_000);
  });

  it('cron returns a future date', () => {
    const next = computeNextRunAt(
      {
        scheduleKind: ScheduleKind.CRON,
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      },
      from,
    );
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(from.getTime());
  });

  it('once returns null after runAt passed', () => {
    const next = computeNextRunAt(
      {
        scheduleKind: ScheduleKind.ONCE,
        runAt: new Date('2020-01-01T00:00:00Z'),
        timezone: 'UTC',
      },
      from,
    );
    expect(next).toBeNull();
  });
});
