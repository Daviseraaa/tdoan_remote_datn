import { buildResponse, parseRequest } from './lib/protocol.js';

const HOST_NAME = 'com.datn.chrome_bridge';
const RECONNECT_MS = 2000;

/** @type {chrome.runtime.Port | null} */
let nativePort = null;

function connectNative() {
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
  } catch (e) {
    console.warn('[DATN] connectNative failed', e);
    setTimeout(connectNative, RECONNECT_MS);
    return;
  }

  nativePort.onMessage.addListener((msg) => {
    if (msg?.type === 'bridgeConnected') {
      console.log('[DATN] bridge connected to agent');
      return;
    }
    const parsed = parseRequest(msg);
    if (!parsed.ok) {
      nativePort?.postMessage(
        buildResponse(
          typeof msg?.requestId === 'string' ? msg.requestId : 'unknown',
          false,
          null,
          parsed.error,
        ),
      );
      return;
    }
    handleAgentRequest(parsed.requestId, parsed.action, parsed.payload).catch((err) => {
      nativePort?.postMessage(
        buildResponse(parsed.requestId, false, null, err?.message || String(err)),
      );
    });
  });

  nativePort.onDisconnect.addListener(() => {
    nativePort = null;
    console.warn('[DATN] native port disconnected', chrome.runtime.lastError);
    setTimeout(connectNative, RECONNECT_MS);
  });
}

connectNative();

async function resolveTabId(tabId, urlPattern) {
  if (typeof tabId === 'number' && tabId > 0) {
    try {
      await chrome.tabs.get(tabId);
      return tabId;
    } catch {
      /* fall through */
    }
  }
  if (urlPattern) {
    const tabs = await chrome.tabs.query({});
    const match = tabs.find((t) => t.url && matchUrlPattern(t.url, urlPattern));
    if (match?.id) return match.id;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id) return active.id;
  throw new Error('no matching tab');
}

function matchUrlPattern(url, pattern) {
  if (!pattern || pattern === '*') return true;
  if (pattern.endsWith('*')) {
    return url.startsWith(pattern.slice(0, -1));
  }
  return url === pattern || url.startsWith(pattern);
}

async function handleAgentRequest(requestId, action, payload) {
  const tabId = await resolveTabId(
    typeof payload.tabId === 'number' ? payload.tabId : undefined,
    typeof payload.urlPattern === 'string' ? payload.urlPattern : undefined,
  );

  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, {
      type: 'datn-run',
      action,
      payload,
    });
  } catch (e) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/datn-content.js'],
    });
    response = await chrome.tabs.sendMessage(tabId, {
      type: 'datn-run',
      action,
      payload,
    });
  }

  if (!response?.ok) {
    throw new Error(response?.error || 'content script failed');
  }
  nativePort?.postMessage(buildResponse(requestId, true, response.data));
}
