import { buildSelector, isVisible, truncateText } from '../lib/selectors.js';

const INTERACTIVE =
  'a[href], button, input:not([type=hidden]):not([type=password]), select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [tabindex]:not([tabindex="-1"])';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min = 50, max = 200) {
  return sleep(min + Math.floor(Math.random() * (max - min)));
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function runAction(action, payload) {
  switch (action) {
    case 'snapshotDom':
      return snapshotDom(payload);
    case 'click':
      await randomDelay();
      return clickEl(payload);
    case 'fill':
      await randomDelay();
      return fillEl(payload);
    case 'waitFor':
      return waitForEl(payload);
    case 'delay':
      await sleep(Number(payload.ms) || 0);
      return { ok: true };
    default:
      throw new Error(`unknown action: ${action}`);
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
function snapshotDom(payload) {
  const maxNodes = Math.min(Number(payload.maxNodes) || 200, 500);
  const interactiveOnly = payload.interactiveOnly !== false;
  const rootSel = typeof payload.selector === 'string' ? payload.selector : '';
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) {
    throw new Error(`selector not found: ${rootSel}`);
  }
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
  return {
    url: location.href,
    title: document.title,
    nodes,
  };
}

/**
 * @param {Record<string, unknown>} payload
 */
function resolveElement(payload) {
  const sel = typeof payload.selector === 'string' ? payload.selector : '';
  if (!sel) throw new Error('selector required');
  const el = document.querySelector(sel);
  if (!el) throw new Error(`element not found: ${sel}`);
  if (!isVisible(el)) throw new Error(`element not visible: ${sel}`);
  return el;
}

/**
 * @param {Record<string, unknown>} payload
 */
async function clickEl(payload) {
  const el = resolveElement(payload);
  if (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement
  ) {
    if (el.disabled) throw new Error('element disabled');
  }
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  await sleep(80);
  el.click();
  return { clicked: true, selector: payload.selector };
}

/**
 * @param {Record<string, unknown>} payload
 */
async function fillEl(payload) {
  const el = resolveElement(payload);
  const text = typeof payload.text === 'string' ? payload.text : '';
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error('fill requires input or textarea');
  }
  if (el.type === 'password') throw new Error('cannot fill password field');
  el.focus();
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { filled: true, selector: payload.selector };
}

/**
 * @param {Record<string, unknown>} payload
 */
async function waitForEl(payload) {
  const sel = typeof payload.selector === 'string' ? payload.selector : '';
  const timeoutMs = Math.min(Number(payload.timeoutMs) || 10000, 120000);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) {
      return { found: true, selector: sel };
    }
    await sleep(200);
  }
  throw new Error(`timeout waiting for: ${sel}`);
}
