export type AgentChromeScriptEntry = {
  id: string;
  name: string;
  startUrl?: string | null;
  steps: unknown[];
  savedPath?: string;
};

type Waiter = {
  resolve: (scripts: AgentChromeScriptEntry[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const waiters = new Map<string, Waiter>();

export function registerChromeScriptsWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentChromeScriptEntry[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(requestId);
      reject(new Error('Timeout chờ agent trả danh sách Chrome script'));
    }, timeoutMs);

    waiters.set(requestId, {
      resolve: (scripts) => {
        clearTimeout(timer);
        resolve(scripts);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyChromeScriptsResult(
  requestId: string,
  scripts: AgentChromeScriptEntry[],
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.resolve(scripts);
  return true;
}

export function failChromeScriptsWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = waiters.get(requestId);
  if (!waiter) return false;
  waiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}
