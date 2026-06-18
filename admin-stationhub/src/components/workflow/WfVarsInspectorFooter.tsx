import type { ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { t } from '@/src/i18n/t';
import { WfInspectorBlock, WfInspectorSubsection } from './WfInspectorLayout';
import { WorkflowVariablesEditor } from './WorkflowVariablesEditor';

type EditorProps = {
  workflowId?: string;
  workflowVariables?: Record<string, unknown>;
  onWorkflowVariablesChange?: (variables: Record<string, unknown>) => void;
};

export function WfWorkflowVariablesEditorSection({
  workflowId,
  workflowVariables,
  onWorkflowVariablesChange,
}: EditorProps) {
  if (!onWorkflowVariablesChange) return null;

  return (
    <WfInspectorBlock tone="vars">
      <WfInspectorSubsection title={t('workflows.workflowVariablesEdit')} tone="workflow">
        <WorkflowVariablesEditor
          key={workflowId}
          variables={workflowVariables}
          onChange={onWorkflowVariablesChange}
        />
      </WfInspectorSubsection>
    </WfInspectorBlock>
  );
}

type ExportProps = {
  exportContent?: ReactNode;
  hasExport?: boolean;
};

export function WfNodeExportSection({ exportContent, hasExport = false }: ExportProps) {
  if (!hasExport || !exportContent) return null;

  return (
    <WfInspectorBlock tone="vars" className="border-emerald-400/25 bg-emerald-400/[0.06]">
      <WfInspectorSubsection title={t('workflows.varsExport')} tone="export">
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-emerald-400/15 text-emerald-300">
            <Upload size={12} />
          </div>
          <div className="flex-1 min-w-0">{exportContent}</div>
        </div>
      </WfInspectorSubsection>
    </WfInspectorBlock>
  );
}

type FooterProps = EditorProps & ExportProps;

/** @deprecated Dùng WfWorkflowVariablesEditorSection + WfNodeExportSection riêng để sắp xếp panel. */
export function WfVarsInspectorFooter({
  workflowId,
  workflowVariables,
  onWorkflowVariablesChange,
  exportContent,
  hasExport = false,
}: FooterProps) {
  const hasEditor = Boolean(onWorkflowVariablesChange);
  if (!hasEditor && !hasExport) return null;

  return (
    <>
      <WfNodeExportSection exportContent={exportContent} hasExport={hasExport} />
      <WfWorkflowVariablesEditorSection
        workflowId={workflowId}
        workflowVariables={workflowVariables}
        onWorkflowVariablesChange={onWorkflowVariablesChange}
      />
    </>
  );
}
