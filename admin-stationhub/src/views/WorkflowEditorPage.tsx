import React from 'react';
import { Loader2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowEditor } from '@/src/components/workflow/WorkflowEditor';
import { useWorkflowEditor } from '@/src/hooks/useWorkflowEditor';
import { t } from '@/src/i18n/t';

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workflowId = id ?? '';
  const w = useWorkflowEditor(workflowId);

  const handleBack = () => {
    navigate('/workflows');
  };

  const handleDelete = async () => {
    const ok = await w.deleteActive();
    if (ok) navigate('/workflows');
  };

  if (!workflowId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-error text-sm">{t('workflows.notFound')}</p>
        <button
          type="button"
          onClick={handleBack}
          className="text-primary text-sm font-bold"
        >
          {t('workflows.backToList')}
        </button>
      </div>
    );
  }

  if (w.detailError && !w.draft && !w.detailLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-error text-sm">{w.error || t('workflows.notFound')}</p>
        <button
          type="button"
          onClick={handleBack}
          className="text-primary text-sm font-bold"
        >
          {t('workflows.backToList')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden relative">
      {w.detailLoading && !w.draft ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-on-surface-variant">
          <Loader2 size={22} className="animate-spin text-primary" />
          {t('workflows.loadingDetail')}
        </div>
      ) : w.draft ? (
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
          <WorkflowEditor
            workflow={w.draft}
            agents={w.agents}
            defaultAgentId={w.defaultAgentId}
            onDefaultAgentIdChange={w.setDefaultAgentId}
            onMetaChange={w.patchMeta}
            onDirty={w.markDirty}
            isDirty={w.isDirty}
            onSave={w.save}
            onRun={w.run}
            saving={w.saving}
            running={w.running}
            saveOk={w.saveOk}
            error={w.error}
            detailLoading={w.detailLoading}
            executionResult={w.executionResult}
            runStatusByStepId={w.runStatusByStepId}
            graphReloadToken={w.graphReloadToken}
            onBack={handleBack}
            onDeleteWorkflow={() => w.setShowDelete(true)}
            onImportConfigFile={(file) => {
              try {
                w.importFromConfigFile(file);
              } catch (e) {
                w.setError(e instanceof Error ? e.message : t('workflows.configFile.invalidShape'));
              }
            }}
            onConfigFileError={w.setError}
            isFullscreen
          />
        </div>
      ) : null}

      {w.showDelete && w.draft ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-4 sm:p-8 w-full max-w-md border border-white/10 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold">{t('workflows.deleteWorkflow')}</h3>
              <button
                type="button"
                onClick={() => w.setShowDelete(false)}
                className="p-1 hover:bg-white/5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-on-surface-variant text-sm">
              {t('workflows.deleteConfirm', {
                name: w.draft.name,
                irreversible: t('common.irreversible'),
              })}
            </p>
            {w.error ? <p className="text-error text-sm">{w.error}</p> : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => w.setShowDelete(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-sm"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
