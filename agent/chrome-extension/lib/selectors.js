const MAX_TEXT = 500;

/**
 * @param {Element} el
 * @returns {string}
 */
export function buildSelector(el) {
  if (!(el instanceof Element)) return '';
  if (el.id) {
    const id = CSS.escape(el.id);
    return `#${id}`;
  }
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  const name = el.getAttribute('name');
  if (name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }
  const aria = el.getAttribute('aria-label');
  if (aria) {
    return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
  }
  const parts = [];
  let cur = el;
  let depth = 0;
  while (cur && cur.nodeType === Node.ELEMENT_NODE && depth < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part = `#${CSS.escape(cur.id)}`;
      parts.unshift(part);
      break;
    }
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    cur = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

/**
 * @param {string} s
 * @returns {string}
 */
export function truncateText(s) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_TEXT) return t;
  return `${t.slice(0, MAX_TEXT)}…`;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function isVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
