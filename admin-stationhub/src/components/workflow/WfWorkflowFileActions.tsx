import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { t } from '@/src/i18n/t';
import { cn } from '@/src/lib/utils';

type Props = {
  onExport: () => void;
  onImportFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

export function WfWorkflowFileActions({ onExport, onImportFile, disabled, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void onImportFile(file);
  };

  return (
    <div className={cn('flex items-center gap-1 shrink-0', className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json,.stationhub-workflow.json"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onExport}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 disabled:opacity-40"
        title={t('workflows.configFile.exportHint')}
      >
        <Download size={14} />
        <span className="hidden md:inline">{t('workflows.configFile.export')}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={pickFile}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 disabled:opacity-40"
        title={t('workflows.configFile.importHint')}
      >
        <Upload size={14} />
        <span className="hidden md:inline">{t('workflows.configFile.import')}</span>
      </button>
    </div>
  );
}
