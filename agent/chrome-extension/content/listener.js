import { runAction } from './dom-bridge.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'stationhub-run') return false;
  const action = msg.action;
  const payload = msg.payload || {};
  runAction(action, payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
});
