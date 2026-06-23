import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Mic } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import {
  KEY_COMBO_PRESETS,
  KEY_MODIFIERS,
  KEYBOARD_FN_ROW,
  KEYBOARD_LETTER_ROWS,
  KEYBOARD_NUMBER_ROW,
  buildKeyCombo,
  displayCombo,
  displayKeyLabel,
  keyEventToCombo,
  parseKeyCombo,
  type KeyModifier,
} from '@/src/lib/keyCombo';

type Props = {
  value: string;
  onChange: (keys: string) => void;
  disabled?: boolean;
};

const SPECIAL_KEYS = [
  { id: 'tab', label: 'Tab' },
  { id: 'enter', label: 'Enter' },
  { id: 'esc', label: 'Esc' },
  { id: 'space', label: 'Space' },
  { id: 'backspace', label: 'Bksp' },
  { id: 'delete', label: 'Del' },
] as const;

const NAV_KEYS = [
  { id: 'home', label: 'Home' },
  { id: 'end', label: 'End' },
  { id: 'pageup', label: 'PgUp' },
  { id: 'pagedown', label: 'PgDn' },
  { id: 'insert', label: 'Ins' },
] as const;

const ARROW_KEYS = [
  { id: 'up', label: '↑' },
  { id: 'left', label: '←' },
  { id: 'down', label: '↓' },
  { id: 'right', label: '→' },
] as const;

function KeyBtn({
  label,
  onClick,
  active,
  disabled,
  wide,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-7 min-w-[1.6rem] px-1 rounded-md border text-[10px] font-mono font-bold transition-colors',
        'border-white/10 bg-surface-container-low hover:bg-white/10 hover:border-primary/30',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-container-low',
        active && 'bg-primary/20 border-primary/50 text-primary',
        wide && 'flex-1',
        className,
      )}
    >
      {label}
    </button>
  );
}

export function KeyComboPicker({ value, onChange, disabled }: Props) {
  const parsed = parseKeyCombo(value);
  const [modifiers, setModifiers] = useState<KeyModifier[]>(parsed.modifiers);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    setModifiers(parseKeyCombo(value).modifiers);
  }, [value]);

  const applyCombo = useCallback(
    (combo: string) => {
      onChange(combo);
      setModifiers(parseKeyCombo(combo).modifiers);
    },
    [onChange],
  );

  const pressKey = useCallback(
    (key: string) => {
      if (disabled) return;
      applyCombo(buildKeyCombo(modifiers, key));
    },
    [applyCombo, disabled, modifiers],
  );

  const toggleModifier = useCallback(
    (mod: KeyModifier) => {
      if (disabled) return;
      setModifiers((prev) =>
        prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
      );
    },
    [disabled],
  );

  useEffect(() => {
    if (!capturing || disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        e.key === 'Escape' &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.metaKey
      ) {
        setCapturing(false);
        return;
      }
      const combo = keyEventToCombo(e);
      if (combo) {
        applyCombo(combo);
        setCapturing(false);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [applyCombo, capturing, disabled]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => applyCombo(e.target.value)}
          placeholder={t('keyCombo.placeholder')}
          disabled={disabled}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface-container-low border border-white/10 text-sm font-mono disabled:opacity-70"
        />
      </div>

      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5',
          capturing
            ? 'border-primary/50 bg-primary/10'
            : 'border-white/10 bg-black/20',
        )}
      >
        <span className="text-xs font-mono text-on-surface-variant truncate">
          {displayCombo(value)}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCapturing((c) => !c)}
          className={cn(
            'shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase',
            capturing
              ? 'bg-primary text-on-primary'
              : 'bg-white/5 border border-white/10 hover:bg-white/10',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Mic size={12} />
          {capturing ? t('keyCombo.capturing') : t('keyCombo.capture')}
        </button>
      </div>

      {capturing ? (
        <p className="text-[10px] text-primary/90">{t('keyCombo.captureHint')}</p>
      ) : null}

      <div>
        <p className="text-[9px] font-mono font-bold uppercase text-on-surface-variant/60 mb-1">
          {t('keyCombo.presets')}
        </p>
        <div className="flex flex-wrap gap-1">
          {KEY_COMBO_PRESETS.map((preset) => (
            <button
              key={preset.keys}
              type="button"
              disabled={disabled}
              onClick={() => applyCombo(preset.keys)}
              className={cn(
                'px-2 py-0.5 rounded-md border text-[10px] font-mono',
                value === preset.keys
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-white/10 bg-surface-container-low hover:border-primary/30 hover:bg-white/5',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {t(preset.labelKey as 'keyCombo.preset_copy')}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-2 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <Keyboard size={12} className="text-primary shrink-0" />
          <span className="text-[9px] font-mono font-bold uppercase text-on-surface-variant/60">
            {t('keyCombo.virtualKeyboard')}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {KEY_MODIFIERS.map((mod) => (
            <React.Fragment key={mod}>
              <KeyBtn
                label={displayKeyLabel(mod)}
                active={modifiers.includes(mod)}
                disabled={disabled}
                onClick={() => toggleModifier(mod)}
                className="px-2"
              />
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap gap-0.5">
          {KEYBOARD_FN_ROW.map((fnKey) => (
            <React.Fragment key={fnKey}>
              <KeyBtn
                label={fnKey.toUpperCase()}
                disabled={disabled}
                onClick={() => pressKey(fnKey)}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap gap-0.5">
          {KEYBOARD_NUMBER_ROW.map((numKey) => (
            <React.Fragment key={numKey}>
              <KeyBtn label={numKey} disabled={disabled} onClick={() => pressKey(numKey)} />
            </React.Fragment>
          ))}
        </div>

        {KEYBOARD_LETTER_ROWS.map((row, ri) => (
          <div key={ri} className="flex flex-wrap gap-0.5">
            {row.map((letterKey) => (
              <React.Fragment key={letterKey}>
                <KeyBtn
                  label={letterKey.toUpperCase()}
                  disabled={disabled}
                  onClick={() => pressKey(letterKey)}
                />
              </React.Fragment>
            ))}
          </div>
        ))}

        <div className="flex flex-wrap gap-0.5">
          {SPECIAL_KEYS.map((special) => (
            <React.Fragment key={special.id}>
              <KeyBtn
                label={special.label}
                disabled={disabled}
                wide
                onClick={() => pressKey(special.id)}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap gap-0.5">
          {NAV_KEYS.map((nav) => (
            <React.Fragment key={nav.id}>
              <KeyBtn
                label={nav.label}
                disabled={disabled}
                onClick={() => pressKey(nav.id)}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="flex gap-0.5 justify-center">
          {ARROW_KEYS.map((arrow) => (
            <React.Fragment key={arrow.id}>
              <KeyBtn
                label={arrow.label}
                disabled={disabled}
                onClick={() => pressKey(arrow.id)}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
