import React, { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Monitor, Power, Save } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { CopyButton } from '@/src/components/CopyButton';
import { openRustDeskConnect, parseAgentRemoteAccess } from '@/src/lib/remoteAccess';
import { onAgentRemoteReady } from '@/src/lib/ws';
import { t } from '@/src/i18n/t';
import type { Agent, StartAgentRemoteResponse, UpdateRemoteAccessDto } from '@/src/types/api';

type AgentRemoteAccessPanelProps = {
  agent: Agent;
  agentOnline: boolean;
  onWake: () => void;
  onSave: (dto: UpdateRemoteAccessDto) => void;
  onStartRemote: () => Promise<StartAgentRemoteResponse>;
  onStopRemote: () => void;
  waking: boolean;
  saving: boolean;
  startingRemote: boolean;
  stoppingRemote: boolean;
  wakeError?: string;
  saveError?: string;
  remoteError?: string;
  wakeMessage?: string;
  remoteResult?: StartAgentRemoteResponse | null;
};

export function AgentRemoteAccessPanel({
  agent,
  agentOnline,
  onWake,
  onSave,
  onStartRemote,
  onStopRemote,
  waking,
  saving,
  startingRemote,
  stoppingRemote,
  wakeError,
  saveError,
  remoteError,
  wakeMessage,
  remoteResult,
}: AgentRemoteAccessPanelProps) {
  const remote = parseAgentRemoteAccess(
    agent.metadata as Record<string, unknown> | undefined,
    agent.hostname,
  );

  const [wolMac, setWolMac] = useState(remote.wolMacAddress);
  const [wolBroadcast, setWolBroadcast] = useState(remote.wolBroadcast);
  const [rdpHost, setRdpHost] = useState(remote.rdpHost);
  const [sessionCreds, setSessionCreds] = useState<{
    rustdeskId: string;
    rustdeskPassword: string;
  } | null>(null);

  useEffect(() => {
    setWolMac(remote.wolMacAddress);
    setWolBroadcast(remote.wolBroadcast);
    setRdpHost(remote.rdpHost);
  }, [agent.id, remote.wolMacAddress, remote.wolBroadcast, remote.rdpHost]);

  const saveDto = (): UpdateRemoteAccessDto => ({
    wolMacAddress: wolMac.trim(),
    wolBroadcast: wolBroadcast.trim(),
    rdpHost: rdpHost.trim(),
  });

  const remoteActive = remote.rustdeskRemoteActive;

  const canStartRemote = agentOnline && !remoteActive;
  const remoteBusy = startingRemote || stoppingRemote;

  const rememberSessionCreds = useCallback(
    (rustdeskId?: string, rustdeskPassword?: string) => {
      if (!rustdeskId?.trim() || !rustdeskPassword) return;
      setSessionCreds({
        rustdeskId: rustdeskId.trim(),
        rustdeskPassword,
      });
    },
    [],
  );

  const handleRemoteReady = useCallback(
    (payload: { agentId: string; rustdeskId: string; rustdeskPassword: string }) => {
      if (payload.agentId !== agent.id) return;
      rememberSessionCreds(payload.rustdeskId, payload.rustdeskPassword);
    },
    [agent.id, rememberSessionCreds],
  );

  useEffect(() => onAgentRemoteReady(handleRemoteReady), [handleRemoteReady]);

  useEffect(() => {
    if (!remoteActive) {
      setSessionCreds(null);
      return;
    }
    rememberSessionCreds(remoteResult?.rustdeskId, remoteResult?.rustdeskPassword);
  }, [
    remoteActive,
    remoteResult?.rustdeskId,
    remoteResult?.rustdeskPassword,
    rememberSessionCreds,
  ]);

  const handleRemoteToggle = async () => {
    if (remoteActive) {
      onStopRemote();
      return;
    }
    try {
      const result = await onStartRemote();
      rememberSessionCreds(result.rustdeskId, result.rustdeskPassword);
    } catch {
      /* remoteError hiển thị từ mutation */
    }
  };

  const handleOpenRemoteSession = () => {
    if (!sessionCreds) return;
    openRustDeskConnect(sessionCreds.rustdeskId, sessionCreds.rustdeskPassword);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em]">
            {t('agents.remoteAccessTitle')}
          </h4>
          <button
            type="button"
            disabled={waking || !wolMac.trim()}
            onClick={onWake}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-tertiary/30 text-tertiary hover:bg-tertiary/10 disabled:opacity-40 w-full sm:w-auto shrink-0"
          >
            <Power size={12} className={waking ? 'animate-pulse' : ''} />
            {waking ? t('agents.wolSending') : t('agents.wolWake')}
          </button>
        </div>
        <p className="text-[10px] text-on-surface-variant px-1">{t('agents.remoteAccessHint')}</p>

        <div className="bg-surface-container-high/50 rounded-2xl border border-white/5 p-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
              {t('agents.wolMac')}
            </span>
            <input
              value={wolMac}
              onChange={(e) => setWolMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full rounded-lg bg-surface-container-lowest border border-white/10 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
              {t('agents.wolBroadcast')}
            </span>
            <input
              value={wolBroadcast}
              onChange={(e) => setWolBroadcast(e.target.value)}
              placeholder="192.168.1.255"
              className="w-full rounded-lg bg-surface-container-lowest border border-white/10 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
              {t('agents.rdpHost')}
            </span>
            <input
              value={rdpHost}
              onChange={(e) => setRdpHost(e.target.value)}
              placeholder="DESKTOP-ABC"
              className="w-full rounded-lg bg-surface-container-lowest border border-white/10 px-3 py-2 text-sm font-mono"
            />
          </label>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-on-surface-variant">
              RDP:{' '}
              <span
                className={cn(
                  'font-bold',
                  remote.rdpEnabled ? 'text-tertiary' : 'text-on-surface-variant/60',
                )}
              >
                {remote.rdpEnabled ? t('agents.rdpEnabled') : t('agents.rdpDisabled')}
              </span>
            </span>
            <span className="text-on-surface-variant font-mono">
              {t('agents.rdpPort')}: {remote.rdpPort}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => onSave(saveDto())}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              <Save size={12} />
              {saving ? t('agents.remoteAccessSaving') : t('agents.remoteAccessSave')}
            </button>
            <CopyButton
              text={remote.rdpConnectionHint}
              disabled={!remote.rdpConnectionHint}
              iconSize={12}
              copyLabel={t('agents.copyRdpHint')}
              className="flex-1 sm:flex-none px-3 py-2 rounded-lg text-[10px] font-bold border border-white/10 text-on-surface-variant hover:bg-white/5"
            />
          </div>

          {remote.networkInterfaces.length > 0 ? (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/70">
                {t('agents.networkInterfaces')}
              </p>
              {remote.networkInterfaces.map((nic) => (
                <button
                  key={`${nic.name}-${nic.mac}`}
                  type="button"
                  onClick={() => setWolMac(nic.mac)}
                  className="w-full text-left text-[10px] font-mono text-on-surface-variant flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/5"
                  title={t('agents.useNicMac')}
                >
                  <span className="truncate">
                    {nic.name}
                    {nic.kind ? ` · ${nic.kind}` : ''}
                  </span>
                  <span className="shrink-0 text-primary">{nic.mac}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-amber-400/90 px-1">{t('agents.remoteAccessNoNics')}</p>
          )}

          {wakeMessage ? (
            <p className="text-[10px] text-tertiary px-1">{wakeMessage}</p>
          ) : null}
          {wakeError ? <p className="text-[10px] text-error px-1">{wakeError}</p> : null}
          {saveError ? <p className="text-[10px] text-error px-1">{saveError}</p> : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <h4 className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-[0.2em]">
            {t('agents.rustdeskTitle')}
          </h4>
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
            {remoteActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-tertiary/40 bg-tertiary/10 text-tertiary">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                {t('agents.rustdeskReadyBadge')}
              </span>
            ) : null}
            <button
              type="button"
              disabled={remoteBusy || (remoteActive ? !agentOnline : !canStartRemote)}
              onClick={() => void handleRemoteToggle()}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border disabled:opacity-40',
                remoteActive
                  ? 'border-error/30 text-error hover:bg-error/10'
                  : 'border-sky-400/30 text-sky-300 hover:bg-sky-400/10',
              )}
            >
              <Monitor size={12} className={remoteBusy ? 'animate-pulse' : ''} />
              {startingRemote
                ? t('agents.rustdeskStarting')
                : stoppingRemote
                  ? t('agents.rustdeskClosing')
                  : remoteActive
                    ? t('agents.rustdeskClose')
                    : t('agents.rustdeskStart')}
            </button>
          </div>
        </div>

        <div className="bg-sky-400/5 rounded-2xl border border-sky-400/20 p-4 space-y-2">
          <p className="text-[10px] text-on-surface-variant/80">{t('agents.rustdeskTrayHint')}</p>
          <p className="text-[10px] text-on-surface-variant/60">{t('agents.rustdeskClientHint')}</p>

          {!agentOnline ? (
            <p className="text-[10px] text-amber-400/90">{t('agents.rustdeskOffline')}</p>
          ) : null}

          {remoteActive ? (
            <button
              type="button"
              disabled={!sessionCreds}
              onClick={handleOpenRemoteSession}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-[10px] font-bold border border-tertiary/40 text-tertiary bg-tertiary/10 hover:bg-tertiary/20 disabled:opacity-40"
            >
              <ExternalLink size={12} />
              {t('agents.rustdeskOpenSession')}
            </button>
          ) : null}

          {remoteActive && !sessionCreds ? (
            <p className="text-[10px] text-amber-400/90">{t('agents.rustdeskSessionPending')}</p>
          ) : null}

          {remoteActive && remoteResult?.message ? (
            <p className="text-[10px] text-tertiary px-1">{remoteResult.message}</p>
          ) : null}

          {remote.lastRemoteStartAt ? (
            <p className="text-[10px] text-on-surface-variant/60 italic">
              {t('agents.rustdeskLastStart', {
                time: new Date(remote.lastRemoteStartAt).toLocaleString(),
              })}
            </p>
          ) : null}

          {remoteError ? <p className="text-[10px] text-error px-1">{remoteError}</p> : null}
        </div>
      </div>
    </div>
  );
}
