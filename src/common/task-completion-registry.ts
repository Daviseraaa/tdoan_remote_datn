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

const waiters = new Map<string, Waiter>();

export function registerTaskCompletionWaiter(
  taskId: string,
  timeoutMs: number,
): Promise<TaskTerminalOutcome> {
  return new Promise((resolve, reject) => {
    const deadline = Math.min(timeoutMs + 30_000, 600_000);
    const timer = setTimeout(() => {
      waiters.delete(taskId);
      reject(new Error('Workflow step timed out waiting for task'));
    }, deadline);

    waiters.set(taskId, {
      resolve: (outcome) => {
        clearTimeout(timer);
        resolve(outcome);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyTaskCompleted(
  taskId: string,
  outcome: TaskTerminalOutcome,
): boolean {
  const waiter = waiters.get(taskId);
  if (!waiter) return false;
  waiters.delete(taskId);
  waiter.resolve(outcome);
  return true;
}
