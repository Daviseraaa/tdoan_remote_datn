/**
 * Content script gộp (classic script — không dùng import/export).
 * Chrome inject qua manifest và scripting.executeScript đều chạy được.
 */
(function () {
  if (window.__STATIONHUB_CONTENT_LOADED__) return;
  window.__STATIONHUB_CONTENT_LOADED__ = true;

  const MAX_TEXT = 500;
  const INTERACTIVE =
    'a[href], button, input:not([type=hidden]):not([type=password]), select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [tabindex]:not([tabindex="-1"])';

  function truncateText(s) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= MAX_TEXT) return t;
    return `${t.slice(0, MAX_TEXT)}…`;
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function pickStableClasses(el) {
    if (!(el instanceof Element) || !el.classList?.length) return [];
    const raw = Array.from(el.classList);
    const stable = raw.filter((c) => {
      if (!c || c.length < 2) return false;
      if (/^(active|selected|hover|focus|open|show|hide|disabled|ng-|v-|jsx-)/i.test(c)) return false;
      if (/^[a-f0-9]{6,}$/i.test(c)) return false;
      if (/^css-[a-z0-9]+$/i.test(c)) return false;
      if (/__[\w-]{6,}/.test(c)) return false;
      return true;
    });
    stable.sort((a, b) => b.length - a.length);
    return stable.slice(0, 2);
  }

  function selectorMatchesCount(sel) {
    if (!sel) return 0;
    try {
      return document.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  }

  function segmentForElement(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;

    let part = el.tagName.toLowerCase();
    const testId = el.getAttribute('data-testid');
    if (testId) return `${part}[data-testid="${CSS.escape(testId)}"]`;

    const name = el.getAttribute('name');
    if (name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
      return `${part}[name="${CSS.escape(name)}"]`;
    }

    const classes = pickStableClasses(el);
    for (const cls of classes) {
      part += `.${CSS.escape(cls)}`;
    }

    const type = el.getAttribute('type');
    if (type && el.tagName === 'INPUT') {
      part += `[type="${CSS.escape(type)}"]`;
    }
    const role = el.getAttribute('role');
    if (role) part += `[role="${CSS.escape(role)}"]`;

    const parent = el.parentElement;
    if (parent) {
      const children = Array.from(parent.children);
      const peers = children.filter((child) => {
        if (!(child instanceof Element) || child.tagName !== el.tagName) return false;
        return classes.every((c) => child.classList.contains(c));
      });
      if (peers.length > 1) {
        const nth = children.indexOf(el) + 1;
        if (nth > 0) part += `:nth-child(${nth})`;
      }
    }
    return part;
  }

  /** Selector ưu tiên duy nhất trên trang; leo DOM + class + nth-child. */
  function buildSelector(el) {
    if (!(el instanceof Element)) return '';

    const quick = [
      el.id ? `#${CSS.escape(el.id)}` : null,
      el.getAttribute('data-testid')
        ? `[data-testid="${CSS.escape(el.getAttribute('data-testid'))}"]`
        : null,
    ].filter(Boolean);
    for (const q of quick) {
      if (selectorMatchesCount(q) === 1) return q;
    }

    const path = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE && cur !== document.documentElement) {
      path.unshift(segmentForElement(cur));
      const candidate = path.join(' > ');
      const n = selectorMatchesCount(candidate);
      if (n === 1) return candidate;
      if (n === 0) break;
      cur = cur.parentElement;
      if (path.length >= 14) break;
    }

    if (path.length) return path.join(' > ');

    const aria = el.getAttribute('aria-label');
    if (aria) {
      const s = `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
      if (selectorMatchesCount(s) >= 1) return s;
    }
    return segmentForElement(el) || el.tagName.toLowerCase();
  }

  function recordSelectorTarget(el) {
    const selector = buildSelector(el);
    const matches = selector ? Array.from(document.querySelectorAll(selector)) : [];
    const step = { selector };
    if (matches.length > 1) {
      const idx = matches.indexOf(el);
      step.selectorIndex = idx >= 0 ? idx : 0;
    }
    return step;
  }

  function resolveElements(payload) {
    const sel = typeof payload.selector === 'string' ? payload.selector : '';
    if (!sel) throw new Error('selector required');
    let list;
    try {
      list = Array.from(document.querySelectorAll(sel));
    } catch (e) {
      throw new Error(`selector invalid: ${sel}`);
    }
    if (!list.length) throw new Error(`element not found: ${sel}`);

    const visible = list.filter((el) => isVisible(el));
    const pool = visible.length ? visible : list;

    if (pool.length === 1) return pool[0];

    const idx = payload.selectorIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < pool.length) {
      return pool[idx];
    }

    throw new Error(
      `selector ambiguous (${pool.length} matches): ${sel} — ghi lại sau khi trang ổn định`,
    );
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function randomDelay(min = 50, max = 200) {
    return sleep(min + Math.floor(Math.random() * (max - min)));
  }

  function snapshotDom(payload) {
    const maxNodes = Math.min(Number(payload.maxNodes) || 200, 500);
    const interactiveOnly = payload.interactiveOnly !== false;
    const rootSel = typeof payload.selector === 'string' ? payload.selector : '';
    const root = rootSel ? document.querySelector(rootSel) : document.body;
    if (!root) throw new Error(`selector not found: ${rootSel}`);
    const list = interactiveOnly
      ? root.querySelectorAll(INTERACTIVE)
      : root.querySelectorAll('*');
    const nodes = [];
    let index = 0;
    for (const el of list) {
      if (!(el instanceof Element)) continue;
      if (el.matches('input[type=password]')) continue;
      if (interactiveOnly && !isVisible(el)) continue;
      const tag = el.tagName.toLowerCase();
      const text = truncateText(el.textContent || '');
      const inputVal =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.type === 'password'
            ? ''
            : truncateText(el.value || '')
          : undefined;
      const rect = el.getBoundingClientRect();
      nodes.push({
        index,
        tag,
        selector: buildSelector(el),
        text: text || inputVal || '',
        role: el.getAttribute('role') || tag,
        href: el instanceof HTMLAnchorElement ? el.href : null,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        visible: isVisible(el),
        disabled:
          (el instanceof HTMLButtonElement ||
            el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement) &&
          !!el.disabled,
      });
      index += 1;
      if (nodes.length >= maxNodes) break;
    }
    return { url: location.href, title: document.title, nodes };
  }

  function resolveElement(payload) {
    const el = resolveElements(payload);
    if (!isVisible(el)) throw new Error(`element not visible: ${payload.selector}`);
    return el;
  }

  async function clickEl(payload) {
    const el = resolveElement(payload);
    if (
      (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
      el.disabled
    ) {
      throw new Error('element disabled');
    }
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    await sleep(80);
    el.click();
    return { clicked: true, selector: payload.selector };
  }

  async function fillEl(payload) {
    const el = resolveElement(payload);
    const text = typeof payload.text === 'string' ? payload.text : '';
    if (el instanceof HTMLSelectElement) {
      el.focus();
      el.value = text;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { filled: true, selector: payload.selector };
    }
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      throw new Error('fill requires input, textarea, or select');
    }
    if (el.type === 'password') throw new Error('cannot fill password field');
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const want = text === 'true' || text === '1' || text === 'on';
      el.checked = want;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { filled: true, selector: payload.selector };
    }
    el.focus();
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { filled: true, selector: payload.selector };
  }

  async function waitForEl(payload) {
    const sel = typeof payload.selector === 'string' ? payload.selector : '';
    const timeoutMs = Math.min(Number(payload.timeoutMs) || 10000, 120000);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      let el;
      try {
        el = resolveElements({ selector: sel, selectorIndex: payload.selectorIndex });
      } catch {
        el = null;
      }
      if (el && isVisible(el)) {
        if (!recording) {
          ensureHoverUI();
          setHoverStyle('replay');
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          updateHoverUI(el, { mode: 'replay', action: 'waitFor' });
          await sleep(320);
        }
        return { found: true, selector: sel };
      }
      await sleep(200);
    }
    throw new Error(`timeout waiting for: ${sel}`);
  }

  async function runAction(action, payload) {
    const interactive = action === 'click' || action === 'fill' || action === 'waitFor';
    if (!recording && interactive) {
      await previewStepTarget(payload, action);
    }

    let result;
    switch (action) {
      case 'snapshotDom':
        result = snapshotDom(payload);
        break;
      case 'click':
        await randomDelay();
        result = await clickEl(payload);
        break;
      case 'fill':
        await randomDelay();
        result = await fillEl(payload);
        break;
      case 'waitFor':
        result = await waitForEl(payload);
        break;
      case 'delay':
        await sleep(Number(payload.ms) || 0);
        result = { ok: true };
        break;
      default:
        throw new Error(`unknown action: ${action}`);
    }

    if (!recording && replayBatchDepth === 0 && interactive) {
      await sleep(160);
      hideHoverUI();
    }
    return result;
  }

  /** --- Recorder --- */
  let recording = false;
  /** @type {{ action: string, selector?: string, text?: string, ms?: number }[]} */
  let recordedSteps = [];
  let recordStartUrl = '';
  let recordTitle = '';
  let lastStepTs = 0;
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const fillDebounce = new Map();
  /** @type {((e: Event) => void) | null} */
  let onRecordClick = null;
  /** @type {((e: Event) => void) | null} */
  let onRecordInput = null;
  /** @type {((e: Event) => void) | null} */
  let onRecordChange = null;

  function shouldSkipRecordTarget(el) {
    if (!(el instanceof Element)) return true;
    if (el.closest('[data-stationhub-no-record]')) return true;
    if (el.closest('#stationhub-recorder-badge')) return true;
    if (el.closest('#stationhub-recorder-hover-root')) return true;
    const tag = el.tagName;
    if (tag === 'HTML' || tag === 'BODY') return true;
    if (el instanceof HTMLInputElement && el.type === 'password') return true;
    return false;
  }

  /** @type {HTMLElement | null} */
  let hoverBoxEl = null;
  /** @type {HTMLElement | null} */
  let hoverLabelEl = null;
  /** @type {((e: MouseEvent) => void) | null} */
  let onRecordMouseMove = null;
  let replayBatchDepth = 0;

  function setHoverStyle(mode) {
    if (!hoverBoxEl || !hoverLabelEl) return;
    if (mode === 'replay') {
      hoverBoxEl.style.borderColor = '#22c55e';
      hoverBoxEl.style.background = 'rgba(34, 197, 94, 0.18)';
      hoverLabelEl.style.background = '#14532d';
    } else {
      hoverBoxEl.style.borderColor = '#3b82f6';
      hoverBoxEl.style.background = 'rgba(59, 130, 246, 0.14)';
      hoverLabelEl.style.background = '#1e3a8a';
    }
  }

  async function previewStepTarget(payload, action) {
    const sel = typeof payload?.selector === 'string' ? payload.selector : '';
    if (!sel) return;
    ensureHoverUI();
    setHoverStyle('replay');
    let el;
    try {
      el = resolveElements(payload);
    } catch {
      return;
    }
    if (!(el instanceof Element) || !isVisible(el)) return;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    updateHoverUI(el, { mode: 'replay', action });
    const ms = Math.min(Math.max(Number(payload?.previewMs) || 450, 120), 2500);
    await sleep(ms);
  }

  function elementLabel(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    const testId = el.getAttribute('data-testid');
    if (testId) return `${tag}[data-testid="${testId}"]`;
    const name = el.getAttribute('name');
    if (name && (tag === 'input' || tag === 'select' || tag === 'textarea')) {
      return `${tag}[name="${name}"]`;
    }
    const aria = el.getAttribute('aria-label');
    if (aria) return `${tag} — ${truncateText(aria, 48)}`;
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return `${tag} — ${truncateText(placeholder, 48)}`;
    const role = el.getAttribute('role');
    const text = truncateText((el.textContent || '').replace(/\s+/g, ' ').trim(), 40);
    if (text && (tag === 'button' || tag === 'a' || role === 'button' || role === 'link')) {
      return `${tag} — "${text}"`;
    }
    if (el instanceof HTMLInputElement) {
      const t = el.type || 'text';
      if (el.value) return `input[${t}] — ${truncateText(el.value, 32)}`;
      return `input[${t}]`;
    }
    if (el instanceof HTMLSelectElement) {
      const opt = el.options[el.selectedIndex];
      if (opt?.text) return `select — ${truncateText(opt.text, 40)}`;
      return 'select';
    }
    const sel = buildSelector(el);
    return sel || tag;
  }

  function ensureHoverUI() {
    if (hoverBoxEl && hoverLabelEl) return;
    const root = document.createElement('div');
    root.id = 'stationhub-recorder-hover-root';
    root.setAttribute('data-stationhub-no-record', '1');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;';

    const box = document.createElement('div');
    box.id = 'stationhub-recorder-hover-box';
    box.style.cssText =
      'position:fixed;display:none;box-sizing:border-box;border:2px solid #3b82f6;background:rgba(59,130,246,0.14);border-radius:2px;pointer-events:none;transition:left 40ms ease,top 40ms ease,width 40ms ease,height 40ms ease;';

    const label = document.createElement('div');
    label.id = 'stationhub-recorder-hover-label';
    label.style.cssText =
      'position:fixed;display:none;max-width:min(420px,calc(100vw - 16px));padding:4px 8px;background:#1e3a8a;color:#fff;font:11px/1.35 ui-monospace,Consolas,monospace;border-radius:4px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.35);';

    root.appendChild(box);
    root.appendChild(label);
    document.documentElement.appendChild(root);
    hoverBoxEl = box;
    hoverLabelEl = label;
  }

  function hideHoverUI() {
    if (hoverBoxEl) hoverBoxEl.style.display = 'none';
    if (hoverLabelEl) hoverLabelEl.style.display = 'none';
  }

  function teardownHoverUI() {
    hideHoverUI();
    if (onRecordMouseMove) {
      document.removeEventListener('mousemove', onRecordMouseMove, true);
      onRecordMouseMove = null;
    }
    const root = document.getElementById('stationhub-recorder-hover-root');
    if (root) root.remove();
    hoverBoxEl = null;
    hoverLabelEl = null;
  }

  function updateHoverUI(el, opts) {
    if (!hoverBoxEl || !hoverLabelEl) return;
    const mode = opts?.mode || (recording ? 'record' : 'replay');
    setHoverStyle(mode);
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) {
      hideHoverUI();
      return;
    }

    hoverBoxEl.style.display = 'block';
    hoverBoxEl.style.left = `${rect.left}px`;
    hoverBoxEl.style.top = `${rect.top}px`;
    hoverBoxEl.style.width = `${rect.width}px`;
    hoverBoxEl.style.height = `${rect.height}px`;

    const prefix = opts?.action ? `[${opts.action}] ` : '';
    let label = `${prefix}${elementLabel(el)}`;
    if (mode === 'record') {
      const sel = buildSelector(el);
      const n = selectorMatchesCount(sel);
      if (sel) {
        label += n > 1 ? `\n⚠ ${n} phần tử — sẽ lưu index` : `\n✓ ${sel}`;
      }
    }
    hoverLabelEl.textContent = label;
    hoverLabelEl.style.whiteSpace = mode === 'record' && label.includes('\n') ? 'pre-wrap' : 'nowrap';
    hoverLabelEl.style.display = 'block';
    hoverLabelEl.style.left = `${Math.max(4, rect.left)}px`;
    hoverLabelEl.style.top = `${rect.top}px`;
    if (rect.top < 28) {
      hoverLabelEl.style.transform = `translateY(${rect.height + 4}px)`;
    } else {
      hoverLabelEl.style.transform = 'translateY(calc(-100% - 4px))';
    }
  }

  function pickRecordTarget(clientX, clientY) {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
      if (!(node instanceof Element)) continue;
      if (shouldSkipRecordTarget(node)) continue;
      return node;
    }
    return null;
  }

  function clampDelay(ms) {
    return Math.max(100, Math.min(30000, ms));
  }

  function pushDelaySince(ts) {
    if (lastStepTs > 0 && ts > lastStepTs) {
      recordedSteps.push({ action: 'delay', ms: clampDelay(ts - lastStepTs) });
    }
    lastStepTs = ts;
  }

  function pushStep(step) {
    const ts = Date.now();
    pushDelaySince(ts);
    recordedSteps.push(step);
    lastStepTs = ts;
    updateRecorderBadge();
  }

  function fieldValue(el) {
    if (el instanceof HTMLSelectElement) return el.value;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'true' : 'false';
      return el.value;
    }
    if (el instanceof HTMLTextAreaElement) return el.value;
    return '';
  }

  function scheduleFill(el) {
    const target = recordSelectorTarget(el);
    const key = `${target.selector}::${target.selectorIndex ?? 0}`;
    const prev = fillDebounce.get(key);
    if (prev) clearTimeout(prev);
    fillDebounce.set(
      key,
      setTimeout(() => {
        fillDebounce.delete(key);
        const text = truncateText(fieldValue(el));
        pushStep({ action: 'fill', ...target, text });
      }, 300),
    );
  }

  function updateRecorderBadge() {
    let badge = document.getElementById('stationhub-recorder-badge');
    if (!recording) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'stationhub-recorder-badge';
      badge.setAttribute('data-stationhub-no-record', '1');
      badge.style.cssText =
        'position:fixed;top:8px;right:8px;z-index:2147483646;padding:6px 10px;background:#dc2626;color:#fff;font:12px system-ui;border-radius:6px;pointer-events:none;';
      document.documentElement.appendChild(badge);
    }
    badge.textContent = `StationHub ghi: ${recordedSteps.length} bước`;
  }

  function startRecording() {
    if (recording) return { ok: true, startUrl: recordStartUrl, title: recordTitle };
    recording = true;
    recordedSteps = [];
    lastStepTs = 0;
    recordStartUrl = location.href;
    recordTitle = document.title;

    onRecordClick = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || shouldSkipRecordTarget(t)) return;
      pushStep({ action: 'click', ...recordSelectorTarget(t) });
    };

    onRecordInput = (e) => {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement
      ) {
        if (shouldSkipRecordTarget(t)) return;
        scheduleFill(t);
      }
    };

    onRecordChange = (e) => {
      const t = e.target;
      if (t instanceof HTMLSelectElement && !shouldSkipRecordTarget(t)) {
        scheduleFill(t);
      }
      if (
        t instanceof HTMLInputElement &&
        (t.type === 'checkbox' || t.type === 'radio') &&
        !shouldSkipRecordTarget(t)
      ) {
        pushStep({
          action: 'fill',
          ...recordSelectorTarget(t),
          text: fieldValue(t),
        });
      }
    };

    ensureHoverUI();

    onRecordMouseMove = (e) => {
      const el = pickRecordTarget(e.clientX, e.clientY);
      if (!el) {
        hideHoverUI();
        return;
      }
      updateHoverUI(el, { mode: 'record' });
    };

    setHoverStyle('record');
    document.addEventListener('mousemove', onRecordMouseMove, true);
    document.addEventListener('click', onRecordClick, true);
    document.addEventListener('input', onRecordInput, true);
    document.addEventListener('change', onRecordChange, true);
    updateRecorderBadge();
    return { ok: true, startUrl: recordStartUrl, title: recordTitle };
  }

  function stopRecording() {
    if (!recording) {
      return {
        steps: recordedSteps,
        startUrl: recordStartUrl || location.href,
        title: recordTitle || document.title,
        recordedAt: new Date().toISOString(),
      };
    }
    recording = false;
    if (onRecordClick) document.removeEventListener('click', onRecordClick, true);
    if (onRecordInput) document.removeEventListener('input', onRecordInput, true);
    if (onRecordChange) document.removeEventListener('change', onRecordChange, true);
    onRecordClick = null;
    onRecordInput = null;
    onRecordChange = null;
    teardownHoverUI();
    for (const t of fillDebounce.values()) clearTimeout(t);
    fillDebounce.clear();
    updateRecorderBadge();
    return {
      steps: recordedSteps,
      startUrl: recordStartUrl || location.href,
      title: recordTitle || document.title,
      recordedAt: new Date().toISOString(),
    };
  }

  function recordStatus() {
    return { recording, stepCount: recordedSteps.length };
  }

  async function runRecordAction(action) {
    switch (action) {
      case 'recordStart':
        return startRecording();
      case 'recordStop':
        return stopRecording();
      case 'recordStatus':
        return recordStatus();
      default:
        throw new Error(`unknown record action: ${action}`);
    }
  }

  function runReplayControl(action) {
    if (action === 'begin') {
      replayBatchDepth += 1;
      ensureHoverUI();
      setHoverStyle('replay');
      return { ok: true, replayBatchDepth };
    }
    if (action === 'end') {
      replayBatchDepth = Math.max(0, replayBatchDepth - 1);
      if (!replayBatchDepth && !recording) teardownHoverUI();
      return { ok: true, replayBatchDepth };
    }
    throw new Error(`unknown replay control: ${action}`);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'stationhub-record') {
      runRecordAction(msg.action)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
      return true;
    }
    if (msg?.type === 'stationhub-replay') {
      try {
        const data = runReplayControl(msg.action);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return true;
    }
    if (msg?.type !== 'stationhub-run') return false;
    runAction(msg.action, msg.payload || {})
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  });
})();
