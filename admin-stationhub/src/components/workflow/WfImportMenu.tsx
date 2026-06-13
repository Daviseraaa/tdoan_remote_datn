import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, FileJson, GitBranch, ListTodo, MonitorPlay, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { apiFetch } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import { useAuth } from '@/src/hooks/useAuth';
import * as taskTemplatesApi from '@/src/api/taskTemplates';
import * as workflowsApi from '@/src/api/workflows';
import type { ChromeScript, DesktopRecording, TaskTemplate, Workflow } from '@/src/types/api';
import type { WfImportSource } from '@/src/lib/workflowGraph/importSources';

const SOURCE_META: Record<
  WfImportSource,
  { icon: typeof ListTodo; labelKey: string }
> = {
  task: { icon: ListTodo, labelKey: 'workflows.importMenu.task' },
  workflow: { icon: GitBranch, labelKey: 'workflows.importMenu.workflow' },
  desktopRecording: { icon: MonitorPlay, labelKey: 'workflows.importMenu.desktopRecording' },
  chromeScript: { icon: FileJson, labelKey: 'workflows.importMenu.chromeScript' },
};

export type WfImportMenuProps = {
  compact?: boolean;
  className?: string;
  sources?: WfImportSource[];
  onImportChromeScript: (script: ChromeScript) => void;
  onImportDesktopRecording: (recording: DesktopRecording) => void;
  onImportTaskTemplate: (template: TaskTemplate) => void;
  onImportWorkflow: (workflow: Workflow) => void;
};

