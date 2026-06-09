import React from 'react';
import { Info } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function SystemInfoTemplateForm({ state, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-tertiary/20 bg-tertiary/5">
        <div className="flex items-start gap-3">
          <Info className="text-tertiary shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-on-surface">{t('taskType.SYSTEM_INFO')}</h3>
            <p className="text-sm text-on-surface-variant mt-2">{t('templateWizard.systemInfoHint')}</p>
          </div>
        </div>
      </div>
      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
