import { useQuery } from '@tanstack/react-query';
import { FileJson } from 'lucide-react';
import { apiFetch } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { ChromeScript } from '@/src/types/api';

type Props = {
  onImport: (script: ChromeScript) => void;
  /** Thu gọn cho palette sidebar */
  compact?: boolean;
  className?: string;
};

export function WfChromeScriptImport({ onImport, compact, className }: Props) {
  const { data: scriptsRaw, isLoading } = useQuery({
    queryKey: ['chrome-scripts', 'wf-import'],
    queryFn: () => apiFetch<ChromeScript[]>('/chrome-scripts'),
  });
  const scripts = Array.isArray(scriptsRaw) ? scriptsRaw : [];

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

  if (scripts.length === 0) {
    return (
      <p className={`text-[10px] text-on-surface-variant leading-snug ${className ?? ''}`}>
        {t('chromeScripts.emptyImport')}
      </p>
    );
  }

  const handleChange = (id: string) => {
    if (!id) return;
    const s = scripts.find((x) => x.id === id);
    if (!s) return;
    onImport(s);
  };

  return (
    <div className={className}>
      {compact ? (
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileJson size={14} className="text-primary shrink-0" />
          <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('workflows.chromeScriptImport')}
          </span>
        </div>
      ) : (
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.chromeScriptImport')}
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
        <option value="">{t('workflows.chromeScriptImportPlaceholder')}</option>
        {scripts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.agent?.name ? ` (${s.agent.name})` : ''}
            {Array.isArray(s.steps) ? ` · ${s.steps.length}` : ''}
          </option>
        ))}
      </select>
      {compact ? (
        <p className="text-[9px] text-on-surface-variant/60 mt-1 leading-snug">
          {t('workflows.chromeScriptImportHint')}
        </p>
      ) : null}
    </div>
  );
}
