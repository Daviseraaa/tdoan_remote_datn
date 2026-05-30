import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileJson, Trash2, RefreshCw, ChevronRight, AlertCircle, X, Loader2 } from 'lucide-react';
import { useChromeScriptsList, useChromeScriptMutations } from '@/src/hooks/useChromeScripts';
import { useAgentsList } from '@/src/hooks/useAgents';
import { t } from '@/src/i18n/t';
import { apiErrorMessage } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { buildAgentClusters, isAgentOnline, syncAllOnlineAgents } from '@/src/lib/agentClusters';
import { AgentRecordingListHeader } from '@/src/components/recordings/AgentRecordingListHeader';
import { AgentResourceClusterList } from '@/src/components/recordings/AgentResourceClusterList';
import {
  RECORDING_LIST_ACTION_BTN,
  RECORDING_LIST_ROW,
  RECORDING_LIST_ROW_MAIN,
} from '@/src/components/recordings/recordingListItemStyles';
import type { ChromeScript } from '@/src/types/api';
import { TaskEmptyState } from '@/src/components/tasks/TaskEmptyState';

export default function ChromeScripts() {
  const navigate = useNavigate();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const agents = agentsPage?.items ?? [];
  const { data: scriptsRaw, isLoading, error, refetch } = useChromeScriptsList();
  const scripts = Array.isArray(scriptsRaw) ? scriptsRaw : [];
  const { remove, syncFromAgent } = useChromeScriptMutations();
  const [msg, setMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const listError = error ? apiErrorMessage(error) : '';

  const clusters = useMemo(() => buildAgentClusters(scripts, agents), [scripts, agents]);
  const onlineCount = agents.filter((a) => isAgentOnline(a.status)).length;

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('chromeScripts.deleteConfirm'))) return;
    try {
      await remove.mutateAsync(id);
      setMsg(t('chromeScripts.deleted'));
      setActionError('');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const onSyncAllOnline = async () => {
    const online = agents.filter((a) => isAgentOnline(a.status));
    if (online.length === 0) {
      setActionError(t('agentClusters.noOnlineAgents'));
      return;
    }
    setSyncing(true);
    setActionError('');
    try {
      const summary = await syncAllOnlineAgents(agents, (agentId) =>
        syncFromAgent.mutateAsync(agentId),
      );
      if (summary.errors.length === 0) {
        setMsg(
          t('agentClusters.syncAllSuccess', {
            agents: String(summary.results.length),
            inserted: String(summary.totals.inserted),
            updated: String(summary.totals.updated),
            skipped: String(summary.totals.skipped),
            total: String(summary.totals.total),
          }),
        );
      } else if (summary.results.length > 0) {
        setMsg(
          t('agentClusters.syncAllPartial', {
            ok: String(summary.results.length),
            total: String(online.length),
            inserted: String(summary.totals.inserted),
            updated: String(summary.totals.updated),
            errors: summary.errors.map((e) => `${e.agentName}: ${e.message}`).join('; '),
          }),
        );
      } else {
        setActionError(summary.errors.map((e) => `${e.agentName}: ${e.message}`).join('; '));
      }
      void refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  const showEmpty = !isLoading && clusters.length === 0;

  return (
    <div className="pb-12 sm:pb-16 min-w-0 max-w-full space-y-4 sm:space-y-0">
      <AgentRecordingListHeader
        title={t('chromeScripts.title')}
        subtitle={
          <>
            {t('chromeScripts.subtitle')}{' '}
            <Link to="/docs#chrome" className="text-primary font-semibold hover:underline">
              {t('docs.seeAlso')}
            </Link>
          </>
        }
        onlineCount={onlineCount}
        syncing={syncing}
        syncLabel={t('chromeScripts.syncFromAgent')}
        onSync={() => void onSyncAllOnline()}
        onRetry={() => void refetch()}
      />

      {msg ? (
        <div className="mb-3 sm:mb-4 flex items-start sm:items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm min-w-0">
          <RefreshCw size={16} className="shrink-0 mt-0.5 sm:mt-0" />
          <span className="flex-1 min-w-0 break-words">{msg}</span>
          <button type="button" onClick={() => setMsg('')} className="p-1 hover:bg-white/10 rounded">
            <X size={14} />
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-3 sm:mb-4 flex items-start sm:items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm min-w-0">
          <AlertCircle size={16} className="shrink-0 mt-0.5 sm:mt-0" />
          <span className="flex-1 min-w-0 break-words">{actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="p-1 hover:bg-white/10 rounded">
            <X size={14} />
          </button>
        </div>
      ) : null}
      {listError ? (
        <div className="mb-4 sm:mb-6 flex items-start gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm min-w-0">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0 break-words">{listError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-20 text-on-surface-variant">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : showEmpty ? (
        <TaskEmptyState
          icon={FileJson}
          title={t('chromeScripts.empty')}
          description={onlineCount > 0 ? t('agentClusters.emptyClusterChrome') : t('chromeScripts.selectHint')}
        />
      ) : (
        <AgentResourceClusterList<ChromeScript>
          clusters={clusters}
          emptyClusterHint={t('agentClusters.emptyClusterChrome')}
          getItemKey={(s) => s.id}
          renderItem={(s) => (
            <div
              className={cn(
                'group transition-colors hover:bg-surface-container-low/70',
              )}
            >
              <div className={RECORDING_LIST_ROW}>
                <button
                  type="button"
                  onClick={() => navigate(`/chrome-scripts/${s.id}/edit`)}
                  className={RECORDING_LIST_ROW_MAIN}
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-container-high/80 flex items-center justify-center shrink-0">
                    <FileJson size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate text-on-surface">{s.name}</div>
                    <div className="text-xs text-on-surface-variant truncate mt-0.5">
                      {s.startUrl || '—'} · {Array.isArray(s.steps) ? s.steps.length : 0}{' '}
                      {t('chromeScripts.steps')}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDelete(e, s.id)}
                  className={cn(RECORDING_LIST_ACTION_BTN, 'hover:bg-red-500/20 text-red-300')}
                  title={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
        />
      )}
      <p className="text-xs text-on-surface-variant mt-3 sm:mt-4 px-0.5">{t('chromeScripts.selectHint')}</p>
    </div>
  );
}
