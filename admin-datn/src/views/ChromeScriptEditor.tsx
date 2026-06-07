import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ChromeScriptMetaFields } from '@/src/components/chromeScript/ChromeScriptMetaFields';
import { ChromeScriptStepInspector } from '@/src/components/chromeScript/ChromeScriptStepInspector';
import { RecordingFlowEditor } from '@/src/components/recordingFlow/RecordingFlowEditor';
import { RecordingEditorToolbar } from '@/src/components/recordingFlow/RecordingEditorToolbar';
import {
  useChromeScriptDetail,
  useChromeScriptMutations,
} from '@/src/hooks/useChromeScripts';
import { useAgentsList } from '@/src/hooks/useAgents';
import { useWorkflowMutations } from '@/src/hooks/useWorkflows';
import { apiErrorMessage } from '@/src/lib/api';
import {
  actionLabel,
  parseStepsFromJson,
  summarizeStep,
  type ChromeScriptStep,
} from '@/src/lib/chromeScriptSteps';
import {
  buildLinearWorkflowDto,
  buildWorkflowNodesFromChromeScript,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';

export default function ChromeScriptEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: script, isLoading, error } = useChromeScriptDetail(id);
  const { remove, createTemplate } = useChromeScriptMutations();
  const { create: createWorkflow } = useWorkflowMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const agents = agentsPage?.items ?? [];

  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [steps, setSteps] = useState(() => parseStepsFromJson([]));
  const [msg, setMsg] = useState('');
  const [tplAgentId, setTplAgentId] = useState('');

  const loadedSig = useMemo(
    () => (script ? `${script.id}:${script.updatedAt}` : ''),
    [script],
  );

  useEffect(() => {
    if (!script) return;
    setName(script.name);
    setStartUrl(script.startUrl ?? '');
    setSteps(parseStepsFromJson(script.steps));
    setTplAgentId(script.agentId ?? '');
  }, [loadedSig, script]);

  const getStepInput = useCallback((step: ChromeScriptStep, index: number) => {
    const label = actionLabel(step.action);
    return {
      action: step.action,
      actionLabel: label,
      summary: summarizeStep(step),
      label: `${index + 1}. ${label}`,
    };
  }, []);

  const resolveAgentId = () => tplAgentId || script?.agentId || agents[0]?.id;

  const onDelete = async () => {
    if (!id || !confirm(t('chromeScripts.deleteConfirm'))) return;
    try {
      await remove.mutateAsync(id);
      navigate('/chrome-scripts');
    } catch (e) {
      setMsg(apiErrorMessage(e));
    }
  };

  const onCreateTemplate = async () => {
    if (!id) return;
    const aid = resolveAgentId();
    if (!aid) {
      setMsg(t('chromeScripts.needAgent'));
      return;
    }
    try {
      const res = await createTemplate.mutateAsync({
        id,
        agentId: aid,
        name: name.trim() || script?.name,
      });
      navigate(`/tasks/templates/${res.template.id}/edit`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    }
  };

  const onCreateWorkflow = async () => {
    if (!script) return;
    const aid = resolveAgentId();
    if (!aid) {
      setMsg(t('chromeScripts.needAgent'));
      return;
    }
    const built = buildWorkflowNodesFromChromeScript(script, aid);
    const dto = buildLinearWorkflowDto(
      script.name,
      t('chromeScripts.createWorkflowDesc', { name: script.name }),
      built,
    );
    if (!dto) {
      setMsg(t('chromeScripts.stepsRequired'));
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

  if (error || !script) {
    return (
      <div className="h-full space-y-4 p-8 overflow-y-auto">
        <p className="text-red-400">{apiErrorMessage(error) || t('chromeScripts.notFound')}</p>
        <button
          type="button"
          onClick={() => navigate('/chrome-scripts')}
          className="text-primary text-sm font-bold"
        >
          {t('chromeScripts.backToList')}
        </button>
      </div>
    );
  }

  return (
    <RecordingFlowEditor
      module="chrome"
      title={name.trim() || script.name}
      subtitle={script.agent?.name ? `Agent: ${script.agent.name}` : undefined}
      backLabel={t('chromeScripts.backToList')}
      onBack={() => navigate('/chrome-scripts')}
      readOnly
      readOnlyHint={t('chromeScripts.readOnlyHint')}
      steps={steps}
      getStepInput={getStepInput}
      message={msg}
      metaContent={
        <ChromeScriptMetaFields
          name={name}
          startUrl={startUrl}
          readOnly
          onChange={() => undefined}
        />
      }
      renderStepInspector={(step: ChromeScriptStep | null) => (
        <ChromeScriptStepInspector step={step} onChange={() => undefined} readOnly />
      )}
      toolbar={
        <RecordingEditorToolbar
          agents={agents}
          tplAgentId={tplAgentId}
          onTplAgentIdChange={setTplAgentId}
          labels={{
            templateAgent: t('chromeScripts.templateAgent'),
            createWorkflow: t('chromeScripts.createWorkflow'),
            createTemplate: t('chromeScripts.createTemplate'),
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
