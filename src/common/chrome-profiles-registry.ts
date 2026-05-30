export type ChromeProfileEntry = {
  directory: string;
  name?: string;
};

type Waiter = {
  resolve: (profiles: ChromeProfileEntry[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const waiters = new Map<string, Waiter>();

export function registerChromeProfilesWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<ChromeProfileEntry[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(requestId);
      reject(new Error('Timeout chờ agent trả danh sách Chrome profile'));
    }, timeoutMs);

    waiters.set(requestId, {
      resolve: (profiles) => {
        clearTimeout(timer);
        resolve(profiles);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyChromeProfilesResult(
  requestId: string,
  profiles: ChromeProfileEntry[],
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.resolve(profiles);
  return true;
}

export function failChromeProfilesWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}
