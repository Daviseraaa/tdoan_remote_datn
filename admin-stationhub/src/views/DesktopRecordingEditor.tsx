import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DesktopRecordingMetaFields } from '@/src/components/desktopRecording/DesktopRecordingMetaFields';
import { DesktopStepInspector } from '@/src/components/desktopRecording/DesktopStepInspector';
import { RecordingFlowEditor } from '@/src/components/recordingFlow/RecordingFlowEditor';
import { RecordingEditorToolbar } from '@/src/components/recordingFlow/RecordingEditorToolbar';
import {
  useDesktopRecordingDetail,
  useDesktopRecordingMutations,
} from '@/src/hooks/useDesktopRecordings';
import { useAgentsList } from '@/src/hooks/useAgents';
import { useWorkflowMutations } from '@/src/hooks/useWorkflows';
import { apiErrorMessage } from '@/src/lib/api';
import {
  actionLabel,
  parseStepsFromJson,
  summarizeStep,
  type DesktopStep,
} from '@/src/lib/desktopRecordingSteps';
import {
  buildLinearWorkflowDto,
  buildWorkflowNodesFromDesktopRecording,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';

export default function DesktopRecordingEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recording, isLoading, error } = useDesktopRecordingDetail(id);
  const { remove, createTemplate } = useDesktopRecordingMutations();
  const { create: createWorkflow } = useWorkflowMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const agents = agentsPage?.items ?? [];

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<DesktopStep[]>([]);
  const [msg, setMsg] = useState('');
  const [tplAgentId, setTplAgentId] = useState('');

  const loadedSig = useMemo(
    () => (recording ? `${recording.id}:${recording.updatedAt}` : ''),
    [recording],
  );

  useEffect(() => {
    if (!recording) return;
    setName(recording.name);
    setSteps(parseStepsFromJson(recording.steps));
    setTplAgentId(recording.agentId ?? '');
  }, [loadedSig, recording]);

  const getStepInput = useCallback((step: DesktopStep, index: number) => {
    const label = actionLabel(step.action);
    return {
      action: step.action,
      actionLabel: label,
      summary: summarizeStep(step),
      label: `${index + 1}. ${label}`,
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!recording?.agent?.name) return undefined;
    const parts = [`Agent: ${recording.agent.name}`];
    if (recording.localId) {
      parts.push(`local ${recording.localId.slice(0, 8)}…`);
    }
    return parts.join(' · ');
  }, [recording]);

  const resolveAgentId = () => tplAgentId || recording?.agentId || agents[0]?.id;

  const onDelete = async () => {
    if (!id || !confirm(t('desktopRecordings.deleteConfirm'))) return;
    try {
      await remove.mutateAsync(id);
      navigate('/desktop-recordings');
    } catch (e) {
      setMsg(apiErrorMessage(e));
    }
  };

  const onCreateTemplate = async () => {
    if (!id) return;
    const aid = resolveAgentId();
    if (!aid) {
      setMsg(t('desktopRecordings.needAgent'));
      return;
    }
    try {
      const res = await createTemplate.mutateAsync({
        id,
        agentId: aid,
        name: name.trim() || recording?.name,
      });
      navigate(`/tasks/templates/${res.template.id}/edit`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    }
  };

  const onCreateWorkflow = async () => {
    if (!recording) return;
    const aid = resolveAgentId();
    if (!aid) {
      setMsg(t('desktopRecordings.needAgent'));
      return;
    }
    const built = buildWorkflowNodesFromDesktopRecording(recording, aid);
    const dto = buildLinearWorkflowDto(
      recording.name,
      t('desktopRecordings.createWorkflowDesc', { name: recording.name }),
      built,
    );
    if (!dto) {
      setMsg(t('desktopRecordings.stepsRequired'));
      return;
    }
    try {
      const wf = await createWorkflow.mutateAsync(dto);
      navigate(`/workflows/${wf.id}/edit`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex justify-center items-center text-on-surface-variant">
        <Loader2 className="animate-spin w-10 h-10" />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="h-full space-y-4 p-8 overflow-y-auto">
        <p className="text-red-400">{apiErrorMessage(error) || t('desktopRecordings.notFound')}</p>
        <button
          type="button"
          onClick={() => navigate('/desktop-recordings')}
          className="text-primary text-sm font-bold"
        >
          {t('desktopRecordings.backToList')}
        </button>
      </div>
    );
  }

  return (
    <RecordingFlowEditor
      module="desktop"
      title={name.trim() || recording.name}
      subtitle={subtitle}
      backLabel={t('desktopRecordings.backToList')}
      onBack={() => navigate('/desktop-recordings')}
      readOnly
      readOnlyHint={t('desktopRecordings.readOnlyHint')}
      steps={steps}
      getStepInput={getStepInput}
      message={msg}
      metaContent={
        <DesktopRecordingMetaFields name={name} readOnly onChange={() => undefined} />
      }
      renderStepInspector={(step: DesktopStep | null) => (
        <DesktopStepInspector step={step} onChange={() => undefined} readOnly />
      )}
      toolbar={
        <RecordingEditorToolbar
          agents={agents}
          tplAgentId={tplAgentId}
          onTplAgentIdChange={setTplAgentId}
          labels={{
            templateAgent: t('desktopRecordings.templateAgent'),
            createWorkflow: t('desktopRecordings.createWorkflow'),
            createTemplate: t('desktopRecordings.createTemplate'),
            delete: t('common.delete'),
          }}
          onCreateWorkflow={() => void onCreateWorkflow()}
          onCreateTemplate={() => void onCreateTemplate()}
          onDelete={() => void onDelete()}
          createWorkflowPending={createWorkflow.isPending}
          createTemplatePending={createTemplate.isPending}
        />
      }
    />
  );
}
