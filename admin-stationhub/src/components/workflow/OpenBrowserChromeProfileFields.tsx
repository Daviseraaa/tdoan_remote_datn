import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { syncAgentChromeProfiles } from '@/src/api/agents';
import { useAgentDetail } from '@/src/hooks/useAgents';
import { useAuth } from '@/src/hooks/useAuth';
import { apiErrorMessage } from '@/src/lib/api';
import { queryKeys } from '@/src/lib/queryKeys';
import type { AgentChromeProfile } from '@/src/types/api';

type Props = {
  agentId: string;
  value: string;
  onChange: (profileDirectory: string) => void;
  className?: string;
};

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';

export function OpenBrowserChromeProfileFields({
  agentId,
  value,
  onChange,
  className,
}: Props) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: agent } = useAgentDetail(agentId || undefined);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<AgentChromeProfile[]>([]);

  const agentOnline = agent?.status === 'ONLINE' || agent?.status === 'BUSY';
  const chromeProfiles = agent?.chromeProfiles ?? [];
  const profiles = localProfiles.length > 0 ? localProfiles : chromeProfiles;
  const hasList = profiles.length > 0;

  const handleSync = async () => {
    if (!agentId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await syncAgentChromeProfiles(agentId);
      setLocalProfiles(res.profiles);
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, agentId) });
      if (res.profiles.length > 0 && !res.profiles.some((p) => p.directory === value)) {
        onChange(res.profiles[0]!.directory);
      }
    } catch (e) {
      setSyncError(apiErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.openBrowserChromeProfile')}
        </label>
        <button
          type="button"
          disabled={!agentId || !agentOnline || syncing}
          onClick={() => void handleSync()}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border',
            'border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40',
          )}
          title={t('agents.fetchChromeProfiles')}
        >
          {syncing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {t('agents.fetchChromeProfiles')}
        </button>
      </div>

      {hasList ? (
        <select
          value={value || 'Default'}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputCls, 'font-mono')}
        >
          {profiles.map((p) => (
            <option key={p.directory} value={p.directory}>
              {p.name ? `${p.name} (${p.directory})` : p.directory}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value || 'Default'}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Default"
          className={cn(inputCls, 'font-mono')}
        />
      )}

      <p className="text-[10px] text-on-surface-variant">
        {t('workflows.openBrowserChromeProfileHint')}
      </p>
      {!agentOnline ? (
        <p className="text-[10px] text-amber-400/90">{t('agents.chromeProfilesOffline')}</p>
      ) : null}
      {syncError ? <p className="text-[10px] text-error">{syncError}</p> : null}
    </div>
  );
}
