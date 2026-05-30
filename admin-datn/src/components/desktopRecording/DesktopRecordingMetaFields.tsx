import { t } from '@/src/i18n/t';

type Props = {
  name: string;
  readOnly?: boolean;
  onChange: (patch: { name?: string }) => void;
};

export function DesktopRecordingMetaFields({ name, readOnly = false, onChange }: Props) {
  return (
    <div>
      <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
        {t('desktopRecordings.fieldName')}
      </label>
      <input
        value={name}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder={t('desktopRecordings.namePlaceholder')}
        className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-lg font-bold disabled:opacity-80 disabled:cursor-default"
      />
    </div>
  );
}
