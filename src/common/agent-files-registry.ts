export type AgentFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt?: number;
};

export type AgentFileReadPayload = {
  path: string;
  size: number;
  mimeType: string;
  encoding: 'utf-8' | 'base64' | string;
  content: string;
};

export type AgentFileWritePayload = {
  path: string;
  size: number;
  written: boolean;
};

export type AgentFileWriteRequest = {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64' | string;
  uploadId?: string;
  chunkIndex?: number;
  totalChunks?: number;
};

export type AgentFilesListResult = {
  path: string;
  root: string;
  entries: AgentFileEntry[];
};

type ListWaiter = {
  resolve: (result: AgentFilesListResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

type ReadWaiter = {
  resolve: (file: AgentFileReadPayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const listWaiters = new Map<string, ListWaiter>();
const readWaiters = new Map<string, ReadWaiter>();

type WriteWaiter = {
  resolve: (file: AgentFileWritePayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const writeWaiters = new Map<string, WriteWaiter>();

export function registerAgentFilesListWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentFilesListResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listWaiters.delete(requestId);
      reject(new Error('Timeout chờ agent liệt kê thư mục'));
    }, timeoutMs);

    listWaiters.set(requestId, {
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

export function notifyAgentFilesListResult(
  requestId: string,
  result: AgentFilesListResult,
): boolean {
  const waiter = listWaiters.get(requestId);
  if (!waiter) return false;
  listWaiters.delete(requestId);
  waiter.resolve(result);
  return true;
}

export function failAgentFilesListWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = listWaiters.get(requestId);
  if (!waiter) return false;
  listWaiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}

export function registerAgentFilesReadWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentFileReadPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      readWaiters.delete(requestId);
      reject(new Error('Timeout chờ agent đọc file'));
    }, timeoutMs);

    readWaiters.set(requestId, {
      resolve: (file) => {
        clearTimeout(timer);
        resolve(file);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyAgentFilesReadResult(
  requestId: string,
  file: AgentFileReadPayload,
): boolean {
  const waiter = readWaiters.get(requestId);
  if (!waiter) return false;
  readWaiters.delete(requestId);
  waiter.resolve(file);
  return true;
}

export function failAgentFilesReadWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = readWaiters.get(requestId);
  if (!waiter) return false;
  readWaiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}

export function normalizeAgentFileEntry(raw: unknown): AgentFileEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  const path = typeof row.path === 'string' ? row.path : '';
  if (!name || !path) return null;
  return {
    name,
    path,
    isDir: Boolean(row.isDir ?? row.is_dir),
    size: typeof row.size === 'number' ? row.size : Number(row.size) || 0,
    modifiedAt:
      typeof row.modifiedAt === 'number'
        ? row.modifiedAt
        : typeof row.modified_at === 'number'
          ? row.modified_at
          : undefined,
  };
}

export function registerAgentFilesWriteWaiter(
  requestId: string,
  timeoutMs: number,
): Promise<AgentFileWritePayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      writeWaiters.delete(requestId);
      reject(new Error('Timeout chờ agent ghi file'));
    }, timeoutMs);

    writeWaiters.set(requestId, {
      resolve: (file) => {
        clearTimeout(timer);
        resolve(file);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });
  });
}

export function notifyAgentFilesWriteResult(
  requestId: string,
  file: AgentFileWritePayload,
): boolean {
  const waiter = writeWaiters.get(requestId);
  if (!waiter) return false;
  writeWaiters.delete(requestId);
  waiter.resolve(file);
  return true;
}

export function failAgentFilesWriteWaiter(
  requestId: string,
  message: string,
): boolean {
  const waiter = writeWaiters.get(requestId);
  if (!waiter) return false;
  writeWaiters.delete(requestId);
  waiter.reject(new Error(message));
  return true;
}

export function normalizeAgentFileWritePayload(
  raw: unknown,
): AgentFileWritePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const path = typeof row.path === 'string' ? row.path : '';
  if (!path) return null;
  return {
    path,
    size: typeof row.size === 'number' ? row.size : Number(row.size) || 0,
    written: Boolean(row.written),
  };
}

export function normalizeAgentFileReadPayload(
  raw: unknown,
): AgentFileReadPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const path = typeof row.path === 'string' ? row.path : '';
  const content = typeof row.content === 'string' ? row.content : '';
  if (!path || !content) return null;
  return {
    path,
    content,
    size: typeof row.size === 'number' ? row.size : Number(row.size) || 0,
    mimeType:
      typeof row.mimeType === 'string'
        ? row.mimeType
        : typeof row.mime_type === 'string'
          ? row.mime_type
          : 'application/octet-stream',
    encoding:
      typeof row.encoding === 'string' ? row.encoding : 'base64',
  };
}
