import React from 'react';
import { FileCode } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function ScriptTemplateForm({ state, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <FileCode className="text-primary" size={22} />
          <h3 className="font-bold text-on-surface">{t('taskType.SCRIPT')}</h3>
        </div>
        <textarea
          value={state.command}
          onChange={(e) => onChange({ command: e.target.value })}
          rows={10}
          placeholder={t('templateWizard.scriptPlaceholder')}
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm focus:outline-none focus:border-primary/40"
        />
      </div>
      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
