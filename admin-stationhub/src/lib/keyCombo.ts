/** Tên phím/modifier khớp agent Windows (`desktop.rs` → `vk_from_name`). */

export const KEY_MODIFIERS = ['ctrl', 'alt', 'shift', 'win'] as const;
export type KeyModifier = (typeof KEY_MODIFIERS)[number];

export const KEY_COMBO_PRESETS: { keys: string; labelKey: string }[] = [
  { keys: 'ctrl+c', labelKey: 'keyCombo.preset_copy' },
  { keys: 'ctrl+v', labelKey: 'keyCombo.preset_paste' },
  { keys: 'ctrl+x', labelKey: 'keyCombo.preset_cut' },
  { keys: 'ctrl+z', labelKey: 'keyCombo.preset_undo' },
  { keys: 'ctrl+y', labelKey: 'keyCombo.preset_redo' },
  { keys: 'ctrl+a', labelKey: 'keyCombo.preset_selectAll' },
  { keys: 'ctrl+s', labelKey: 'keyCombo.preset_save' },
  { keys: 'ctrl+f', labelKey: 'keyCombo.preset_find' },
  { keys: 'alt+tab', labelKey: 'keyCombo.preset_altTab' },
  { keys: 'alt+f4', labelKey: 'keyCombo.preset_altF4' },
  { keys: 'win+d', labelKey: 'keyCombo.preset_winD' },
  { keys: 'enter', labelKey: 'keyCombo.preset_enter' },
  { keys: 'tab', labelKey: 'keyCombo.preset_tab' },
  { keys: 'esc', labelKey: 'keyCombo.preset_esc' },
  { keys: 'delete', labelKey: 'keyCombo.preset_delete' },
  { keys: 'f5', labelKey: 'keyCombo.preset_f5' },
];

export const KEYBOARD_NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

export const KEYBOARD_LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
] as const;

export const KEYBOARD_FN_ROW = [
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
] as const;

const BROWSER_KEY_MAP: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'enter',
  Return: 'enter',
  Tab: 'tab',
  Escape: 'esc',
  Backspace: 'backspace',
  Delete: 'delete',
  Del: 'delete',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Insert: 'insert',
  ' ': 'space',
  Spacebar: 'space',
  Control: 'ctrl',
  Alt: 'alt',
  Shift: 'shift',
  Meta: 'win',
};

const MODIFIER_ONLY = new Set(['ctrl', 'control', 'alt', 'shift', 'win', 'meta', 'super']);

export function normalizeBrowserKey(key: string, code?: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return null;

  if (BROWSER_KEY_MAP[trimmed]) return BROWSER_KEY_MAP[trimmed];

  const lower = trimmed.toLowerCase();
  if (MODIFIER_ONLY.has(lower)) return null;

  if (/^f([1-9]|1[0-2])$/i.test(lower)) return lower;
  if (lower.length === 1 && /[a-z0-9]/.test(lower)) return lower;

  if (code?.startsWith('Key')) {
    const letter = code.slice(3).toLowerCase();
    if (/^[a-z]$/.test(letter)) return letter;
  }
  if (code?.startsWith('Digit')) {
    const digit = code.slice(5);
    if (/^[0-9]$/.test(digit)) return digit;
  }

  if (BROWSER_KEY_MAP[trimmed] === undefined && lower in BROWSER_KEY_MAP) {
    return BROWSER_KEY_MAP[lower] ?? null;
  }

  return null;
}

export function buildKeyCombo(modifiers: KeyModifier[], key: string): string {
  const parts = [...modifiers, key.toLowerCase()];
  return parts.join('+');
}

export function parseKeyCombo(value: string): { modifiers: KeyModifier[]; key: string } {
  const parts = value
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const modifiers: KeyModifier[] = [];
  let key = '';
  for (const part of parts) {
    if (part === 'control') {
      modifiers.push('ctrl');
    } else if (KEY_MODIFIERS.includes(part as KeyModifier)) {
      modifiers.push(part as KeyModifier);
    } else {
      key = part;
    }
  }
  return { modifiers, key };
}

export function keyEventToCombo(e: KeyboardEvent): string | null {
  const modifiers: KeyModifier[] = [];
  if (e.ctrlKey) modifiers.push('ctrl');
  if (e.altKey) modifiers.push('alt');
  if (e.shiftKey) modifiers.push('shift');
  if (e.metaKey) modifiers.push('win');

  const key = normalizeBrowserKey(e.key, e.code);
  if (!key || MODIFIER_ONLY.has(key)) return null;

  const uniqueMods = modifiers.filter((m) => m !== key);
  return buildKeyCombo(uniqueMods, key);
}

export function displayKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    win: 'Win',
    enter: 'Enter',
    esc: 'Esc',
    tab: 'Tab',
    space: 'Space',
    backspace: 'Bksp',
    delete: 'Del',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    insert: 'Ins',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };
  const lower = key.toLowerCase();
  return labels[lower] ?? key.toUpperCase();
}

export function displayCombo(value: string): string {
  if (!value.trim()) return '—';
  return value
    .split('+')
    .map((p) => displayKeyLabel(p.trim()))
    .join(' + ');
}
