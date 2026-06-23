import { buildResponse, parseRequest } from './lib/protocol.js';

const MSG_BRIDGE_OFFLINE =
  'Chưa kết nối phần mềm trên máy. Chạy Cai-dat.bat trong gói cài đặt, tắt hết Chrome rồi mở lại.';

const MSG_SAVE_TIMEOUT =
  'Lưu script quá lâu. Chạy lại Cai-dat.bat, tắt hết Chrome rồi thử lại.';

const HOST_NAME = 'com.stationhub.chrome_bridge';
const RECONNECT_MS = 2000;

/** @type {chrome.runtime.Port | null} */
let nativePort = null;
/** @type {number | null} */
let recordingTabId = null;

/** @type {{ resolve: (v: unknown) => void; reject: (e: Error) => void } | null} */
let pendingRecordingSave = null;

/** @type {Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>} */
const pendingBridge = new Map();

function connectNative() {
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
  } catch (e) {
    console.warn('[StationHub] connectNative failed', e);
    setTimeout(connectNative, RECONNECT_MS);
    return;
  }

  nativePort.onMessage.addListener((msg) => {
    if (msg?.type === 'bridgeConnected') {
      console.log('[StationHub] bridge connected to agent');
      return;
    }
    if (msg?.type === 'recordingSaved') {
      if (pendingRecordingSave) {
        const pending = pendingRecordingSave;
        pendingRecordingSave = null;
        if (msg.ok) pending.resolve(msg);
        else pending.reject(new Error(msg.error || 'Lưu script thất bại'));
      }
      return;
    }

    if (msg?.type === 'chromeScriptsListed') {
      const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';
      const pending = pendingBridge.get(requestId);
      if (pending) {
        pendingBridge.delete(requestId);
        if (msg.ok) pending.resolve(msg);
        else pending.reject(new Error(msg.error || 'Lấy danh sách script thất bại'));
      }
      return;
    }

    if (msg?.type === 'chromeScriptDeleted') {
      const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';
      const pending = pendingBridge.get(requestId);
      if (pending) {
        pendingBridge.delete(requestId);
        if (msg.ok) pending.resolve(msg);
        else pending.reject(new Error(msg.error || 'Xóa script thất bại'));
      }
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
    console.warn('[StationHub] native port disconnected', chrome.runtime.lastError);
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

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'stationhub-record', action: 'recordStatus' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/stationhub-content.js'],
    });
  }
}

async function sendRecordToTab(tabId, action) {
  await ensureContentScript(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: 'stationhub-record', action });
  if (!response?.ok) {
    throw new Error(response?.error || 'content script failed');
  }
  return response.data;
}

async function sendRunToTab(tabId, action, payload) {
  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, {
      type: 'stationhub-run',
      action,
      payload,
    });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/stationhub-content.js'],
    });
    response = await chrome.tabs.sendMessage(tabId, {
      type: 'stationhub-run',
      action,
      payload,
    });
  }
  if (!response?.ok) {
    throw new Error(response?.error || 'content script failed');
  }
  return response.data;
}

function defaultScriptName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `recording-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function postRecordingComplete(script) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error(MSG_BRIDGE_OFFLINE));
      return;
    }
    if (pendingRecordingSave) {
      reject(new Error('Đang lưu script khác, thử lại sau vài giây'));
      return;
    }
    pendingRecordingSave = { resolve, reject };
    try {
      nativePort.postMessage({ type: 'recordingComplete', script });
    } catch (e) {
      pendingRecordingSave = null;
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    setTimeout(() => {
      if (!pendingRecordingSave) return;
      pendingRecordingSave = null;
      reject(new Error(MSG_SAVE_TIMEOUT));
    }, 30000);
  });
}

async function runRecordAction(action, tabIdHint) {
  const tabId = tabIdHint ?? (await resolveTabId(undefined, undefined));
  if (action === 'recordStart') {
    recordingTabId = tabId;
    return sendRecordToTab(tabId, 'recordStart');
  }
  if (action === 'recordStop') {
    const tid = recordingTabId ?? tabId;
    recordingTabId = null;
    const data = await sendRecordToTab(tid, 'recordStop');
    const script = {
      version: 1,
      name: defaultScriptName(),
      startUrl: data.startUrl || '',
      title: data.title || '',
      recordedAt: data.recordedAt || new Date().toISOString(),
      steps: data.steps || [],
    };
    const saved = await postRecordingComplete(script);
    return {
      ...data,
      id: saved.id,
      savedPath: saved.savedPath,
    };
  }
  if (action === 'recordStatus') {
    const tid = recordingTabId ?? tabId;
    try {
      return await sendRecordToTab(tid, 'recordStatus');
    } catch {
      return { recording: false, stepCount: 0 };
    }
  }
  throw new Error(`unknown popup action: ${action}`);
}

function makeRequestId() {
  return `req-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function callBridge(actionType, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error(MSG_BRIDGE_OFFLINE));
      return;
    }
    const requestId = makeRequestId();
    pendingBridge.set(requestId, { resolve, reject });
    try {
      nativePort.postMessage({ type: actionType, requestId, ...body });
    } catch (e) {
      pendingBridge.delete(requestId);
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    setTimeout(() => {
      const pending = pendingBridge.get(requestId);
      if (!pending) return;
      pendingBridge.delete(requestId);
      reject(new Error(`Timeout bridge action: ${actionType}`));
    }, timeoutMs);
  });
}

