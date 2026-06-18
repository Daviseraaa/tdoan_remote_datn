import type { ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { t } from '@/src/i18n/t';
import { WfInspectorBlock, WfInspectorSubsection } from './WfInspectorLayout';
import { WorkflowVariablesEditor } from './WorkflowVariablesEditor';

type Props = {
  workflowId?: string;
  workflowVariables?: Record<string, unknown>;
  onWorkflowVariablesChange?: (variables: Record<string, unknown>) => void;
  exportContent?: ReactNode;
  hasExport?: boolean;
};

/** Editor biến workflow + biến xuất — đặt cuối panel, sau cấu hình. */
export function WfVarsInspectorFooter({
  workflowId,
  workflowVariables,
  onWorkflowVariablesChange,
  exportContent,
  hasExport = false,
}: Props) {
  const hasEditor = Boolean(onWorkflowVariablesChange);
  if (!hasEditor && !hasExport) return null;

  return (
    <>
      {hasExport ? (
        <WfInspectorBlock
          tone="vars"
          className="border-emerald-400/25 bg-emerald-400/[0.06]"
        >
          <WfInspectorSubsection title={t('workflows.varsExport')} tone="export">
            <div className="flex items-start gap-2">
              <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-emerald-400/15 text-emerald-300">
                <Upload size={12} />
              </div>
              <div className="flex-1 min-w-0">{exportContent}</div>
            </div>
          </WfInspectorSubsection>
        </WfInspectorBlock>
      ) : null}

      {hasEditor ? (
        <WfInspectorBlock tone="vars">
          <WfInspectorSubsection title={t('workflows.workflowVariablesEdit')} tone="workflow">
            <WorkflowVariablesEditor
              key={workflowId}
              variables={workflowVariables}
              onChange={onWorkflowVariablesChange!}
            />
          </WfInspectorSubsection>
        </WfInspectorBlock>
      ) : null}
    </>
  );
}
