import type { Agent } from '@/src/types/api';
import { shellHintForOs } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm';

type Props = {
  taskType: 'COMMAND' | 'SCRIPT';
  command: string;
  agents: Agent[];
  agentId?: string;
  onChange: (command: string) => void;
};

export function WfShellCommandConfigFields({
  taskType,
  command,
  agents,
  agentId,
  onChange,
}: Props) {
  const agent = agents.find((a) => a.id === agentId);
  const placeholder =
    taskType === 'SCRIPT'
      ? t('templateWizard.scriptPlaceholder')
      : t('templateWizard.commandPlaceholder');

  return (
    <div className="space-y-2">
      {taskType === 'COMMAND' && agent?.os ? (
        <p className="text-[10px] text-on-surface-variant/80">{shellHintForOs(agent.os)}</p>
      ) : null}
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.command')}
        </label>
        <textarea
          value={command}
          onChange={(e) => onChange(e.target.value)}
          rows={taskType === 'SCRIPT' ? 8 : 4}
          placeholder={placeholder}
          className={inputCls}
        />
      </div>
      {taskType === 'SCRIPT' ? (
        <p className="text-[10px] text-on-surface-variant/70">{t('taskType.SCRIPT_desc')}</p>
      ) : (
        <p className="text-[10px] text-on-surface-variant/70">{t('taskType.COMMAND_desc')}</p>
      )}
    </div>
  );
}