async function listRecordsFromBridge(limit = 20) {
  const res = await callBridge('listChromeScripts', { limit });
  return res?.scripts ?? [];
}

async function deleteRecordFromDisk(record) {
  const body = {};
  if (record?.savedPath) body.scriptPath = record.savedPath;
  else if (record?.id) body.id = record.id;
  else throw new Error('record thiếu id hoặc savedPath');
  await callBridge('deleteChromeScript', body);
}

async function sendReplayControl(tabId, action) {
  await ensureContentScript(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: 'stationhub-replay', action });
  if (!response?.ok) {
    throw new Error(response?.error || 'replay control failed');
  }
}

async function replayRecord(record) {
  const steps = Array.isArray(record?.steps) ? record.steps : [];
  if (!steps.length) throw new Error('Script không có steps');
  const urlPattern =
    typeof record?.startUrl === 'string' && record.startUrl
      ? record.startUrl.endsWith('/')
        ? `${record.startUrl}*`
        : `${record.startUrl}*`
      : undefined;

  let tabId;
  try {
    tabId = await resolveTabId(undefined, urlPattern);
  } catch {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active?.id) throw new Error('Không tìm được tab để chạy lại');
    tabId = active.id;
  }

  await sendReplayControl(tabId, 'begin');
  try {
    for (let i = 0; i < steps.length; i += 1) {
      const s = steps[i] || {};
      const action = typeof s.action === 'string' ? s.action : '';
      if (!action) throw new Error(`Step ${i} thiếu action`);

      const payload = {};
      if (action === 'click' || action === 'fill' || action === 'waitFor') {
        if (!s.selector) throw new Error(`Step ${i} thiếu selector`);
        payload.selector = s.selector;
        if (typeof s.selectorIndex === 'number') payload.selectorIndex = s.selectorIndex;
      }
      if (action === 'fill') {
        payload.text = typeof s.text === 'string' ? s.text : '';
      }
      if (action === 'waitFor') {
        if (s.timeoutMs != null) payload.timeoutMs = s.timeoutMs;
      }
      if (action === 'delay') {
        if (s.ms == null) throw new Error(`Step ${i} delay thiếu ms`);
        payload.ms = s.ms;
      }

      await sendRunToTab(tabId, action, payload);
    }
  } finally {
    await sendReplayControl(tabId, 'end');
  }
}

async function handleAgentRequest(requestId, action, payload) {
  if (action === 'recordStart' || action === 'recordStop' || action === 'recordStatus') {
    const tabId = await resolveTabId(
      typeof payload.tabId === 'number' ? payload.tabId : undefined,
      typeof payload.urlPattern === 'string' ? payload.urlPattern : undefined,
    );
    const data = await runRecordAction(action, tabId);
    nativePort?.postMessage(buildResponse(requestId, true, data));
    return;
  }

  const tabId = await resolveTabId(
    typeof payload.tabId === 'number' ? payload.tabId : undefined,
    typeof payload.urlPattern === 'string' ? payload.urlPattern : undefined,
  );

  const data = await sendRunToTab(tabId, action, payload);
  nativePort?.postMessage(buildResponse(requestId, true, data));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'stationhub-popup') return false;

  (async () => {
    try {
      if (msg.action === 'listRecords') {
        const scripts = await listRecordsFromBridge(20);
        sendResponse({ ok: true, data: { scripts } });
        return;
      }
      if (msg.action === 'runRecord') {
        await replayRecord(msg.record);
        sendResponse({ ok: true, data: { ok: true } });
        return;
      }
      if (msg.action === 'deleteRecord') {
        await deleteRecordFromDisk(msg.record);
        sendResponse({ ok: true, data: { ok: true } });
        return;
      }

      const data = await runRecordAction(msg.action);
      sendResponse({ ok: true, data });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});
