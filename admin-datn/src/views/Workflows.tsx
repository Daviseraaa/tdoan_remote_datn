import React from 'react';
import { GitBranch, Loader2, X } from 'lucide-react';
import { WorkflowListSidebar } from '@/src/components/workflow/WorkflowListSidebar';
import { WorkflowEditor } from '@/src/components/workflow/WorkflowEditor';
import { useWorkflowPage } from '@/src/hooks/useWorkflowPage';
import { t } from '@/src/i18n/t';

export default function Workflows() {
  const w = useWorkflowPage();
  const [listOpen, setListOpen] = React.useState(true);

  const showEditor = Boolean(w.activeId);
  const showListPanel = !showEditor || listOpen;

  React.useEffect(() => {
    if (!w.activeId) setListOpen(true);
  }, [w.activeId]);

  const handleSelectWorkflow = (id: string) => {
    w.selectWorkflow(id);
    setListOpen(false);
  };

  const handleCreateWorkflow = async () => {
    const ok = await w.createNew();
    if (ok) setListOpen(false);
  };

  return (
    <div className="h-full min-h-0 flex flex-1 overflow-hidden border-t border-white/5">
      {showListPanel ? (
      <WorkflowListSidebar
        collapsed={w.listCollapsed}
        onToggleCollapse={() => w.setListCollapsed((v) => !v)}
        search={w.search}
        onSearchChange={w.setSearch}
        items={w.filteredItems}
        activeId={w.activeId}
        onSelect={handleSelectWorkflow}
        onCreate={() => void handleCreateWorkflow()}
        creating={w.creating}
        loading={w.listLoading}
        page={w.page}
        pageLimit={w.pageLimit}
        total={w.listTotal}
        onPageChange={w.setPage}
      />
      ) : null}

      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full relative bg-surface-container-lowest overflow-hidden">
        {w.pendingSwitchId ? (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-sm">
            <span className="font-bold text-amber-200">{t('workflows.unsavedSwitch')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => w.setPendingSwitchId(null)}
                className="px-3 py-1 rounded-lg border border-white/15 text-xs font-bold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void w.discardAndSwitch()}
                className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold"
              >
                {t('workflows.discardChanges')}
              </button>
            </div>
          </div>
        ) : null}

        {showEditor && !w.draft && w.detailLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-on-surface-variant">
            <Loader2 size={22} className="animate-spin text-primary" />
            {t('workflows.loadingDetail')}
          </div>
        ) : showEditor && w.draft ? (
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
              onOpenWorkflowList={() => setListOpen(true)}
              onEditorPaneClick={() => {
                if (showEditor && listOpen) setListOpen(false);
              }}
              onDeleteWorkflow={() => w.setShowDelete(true)}
            />
          </div>
        ) : w.listLoading && w.filteredItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-on-surface-variant">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span>{t('automations.loading')}</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <GitBranch size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">{t('workflows.emptyTitle')}</h2>
              <p className="text-sm text-on-surface-variant max-w-md">{t('workflows.emptyHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateWorkflow()}
              disabled={w.creating}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-40"
            >
              {w.creating ? t('workflows.creating') : t('workflows.newWorkflow')}
            </button>
            {w.error ? <p className="text-sm text-error">{w.error}</p> : null}
          </div>
        )}
      </main>

      {w.showDelete && w.draft ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-4 shadow-2xl">
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
                onClick={() => void w.deleteActive()}
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
