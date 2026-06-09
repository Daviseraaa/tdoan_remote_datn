import { Globe, Chrome } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  type OpenBrowserFormState,
  type TriState,
  parseOpenBrowserForm,
  buildOpenBrowserTask,
} from '@/src/lib/openBrowserPayload';
import { t } from '@/src/i18n/t';
import { OpenBrowserChromeProfileFields } from './OpenBrowserChromeProfileFields';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

type Props = {
  command: string;
  payload?: Record<string, unknown> | null;
  agentId?: string;
  onChange: (patch: { command: string; payload: Record<string, unknown> }) => void;
  compact?: boolean;
};

const URL_PRESETS = [
  { key: 'google', url: 'https://www.google.com' },
  { key: 'blank', url: 'about:blank' },
] as const;

function TriStateSelect({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  const options: { id: TriState; label: string }[] = [
    { id: 'default', label: t('openBrowser.triDefault') },
    { id: 'on', label: t('openBrowser.triOn') },
    { id: 'off', label: t('openBrowser.triOff') },
  ];
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
              value === opt.id
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'border-white/10 text-on-surface-variant hover:bg-white/5',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint ? <p className="text-[10px] text-on-surface-variant mt-1">{hint}</p> : null}
    </div>
  );
}

export function OpenBrowserConfigFields({
  command,
  payload,
  agentId,
  onChange,
  compact,
}: Props) {
  const form = parseOpenBrowserForm(command, payload);

  const emit = (next: OpenBrowserFormState) => {
    onChange(buildOpenBrowserTask(next));
  };

  const patch = (p: Partial<OpenBrowserFormState>) => emit({ ...form, ...p });

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border border-white/5 bg-surface-container-low/30 p-4')}>
      {!compact ? (
        <div className="flex items-center gap-3">
          <Globe size={20} className="text-primary shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-on-surface">{t('taskType.OPEN_BROWSER')}</h4>
            <p className="text-xs text-on-surface-variant">{t('openBrowser.subtitle')}</p>
          </div>
        </div>
      ) : null}

      <div>
        <label className={labelCls}>{t('openBrowser.url')}</label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://example.com"
          className={cn(inputCls, 'font-mono')}
        />
        <p className="text-[10px] text-on-surface-variant mt-1">{t('openBrowser.urlHint')}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {URL_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => patch({ url: preset.url })}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/10 text-on-surface-variant hover:border-primary/30 hover:text-primary"
            >
              {t(`openBrowser.preset_${preset.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('workflows.openBrowserEngine')}</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => patch({ useChromeProfile: false })}
            className={cn(
              'text-left p-3 rounded-xl border transition-all',
              !form.useChromeProfile
                ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20'
                : 'border-white/10 hover:border-white/20',
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-on-surface">
              <Globe size={16} className="text-primary" />
              {t('workflows.openBrowserEngineCloak')}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
              {t('openBrowser.cloakDesc')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => patch({ useChromeProfile: true })}
            className={cn(
              'text-left p-3 rounded-xl border transition-all',
              form.useChromeProfile
                ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20'
                : 'border-white/10 hover:border-white/20',
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-on-surface">
              <Chrome size={16} className="text-primary" />
              {t('workflows.openBrowserEngineChrome')}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
              {t('openBrowser.chromeDesc')}
            </p>
          </button>
        </div>
      </div>

      {form.useChromeProfile ? (
        agentId ? (
          <OpenBrowserChromeProfileFields
            agentId={agentId}
            value={form.chromeProfile}
            onChange={(profile) => patch({ chromeProfile: profile })}
          />
        ) : (
          <p className="text-[10px] text-amber-400/90">{t('workflows.openBrowserSelectAgentFirst')}</p>
        )
      ) : (
        <div>
          <label className={labelCls}>{t('openBrowser.userDataDir')}</label>
          <input
            type="text"
            value={form.userDataDir}
            onChange={(e) => patch({ userDataDir: e.target.value })}
            placeholder={t('openBrowser.userDataDirPlaceholder')}
            className={cn(inputCls, 'font-mono text-xs')}
          />
          <p className="text-[10px] text-on-surface-variant mt-1">{t('openBrowser.userDataDirHint')}</p>
        </div>
      )}

      <details className="rounded-xl border border-white/10 bg-surface-container-low/40 group">
        <summary className="px-4 py-3 cursor-pointer text-[10px] font-mono font-bold uppercase text-on-surface-variant hover:bg-white/5 rounded-xl">
          {t('openBrowser.advanced')}
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5">
          <TriStateSelect
            label={t('openBrowser.headless')}
            hint={t('openBrowser.headlessHint')}
            value={form.headless}
            onChange={(headless) => patch({ headless })}
          />
          <TriStateSelect
            label={t('openBrowser.humanize')}
            hint={t('openBrowser.humanizeHint')}
            value={form.humanize}
            onChange={(humanize) => patch({ humanize })}
          />
          <TriStateSelect
            label={t('openBrowser.keepOpen')}
            hint={t('openBrowser.keepOpenHint')}
            value={form.keepOpen}
            onChange={(keepOpen) => patch({ keepOpen })}
          />
          {form.useChromeProfile ? (
            <>
              <div>
                <label className={labelCls}>{t('openBrowser.chromeUserDataDir')}</label>
                <input
                  type="text"
                  value={form.chromeUserDataDir}
                  onChange={(e) => patch({ chromeUserDataDir: e.target.value })}
                  placeholder={t('openBrowser.chromeUserDataDirPlaceholder')}
                  className={cn(inputCls, 'font-mono text-xs')}
                />
              </div>
              <div>
                <label className={labelCls}>{t('openBrowser.chromeExecutablePath')}</label>
                <input
                  type="text"
                  value={form.chromeExecutablePath}
                  onChange={(e) => patch({ chromeExecutablePath: e.target.value })}
                  placeholder="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                  className={cn(inputCls, 'font-mono text-xs')}
                />
              </div>
            </>
          ) : null}
        </div>
      </details>
    </div>
  );
}
