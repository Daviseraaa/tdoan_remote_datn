import { GitBranch, Layers, Trash2 } from 'lucide-react';
import type { Agent } from '@/src/types/api';
import {
  RECORDING_HEADER_BTN_ACCENT,
  RECORDING_HEADER_BTN_DANGER,
  RECORDING_HEADER_BTN_PRIMARY,
  RECORDING_HEADER_SELECT,
} from './recordingHeaderStyles';

export type RecordingEditorToolbarLabels = {
  templateAgent: string;
  createWorkflow: string;
  createTemplate: string;
  delete: string;
};

type Props = {
  agents: Agent[];
  tplAgentId: string;
  onTplAgentIdChange: (id: string) => void;
  labels: RecordingEditorToolbarLabels;
  onCreateWorkflow: () => void;
  onCreateTemplate: () => void;
  onDelete: () => void;
  createWorkflowPending?: boolean;
  createTemplatePending?: boolean;
};

/** Toolbar dùng chung cho Chrome script edit và Desktop recording edit. */
export function RecordingEditorToolbar({
  agents,
  tplAgentId,
  onTplAgentIdChange,
  labels,
  onCreateWorkflow,
  onCreateTemplate,
  onDelete,
  createWorkflowPending,
  createTemplatePending,
}: Props) {
  return (
    <>
      <select
        value={tplAgentId}
        onChange={(e) => onTplAgentIdChange(e.target.value)}
        className={RECORDING_HEADER_SELECT}
        aria-label={labels.templateAgent}
      >
        <option value="">{labels.templateAgent}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onCreateWorkflow}
        disabled={createWorkflowPending}
        className={RECORDING_HEADER_BTN_ACCENT}
      >
        <GitBranch size={14} className="shrink-0" />
        <span>{labels.createWorkflow}</span>
      </button>
      <button
        type="button"
        onClick={onCreateTemplate}
        disabled={createTemplatePending}
        className={RECORDING_HEADER_BTN_PRIMARY}
      >
        <Layers size={14} className="shrink-0" />
        <span>{labels.createTemplate}</span>
      </button>
      <button type="button" onClick={onDelete} className={RECORDING_HEADER_BTN_DANGER}>
        <Trash2 size={14} className="shrink-0" />
        <span>{labels.delete}</span>
      </button>
    </>
  );
}
