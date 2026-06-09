import React from 'react';
import { AppWindow } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { OpenAppMode, TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { parseOpenAppForm } from '@/src/lib/openAppPayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

const MODES: { id: OpenAppMode; labelKey: 'templateWizard.openAppPath' | 'templateWizard.openAppApp' | 'templateWizard.openAppQuery'; phKey: 'templateWizard.openAppPathPh' | 'templateWizard.openAppAppPh' | 'templateWizard.openAppQueryPh' }[] = [
  { id: 'path', labelKey: 'templateWizard.openAppPath', phKey: 'templateWizard.openAppPathPh' },
  { id: 'app', labelKey: 'templateWizard.openAppApp', phKey: 'templateWizard.openAppAppPh' },
  { id: 'query', labelKey: 'templateWizard.openAppQuery', phKey: 'templateWizard.openAppQueryPh' },
];

export function OpenAppTemplateForm({ state, onChange }: Props) {
  const mode = MODES.find((m) => m.id === state.openAppMode) ?? MODES[0];
  const form = parseOpenAppForm(state.openAppValue, {
    ...(state.openAppMode === 'path'
      ? { path: state.openAppValue }
      : state.openAppMode === 'app'
        ? { app: state.openAppValue }
        : { query: state.openAppValue }),
    fullscreen: state.openAppFullscreen,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-white/10 bg-transparent">
        <div className="flex items-center gap-3 mb-4">
          <AppWindow className="text-primary" size={22} />
          <h3 className="font-bold text-on-surface">{t('taskType.OPEN_APP')}</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ openAppMode: m.id })}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-bold border transition-all',
                state.openAppMode === m.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <input
          value={state.openAppValue}
          onChange={(e) => onChange({ openAppValue: e.target.value })}
          placeholder={t(mode.phKey)}
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
        />
        <label className="mt-4 flex items-center gap-2 cursor-pointer text-sm font-bold text-on-surface-variant">
          <input
            type="checkbox"
            checked={form.fullscreen}
            onChange={(e) => onChange({ openAppFullscreen: e.target.checked })}
            className="rounded"
          />
          {t('openApp.fullscreen')}
        </label>
        <p className="text-[10px] text-on-surface-variant mt-1">{t('openApp.fullscreenHint')}</p>
      </div>
      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
