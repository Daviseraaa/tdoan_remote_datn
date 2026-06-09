import React from 'react';
import { Terminal } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { shellHintForOs } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function CommandTemplateForm({ state, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="text-primary" size={22} />
          <div>
            <h3 className="font-bold text-on-surface">{t('taskType.COMMAND')}</h3>
            <p className="text-xs text-on-surface-variant">{shellHintForOs(state.agent?.os)}</p>
          </div>
        </div>
        <textarea
          value={state.command}
          onChange={(e) => onChange({ command: e.target.value })}
          rows={6}
          placeholder={t('templateWizard.commandPlaceholder')}
          className="w-full px-4 py-3 rounded-xl bg-[#0b0f14] border border-white/10 font-mono text-sm text-[#d4d4d4] focus:outline-none focus:border-primary/40"
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
