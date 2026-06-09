import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import {
  parseOpenBrowserForm,
  buildOpenBrowserTask,
  type OpenBrowserFormState,
} from '@/src/lib/openBrowserPayload';
import { OpenBrowserConfigFields } from '@/src/components/workflow/OpenBrowserConfigFields';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

function stateToForm(state: TemplateEditorState): OpenBrowserFormState {
  return parseOpenBrowserForm(state.openBrowserUrl || state.command, state.openBrowserPayload);
}

export function OpenBrowserTemplateForm({ state, onChange }: Props) {
  const form = stateToForm(state);

  return (
    <div className="space-y-6">
      <OpenBrowserConfigFields
        command={form.url}
        payload={buildOpenBrowserTask(form).payload}
        agentId={state.agentId}
        onChange={({ command, payload }) => {
          const next = parseOpenBrowserForm(command, payload);
          onChange({
            command,
            openBrowserUrl: next.url,
            openBrowserPayload: payload,
          });
        }}
      />
      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
