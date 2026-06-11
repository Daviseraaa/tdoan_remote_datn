export type AgentRemoteStartResult = {
  provider: string;
  message?: string;
  rustdeskId?: string;
  rustdeskPassword?: string;
};

type RemoteStartWaiter = {
  resolve: (result: AgentRemoteStartResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const remoteStartWaiters = new Map<string, RemoteStartWaiter>();

export function registerAgentRemoteStartWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentRemoteStartResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      remoteStartWaiters.delete(requestId);
      reject(new Error('Timeout chờ agent khởi động remote'));
    }, timeoutMs);

    remoteStartWaiters.set(requestId, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyAgentRemoteStartResult(
  requestId: string,
  result: AgentRemoteStartResult,
): boolean {
  const waiter = remoteStartWaiters.get(requestId);
  if (!waiter) return false;
  remoteStartWaiters.delete(requestId);
  waiter.resolve(result);
  return true;
}

export function failAgentRemoteStartWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = remoteStartWaiters.get(requestId);
  if (!waiter) return false;
  remoteStartWaiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}

const remoteStopWaiters = new Map<string, RemoteStartWaiter>();

export function registerAgentRemoteStopWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentRemoteStartResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      remoteStopWaiters.delete(requestId);
      reject(new Error('Timeout chờ agent dừng remote'));
    }, timeoutMs);

    remoteStopWaiters.set(requestId, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyAgentRemoteStopResult(
  requestId: string,
  result: AgentRemoteStartResult,
): boolean {
  const waiter = remoteStopWaiters.get(requestId);
  if (!waiter) return false;
  remoteStopWaiters.delete(requestId);
  waiter.resolve(result);
  return true;
}

export function failAgentRemoteStopWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = remoteStopWaiters.get(requestId);
  if (!waiter) return false;
  remoteStopWaiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}
