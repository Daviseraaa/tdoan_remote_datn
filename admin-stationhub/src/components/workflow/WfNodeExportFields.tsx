import type { WfNodeData } from '@/src/lib/workflowGraph';
import {
  formatStepVar,
  formatWorkflowVar,
  nodeExportsStepVariables,
  nodePublishesWorkflowVar,
  resolveNodeOutputKey,
  resolveWorkflowVarName,
  workflowVarNameInputValue,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import { WfCopyRefButton } from './WfCopyRefButton';

type Props = {
  nodeId: string;
  data: WfNodeData;
  onPatchOutputKey?: (outputKey: string | undefined) => void;
  onPatchVariableName?: (variableName: string | undefined) => void;
};

function defaultVarPlaceholder(kind: WfNodeData['kind']): string {
  return kind === 'excel' ? 'excel_data' : 'my_var';
}

export function WfNodeExportFields({
  nodeId,
  data,
  onPatchOutputKey,
  onPatchVariableName,
}: Props) {
  const cfg = data.config;
  const exportsStep = nodeExportsStepVariables(data.kind, cfg);
  const publishesWf = nodePublishesWorkflowVar(data.kind, cfg);

  if (!exportsStep && !publishesWf) return null;

  const resolvedStepKey = resolveNodeOutputKey(data, nodeId);
  const stepRef = formatStepVar(resolvedStepKey);
  const wfName = publishesWf ? resolveWorkflowVarName(data.kind, cfg) : '';
  const wfRef = publishesWf ? formatWorkflowVar(wfName) : '';

  return (
    <div className="space-y-3 w-full">
      {exportsStep ? (
        <div className="space-y-2">
          {onPatchOutputKey ? (
            <div>
              <label className="text-[9px] font-mono font-bold uppercase text-emerald-300/70">
                {t('workflows.outputKey')}
              </label>
              <input
                value={cfg.outputKey ?? ''}
                onChange={(e) => onPatchOutputKey(e.target.value || undefined)}
                placeholder={resolvedStepKey}
                className="w-full mt-1 px-2.5 py-2 rounded-lg bg-black/20 border border-emerald-400/20 font-mono text-sm focus:outline-none focus:border-emerald-400/40"
              />
            </div>
          ) : null}
          <WfCopyRefButton refText={stepRef} tone="emerald" className="w-full" />
        </div>
      ) : null}

      {publishesWf ? (
        <div className="space-y-2">
          {onPatchVariableName ? (
            <div>
              <label className="text-[9px] font-mono font-bold uppercase text-emerald-300/70">
                {t('workflows.exportVarName')}
              </label>
              <input
                value={workflowVarNameInputValue(data.kind, cfg.variableName)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onPatchVariableName(v || undefined);
                }}
                placeholder={defaultVarPlaceholder(data.kind)}
                className="w-full mt-1 px-2.5 py-2 rounded-lg bg-black/20 border border-emerald-400/20 font-mono text-sm focus:outline-none focus:border-emerald-400/40"
              />
            </div>
          ) : null}
          <WfCopyRefButton refText={wfRef} tone="emerald" className="w-full" />
        </div>
      ) : null}
    </div>
  );
}
