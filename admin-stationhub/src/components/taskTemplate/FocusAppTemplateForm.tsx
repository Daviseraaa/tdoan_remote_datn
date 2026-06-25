import { AppWindow } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { FocusAppConfigFields } from '@/src/components/workflow/FocusAppConfigFields';
import { buildFocusAppTask, parseFocusAppForm } from '@/src/lib/focusAppPayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function FocusAppTemplateForm({ state, onChange }: Props) {
  const form = parseFocusAppForm(state.focusAppPayload);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-white/10 bg-transparent">
        <div className="flex items-center gap-3 mb-4">
          <AppWindow className="text-primary" size={22} />
          <h3 className="font-bold text-on-surface">{t('taskType.FOCUS_APP')}</h3>
        </div>
        <FocusAppConfigFields
          payload={buildFocusAppTask(form).payload}
          onChange={({ payload }) => onChange({ focusAppPayload: payload })}
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
