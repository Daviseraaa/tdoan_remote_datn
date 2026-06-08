import { TaskStatus } from '@prisma/client';

export type TaskTerminalOutcome = {
  status: TaskStatus;
  exitCode: number | null;
  result?: string;
  error?: string;
};

type Waiter = {
  resolve: (outcome: TaskTerminalOutcome) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

/** Nhiều listener / task (workflow wait + Bull worker). */
const waiters = new Map<string, Waiter[]>();

function removeWaiter(taskId: string, entry: Waiter) {
  const list = waiters.get(taskId);
  if (!list) return;
  const next = list.filter((w) => w !== entry);
  if (next.length) waiters.set(taskId, next);
  else waiters.delete(taskId);
}

export function registerTaskCompletionWaiter(
  taskId: string,
  timeoutMs: number,
): Promise<TaskTerminalOutcome> {
  return new Promise((resolve, reject) => {
    const deadline = Math.min(timeoutMs + 30_000, 600_000);
    const entry: Waiter = {
      resolve: (outcome) => {
        clearTimeout(entry.timer);
        removeWaiter(taskId, entry);
        resolve(outcome);
      },
      reject: (err) => {
        clearTimeout(entry.timer);
        removeWaiter(taskId, entry);
        reject(err);
      },
      timer: setTimeout(() => {
        removeWaiter(taskId, entry);
        reject(new Error('Timed out waiting for task'));
      }, deadline),
    };

    const list = waiters.get(taskId) ?? [];
    list.push(entry);
    waiters.set(taskId, list);
  });
}

export function notifyTaskCompleted(
  taskId: string,
  outcome: TaskTerminalOutcome,
): boolean {
  const list = waiters.get(taskId);
  if (!list?.length) return false;
  waiters.delete(taskId);
  for (const w of list) {
    clearTimeout(w.timer);
    w.resolve(outcome);
  }
  return true;
}
