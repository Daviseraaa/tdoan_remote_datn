import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  File,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import { useAgentDetail } from '@/src/hooks/useAgents';
import * as agentsApi from '@/src/api/agents';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { AgentFileEntry } from '@/src/types/api';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModified(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('vi-VN');
}

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (p: string) => void;
}) {
  const parts = path ? path.split('/').filter(Boolean) : [];
  const crumbs = [{ label: t('agentFiles.root'), path: '' }, ...parts.map((p, i) => ({
    label: p,
    path: parts.slice(0, i + 1).join('/'),
  }))];

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs font-mono text-on-surface-variant min-w-0">
      {crumbs.map((c, i) => (
        <span key={c.path || 'root'} className="inline-flex items-center gap-1 min-w-0">
          {i > 0 ? <ChevronRight size={12} className="shrink-0 opacity-50" /> : null}
          <button
            type="button"
            onClick={() => onNavigate(c.path)}
            className={cn(
              'truncate max-w-[10rem] sm:max-w-none hover:text-primary transition-colors',
              i === crumbs.length - 1 && 'text-primary font-bold',
            )}
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function FileRow({
  entry,
  onOpenDir,
  onDownload,
  downloading,
}: {
  entry: AgentFileEntry;
  onOpenDir: (path: string) => void;
  onDownload: (path: string) => void;
  downloading: boolean;
}) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
      <td className="px-4 py-3">
        {entry.isDir ? (
          <button
            type="button"
            onClick={() => onOpenDir(entry.path)}
            className="flex items-center gap-3 min-w-0 text-left group w-full"
          >
            <Folder className="text-amber-400/90 shrink-0 group-hover:hidden" size={18} />
            <FolderOpen className="text-amber-400 shrink-0 hidden group-hover:block" size={18} />
            <span className="font-medium text-on-surface truncate group-hover:text-primary">
              {entry.name}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <File className="text-on-surface-variant shrink-0" size={18} />
            <span className="font-mono text-sm truncate">{entry.name}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-on-surface-variant whitespace-nowrap hidden sm:table-cell">
        {entry.isDir ? t('agentFiles.folder') : formatBytes(entry.size)}
      </td>
      <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap hidden md:table-cell">
        {formatModified(entry.modifiedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {!entry.isDir ? (
          <button
            type="button"
            disabled={downloading}
            onClick={() => onDownload(entry.path)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 hover:bg-white/5 disabled:opacity-40"
          >
            <Download size={12} />
            {t('agentFiles.download')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDir(entry.path)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-primary/20 text-primary hover:bg-primary/10"
          >
            <FolderOpen size={12} />
            {t('agentFiles.open')}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AgentFilesBrowser() {
  const { id: agentId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const currentPath = searchParams.get('path') ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: agent } = useAgentDetail(agentId);
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['agent-files', isAdmin, agentId, currentPath],
    queryFn: () => agentsApi.listAgentFiles(isAdmin, agentId!, currentPath),
    enabled: Boolean(agentId),
    retry: 1,
  });

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);

  const goToPath = (path: string) => {
    const next = new URLSearchParams(searchParams);
    if (path) next.set('path', path);
    else next.delete('path');
    setSearchParams(next);
  };

  const handleDownload = async (path: string) => {
    if (!agentId) return;
    try {
      await agentsApi.downloadAgentFile(isAdmin, agentId, path);
    } catch (err) {
      window.alert(apiErrorMessage(err));
    }
  };

  const offline = agent && agent.status !== 'ONLINE' && agent.status !== 'BUSY';
  const canUpload = !offline && currentPath.length > 0;

  const handleUploadPick = () => {
    if (!canUpload) {
      window.alert(t('agentFiles.uploadWrongPath'));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (file: File) => {
    if (!agentId || !canUpload) return;
    const base = currentPath.replace(/\/$/, '');
    const targetPath = `${base}/${file.name}`;
    setUploading(true);
    try {
      await agentsApi.uploadAgentFile(isAdmin, agentId, targetPath, file);
      window.alert(t('agentFiles.uploadSuccess'));
      void refetch();
    } catch (err) {
      window.alert(apiErrorMessage(err) || t('agentFiles.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary"
          >
            <ArrowLeft size={14} />
            {t('agentFiles.backToAgents')}
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
              <HardDrive className="text-primary" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                {t('agentFiles.title')}
              </h1>
              <p className="text-sm text-on-surface-variant truncate">
                {agent?.name ?? agentId}
                {data?.root ? (
                  <span className="block text-[10px] font-mono mt-0.5 opacity-70 truncate">
                    {data.root}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadFile(file);
            }}
          />
          <button
            type="button"
            onClick={handleUploadPick}
            disabled={uploading || offline || !canUpload}
            title={t('agentFiles.uploadHint')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            <Upload size={16} className={uploading ? 'animate-pulse' : ''} />
            {uploading ? t('common.loading') : t('agentFiles.upload')}
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching || offline}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 disabled:opacity-40"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        </div>
      </header>

      {offline ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {t('agentFiles.offlineHint')}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-surface-container-low/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Breadcrumbs path={currentPath} onNavigate={goToPath} />
          <p className="text-[10px] font-mono text-on-surface-variant">
            {t('agentFiles.entryCount', { count: String(entries.length) })}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16 text-on-surface-variant">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-error">{apiErrorMessage(error)}</p>
            <button
              type="button"
              onClick={() => navigate('/agents')}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t('agentFiles.backToAgents')}
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-on-surface-variant">
            {t('agentFiles.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[32rem]">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-white/5">
                  <th className="px-4 py-2.5 font-bold">{t('agentFiles.colName')}</th>
                  <th className="px-4 py-2.5 font-bold hidden sm:table-cell">{t('agentFiles.colSize')}</th>
                  <th className="px-4 py-2.5 font-bold hidden md:table-cell">{t('agentFiles.colModified')}</th>
                  <th className="px-4 py-2.5 font-bold text-right">{t('agentFiles.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {currentPath ? (
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <td colSpan={4} className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          const parent = currentPath.split('/').slice(0, -1).join('/');
                          goToPath(parent);
                        }}
                        className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary"
                      >
                        <ArrowLeft size={14} />
                        {t('agentFiles.goUp')}
                      </button>
                    </td>
                  </tr>
                ) : null}
                {entries.map((entry) => (
                  <FileRow
                    key={entry.path}
                    entry={entry}
                    onOpenDir={goToPath}
                    onDownload={(p) => void handleDownload(p)}
                    downloading={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-on-surface-variant px-1">{t('agentFiles.sandboxHint')}</p>
    </div>
  );
}
