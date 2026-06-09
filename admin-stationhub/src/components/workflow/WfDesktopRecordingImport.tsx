import { useQuery } from '@tanstack/react-query';
import { MonitorPlay } from 'lucide-react';
import { apiFetch } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { DesktopRecording } from '@/src/types/api';

type Props = {
  onImport: (recording: DesktopRecording) => void;
  compact?: boolean;
  className?: string;
};

export function WfDesktopRecordingImport({ onImport, compact, className }: Props) {
  const { data: recordingsRaw, isLoading } = useQuery({
    queryKey: ['desktop-recordings', 'wf-import'],
    queryFn: () => apiFetch<DesktopRecording[]>('/desktop-recordings'),
  });
  const recordings = Array.isArray(recordingsRaw) ? recordingsRaw : [];

  const selectCls = compact
    ? 'w-full mt-1 px-2 py-2 rounded-lg bg-surface-container-low border border-white/10 text-xs'
    : 'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';

  if (isLoading) {
    return (
      <p className={`text-[10px] text-on-surface-variant ${className ?? ''}`}>
        {t('common.loading')}
      </p>
    );
  }

  if (recordings.length === 0) {
    return (
      <p className={`text-[10px] text-on-surface-variant leading-snug ${className ?? ''}`}>
        {t('templateWizard.desktopRecordingImportEmpty')}
      </p>
    );
  }

  const handleChange = (id: string) => {
    if (!id) return;
    const rec = recordings.find((x) => x.id === id);
    if (!rec) return;
    onImport(rec);
  };

  return (
    <div className={className}>
      {compact ? (
        <div className="flex items-center gap-1.5 mb-1.5">
          <MonitorPlay size={14} className="text-primary shrink-0" />
          <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('templateWizard.desktopRecordingImport')}
          </span>
        </div>
      ) : (
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('templateWizard.desktopRecordingImport')}
        </label>
      )}
      <select
        className={selectCls}
        defaultValue=""
        onChange={(e) => {
          handleChange(e.target.value);
          e.target.value = '';
        }}
      >
        <option value="">{t('templateWizard.desktopRecordingImportPlaceholder')}</option>
        {recordings.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.agent?.name ? ` (${r.agent.name})` : ''}
            {Array.isArray(r.steps) ? ` · ${r.steps.length}` : ''}
          </option>
        ))}
      </select>
      {compact ? (
        <p className="text-[9px] text-on-surface-variant/60 mt-1 leading-snug">
          {t('workflows.desktopRecordingImportHint')}
        </p>
      ) : null}
    </div>
  );
}
