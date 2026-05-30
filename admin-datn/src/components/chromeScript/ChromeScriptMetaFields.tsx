import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

type Props = {
  name: string;
  startUrl: string;
  readOnly?: boolean;
  onChange: (patch: { name?: string; startUrl?: string }) => void;
};

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm disabled:opacity-80 disabled:cursor-default';

export function ChromeScriptMetaFields({ name, startUrl, readOnly = false, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('chromeScripts.fieldName')}
        </label>
        <input
          value={name}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('chromeScripts.fieldStartUrl')}
        </label>
        <input
          value={startUrl}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange({ startUrl: e.target.value })}
          placeholder="https://example.com/"
          className={cn(inputCls, 'font-mono')}
        />
      </div>
    </div>
  );
}
