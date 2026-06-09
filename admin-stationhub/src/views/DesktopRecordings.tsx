import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MousePointer2,
  Trash2,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  X,
  Loader2,
  ListTodo,
} from 'lucide-react';
import {
  useDesktopRecordingsList,
  useDesktopRecordingMutations,
} from '@/src/hooks/useDesktopRecordings';
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
import type { DesktopRecording } from '@/src/types/api';
import { TaskEmptyState } from '@/src/components/tasks/TaskEmptyState';

export default function DesktopRecordings() {
  const navigate = useNavigate();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const agents = agentsPage?.items ?? [];
  const { data: recordingsRaw, isLoading, error, refetch } = useDesktopRecordingsList();
  const recordings = Array.isArray(recordingsRaw) ? recordingsRaw : [];
  const { remove, syncFromAgent, createTemplate } = useDesktopRecordingMutations();
  const [msg, setMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const listError = error ? apiErrorMessage(error) : '';

  const clusters = useMemo(() => buildAgentClusters(recordings, agents), [recordings, agents]);
  const onlineCount = agents.filter((a) => isAgentOnline(a.status)).length;

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('desktopRecordings.deleteConfirm'))) return;
    try {
      await remove.mutateAsync(id);
      setMsg(t('desktopRecordings.deleted'));
      setActionError('');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const onCreateTemplate = async (e: React.MouseEvent, id: string, agentId?: string | null) => {
    e.stopPropagation();
    const aid = agentId || agents[0]?.id;
    if (!aid) {
      setActionError(t('desktopRecordings.needAgent'));
      return;
    }
    try {
      const res = await createTemplate.mutateAsync({ id, agentId: aid });
      setMsg(t('desktopRecordings.templateCreated'));
      setActionError('');
      navigate(`/tasks/templates/${res.template.id}/edit`);
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
        title={t('desktopRecordings.title')}
        subtitle={
          <>
            {t('desktopRecordings.subtitle')}{' '}
            <Link to="/docs#desktop" className="text-primary font-semibold hover:underline">
              {t('docs.seeAlso')}
            </Link>
          </>
        }
        onlineCount={onlineCount}
        syncing={syncing}
        syncLabel={t('desktopRecordings.syncFromAgent')}
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
          icon={MousePointer2}
          title={t('desktopRecordings.empty')}
          description={onlineCount > 0 ? t('agentClusters.emptyClusterDesktop') : t('desktopRecordings.emptyHint')}
        />
      ) : (
        <AgentResourceClusterList<DesktopRecording>
          clusters={clusters}
          emptyClusterHint={t('agentClusters.emptyClusterDesktop')}
          getItemKey={(rec) => rec.id}
          renderItem={(rec) => (
            <div className={cn('group transition-colors hover:bg-surface-container-low/70')}>
              <div className={RECORDING_LIST_ROW}>
                <button
                  type="button"
                  onClick={() => navigate(`/desktop-recordings/${rec.id}/edit`)}
                  className={RECORDING_LIST_ROW_MAIN}
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-container-high/80 flex items-center justify-center shrink-0">
                    <MousePointer2 size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate text-on-surface">{rec.name}</div>
                    <div className="text-xs text-on-surface-variant truncate mt-0.5">
                      {Array.isArray(rec.steps) ? rec.steps.length : 0} {t('desktopRecordings.steps')}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={(e) => onCreateTemplate(e, rec.id, rec.agentId)}
                  className={cn(RECORDING_LIST_ACTION_BTN, 'hover:bg-primary/20 text-primary')}
                  title={t('desktopRecordings.createTemplate')}
                >
                  <ListTodo size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDelete(e, rec.id)}
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
      <p className="text-xs text-on-surface-variant mt-3 sm:mt-4 px-0.5">{t('desktopRecordings.selectHint')}</p>
    </div>
  );
}
