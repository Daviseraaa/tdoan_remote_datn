/** @typedef {'snapshotDom' | 'click' | 'fill' | 'waitFor' | 'delay'} ChromeAction */

const ACTIONS = new Set(['snapshotDom', 'click', 'fill', 'waitFor', 'delay']);

/**
 * @param {unknown} msg
 * @returns {{ ok: true, v: number, requestId: string, action: string, payload: Record<string, unknown> } | { ok: false, error: string }}
 */
export function parseRequest(msg) {
  if (!msg || typeof msg !== 'object') {
    return { ok: false, error: 'message must be object' };
  }
  const o = /** @type {Record<string, unknown>} */ (msg);
  const v = o.v;
  if (v !== 1) {
    return { ok: false, error: `unsupported v=${v}` };
  }
  const requestId = typeof o.requestId === 'string' ? o.requestId : '';
  if (!requestId) {
    return { ok: false, error: 'requestId required' };
  }
  const action = typeof o.action === 'string' ? o.action : '';
  if (!ACTIONS.has(action)) {
    return { ok: false, error: `unknown action: ${action}` };
  }
  const payload =
    o.payload && typeof o.payload === 'object' && !Array.isArray(o.payload)
      ? /** @type {Record<string, unknown>} */ (o.payload)
      : {};
  return { ok: true, v: 1, requestId, action, payload };
}

/**
 * @param {string} requestId
 * @param {boolean} ok
 * @param {unknown} [result]
 * @param {string} [error]
 */
export function buildResponse(requestId, ok, result, error) {
  const body = { v: 1, requestId, ok };
  if (ok) {
    body.result = result ?? {};
  } else {
    body.error = error ?? 'unknown error';
  }
  return body;
}
