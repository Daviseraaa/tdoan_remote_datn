export type AgentDesktopRecordingEntry = {
  id: string;
  name: string;
  steps: unknown[];
  savedPath?: string;
};

type Waiter = {
  resolve: (recordings: AgentDesktopRecordingEntry[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const waiters = new Map<string, Waiter>();

export function registerDesktopRecordingsWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentDesktopRecordingEntry[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(requestId);
      reject(new Error('Timeout chờ agent trả danh sách desktop recording'));
    }, timeoutMs);

    waiters.set(requestId, {
      resolve: (recordings) => {
        clearTimeout(timer);
        resolve(recordings);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyDesktopRecordingsResult(
  requestId: string,
  recordings: AgentDesktopRecordingEntry[],
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.resolve(recordings);
  return true;
}

export function failDesktopRecordingsWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}
