import { AppWindow } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { CloseAppConfigFields } from '@/src/components/workflow/CloseAppConfigFields';
import { buildCloseAppTask, parseCloseAppForm } from '@/src/lib/closeAppPayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function CloseAppTemplateForm({ state, onChange }: Props) {
  const form = parseCloseAppForm(state.closeAppPayload);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-white/10 bg-transparent">
        <div className="flex items-center gap-3 mb-4">
          <AppWindow className="text-error" size={22} />
          <h3 className="font-bold text-on-surface">{t('taskType.CLOSE_APP')}</h3>
        </div>
        <CloseAppConfigFields
          payload={buildCloseAppTask(form).payload}
          onChange={({ payload }) => onChange({ closeAppPayload: payload })}
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
