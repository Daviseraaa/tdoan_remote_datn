export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

export const HTTP_METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PUT: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  PATCH: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  HEAD: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export type HeaderRow = { key: string; value: string };

export function methodAllowsBody(method: HttpMethod): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

export function headersJsonToRows(headersJson: string): HeaderRow[] {
  const rows: HeaderRow[] = [];
  const trimmed = headersJson.trim();
  if (trimmed && trimmed !== '{}') {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          rows.push({ key: k, value: v != null ? String(v) : '' });
        }
      }
    } catch {
      /* giữ rows rỗng */
    }
  }
  rows.push({ key: '', value: '' });
  return rows;
}

export function rowsToHeadersJson(rows: HeaderRow[]): string {
  const obj: Record<string, string> = {};
  for (const { key, value } of rows) {
    const k = key.trim();
    if (!k) continue;
    obj[k] = value;
  }
  return Object.keys(obj).length === 0 ? '{}' : JSON.stringify(obj, null, 2);
}

export function formatJsonBody(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

export type HttpRequestPayload = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  url?: string;
};

export function parseHttpRequestPayload(
  payload: Record<string, unknown> | null | undefined,
): { method: HttpMethod; headersJson: string; body: string } {
  const method =
    typeof payload?.method === 'string' &&
    HTTP_METHODS.includes(payload.method.toUpperCase() as HttpMethod)
      ? (payload.method.toUpperCase() as HttpMethod)
      : 'GET';

  let headersJson = '{}';
  if (payload?.headers && typeof payload.headers === 'object' && !Array.isArray(payload.headers)) {
    try {
      headersJson = JSON.stringify(payload.headers, null, 2);
    } catch {
      headersJson = '{}';
    }
  }

  let body = '';
  if (typeof payload?.body === 'string') {
    body = payload.body;
  } else if (payload?.body != null) {
    try {
      body = JSON.stringify(payload.body, null, 2);
    } catch {
      body = String(payload.body);
    }
  }

  return { method, headersJson, body };
}

export function buildHttpRequestPayload(
  method: HttpMethod,
  headersJson: string,
  body: string,
): HttpRequestPayload {
  const payload: HttpRequestPayload = { method };

  const trimmedHeaders = headersJson.trim();
  if (trimmedHeaders && trimmedHeaders !== '{}') {
    try {
      const parsed = JSON.parse(trimmedHeaders) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (v != null) headers[k] = String(v);
        }
        if (Object.keys(headers).length > 0) payload.headers = headers;
      }
    } catch {
      /* bỏ qua headers không hợp lệ — validate ở form */
    }
  }

  const trimmedBody = body.trim();
  if (trimmedBody) payload.body = trimmedBody;

  return payload;
}

export function validateHttpHeadersJson(headersJson: string): string | null {
  const trimmed = headersJson.trim();
  if (!trimmed || trimmed === '{}') return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Headers phải là object JSON';
    }
    return null;
  } catch {
    return 'Headers JSON không hợp lệ';
  }
}