export function WfImportMenu({
  compact,
  className,
  sources = ['task', 'workflow', 'desktopRecording', 'chromeScript'],
  onImportChromeScript,
  onImportDesktopRecording,
  onImportTaskTemplate,
  onImportWorkflow,
}: WfImportMenuProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WfImportSource | null>(null);

  const enabled = open;

  const { data: scriptsRaw, isLoading: scriptsLoading } = useQuery({
    queryKey: ['chrome-scripts', 'wf-import'],
    queryFn: () => apiFetch<ChromeScript[]>('/chrome-scripts'),
    enabled: enabled && sources.includes('chromeScript'),
  });
  const scripts = Array.isArray(scriptsRaw) ? scriptsRaw : [];

  const { data: recordingsRaw, isLoading: recordingsLoading } = useQuery({
    queryKey: ['desktop-recordings', 'wf-import'],
    queryFn: () => apiFetch<DesktopRecording[]>('/desktop-recordings'),
    enabled: enabled && sources.includes('desktopRecording'),
  });
  const recordings = Array.isArray(recordingsRaw) ? recordingsRaw : [];

  const { data: templatesPage, isLoading: templatesLoading } = useQuery({
    queryKey: ['task-templates', 'wf-import', isAdmin],
    queryFn: () => taskTemplatesApi.listTaskTemplates(isAdmin, { page: 1, limit: 100 }),
    enabled: enabled && sources.includes('task'),
  });
  const templates = templatesPage?.items ?? [];

  const { data: workflowsPage, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', 'wf-import', isAdmin],
    queryFn: () => workflowsApi.listWorkflows(isAdmin, { page: 1, limit: 100 }),
    enabled: enabled && sources.includes('workflow'),
  });
  const workflows = workflowsPage?.items ?? [];

  const activeKind = kind && sources.includes(kind) ? kind : sources[0] ?? null;

  useEffect(() => {
    if (!open) return;
    if (!kind || !sources.includes(kind)) {
      setKind(sources[0] ?? null);
    }
  }, [open, kind, sources]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const listLoading = useMemo(() => {
    if (!activeKind) return false;
    switch (activeKind) {
      case 'chromeScript':
        return scriptsLoading;
      case 'desktopRecording':
        return recordingsLoading;
      case 'task':
        return templatesLoading;
      case 'workflow':
        return workflowsLoading;
      default:
        return false;
    }
  }, [activeKind, scriptsLoading, recordingsLoading, templatesLoading, workflowsLoading]);

  const emptyHint = useMemo(() => {
    if (!activeKind) return '';
    switch (activeKind) {
      case 'chromeScript':
        return t('workflows.importMenu.emptyChromeScript');
      case 'desktopRecording':
        return t('workflows.importMenu.emptyDesktopRecording');
      case 'task':
        return t('workflows.importMenu.emptyTask');
      case 'workflow':
        return t('workflows.importMenu.emptyWorkflow');
      default:
        return t('workflows.importMenu.empty');
    }
  }, [activeKind]);

  const closeModal = () => {
    setOpen(false);
    setKind(null);
  };

  const openModal = () => {
    setKind(sources[0] ?? null);
    setOpen(true);
  };

  const handlePick = async (id: string) => {
    if (!id || !activeKind) return;

    try {
      switch (activeKind) {
        case 'chromeScript': {
          const script = scripts.find((s) => s.id === id);
          if (script) onImportChromeScript(script);
          break;
        }
        case 'desktopRecording': {
          const rec = recordings.find((r) => r.id === id);
          if (rec) onImportDesktopRecording(rec);
          break;
        }
        case 'task': {
          const tpl = templates.find((x) => x.id === id);
          if (tpl) {
            const full = await taskTemplatesApi.getTaskTemplate(isAdmin, tpl.id);
            onImportTaskTemplate(full);
          }
          break;
        }
        case 'workflow': {
          const wf = workflows.find((w) => w.id === id);
          if (wf) {
            const full = await workflowsApi.getWorkflow(wf.id);
            onImportWorkflow(full);
          }
          break;
        }
      }
    } finally {
      closeModal();
    }
  };

  const modal = open
    ? createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('common.cancel')}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wf-import-modal-title"
            className="relative w-full max-w-md max-h-[min(520px,90vh)] flex flex-col rounded-2xl border border-white/10 bg-surface-container-high shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10">
              <div>
                <h3 id="wf-import-modal-title" className="text-lg font-bold text-on-surface">
                  {t('workflows.importMenu.modalTitle')}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">{t('workflows.importMenu.hint')}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-2">
                  {t('workflows.importMenu.sourceType')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sources.map((source) => {
                    const meta = SOURCE_META[source];
                    const Icon = meta.icon;
                    const active = activeKind === source;
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setKind(source)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-3 rounded-xl border text-left font-bold transition-all',
                          active
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-white/10 hover:bg-white/5 text-on-surface-variant',
                        )}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="text-xs leading-snug">
                          {t(meta.labelKey as 'workflows.importMenu.task')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-2">
                  {t('workflows.importMenu.pickItem')}
                </p>
                {listLoading ? (
                  <p className="text-sm text-on-surface-variant py-3">{t('common.loading')}</p>
                ) : activeKind === 'chromeScript' && scripts.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2 leading-snug">{emptyHint}</p>
                ) : activeKind === 'desktopRecording' && recordings.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2 leading-snug">{emptyHint}</p>
                ) : activeKind === 'task' && templates.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2 leading-snug">{emptyHint}</p>
                ) : activeKind === 'workflow' && workflows.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2 leading-snug">{emptyHint}</p>
                ) : (
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm font-semibold"
                    defaultValue=""
                    onChange={(e) => {
                      void handlePick(e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">{t('workflows.importMenu.pickItem')}</option>
                    {activeKind === 'chromeScript'
                      ? scripts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.agent?.name ? ` · ${s.agent.name}` : ''}
                            {Array.isArray(s.steps) ? ` · ${s.steps.length}` : ''}
                          </option>
                        ))
                      : null}
                    {activeKind === 'desktopRecording'
                      ? recordings.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                            {r.agent?.name ? ` · ${r.agent.name}` : ''}
                            {Array.isArray(r.steps) ? ` · ${r.steps.length}` : ''}
                          </option>
                        ))
                      : null}
                    {activeKind === 'task'
                      ? templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} · {t(`taskType.${tpl.type}` as 'taskType.COMMAND')}
                          </option>
                        ))
                      : null}
                    {activeKind === 'workflow'
                      ? workflows.map((wf) => (
                          <option key={wf.id} value={wf.id}>
                            {wf.name}
                            {wf.steps?.length ? ` · ${wf.steps.length} bước` : ''}
                          </option>
                        ))
                      : null}
                  </select>
                )}
              </div>
            </div>

            <footer className="shrink-0 px-5 py-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5"
              >
                {t('common.cancel')}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openModal}
        className={cn(
          'w-full flex items-center gap-2 font-bold border transition-all',
          compact
            ? 'px-3 py-2 rounded-xl border-white/10 hover:bg-white/5 text-xs'
            : 'px-3 py-2.5 rounded-xl border-primary/30 bg-primary/10 hover:bg-primary/15 text-sm text-primary',
        )}
      >
        <Download size={compact ? 14 : 16} className="shrink-0" />
        <span className="flex-1 text-left">{t('workflows.importMenu.button')}</span>
      </button>
      {modal}
    </div>
  );
}
