import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Plus, Trash2, Braces } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  HTTP_METHODS,
  HTTP_METHOD_STYLES,
  formatJsonBody,
  headersJsonToRows,
  methodAllowsBody,
  rowsToHeadersJson,
  type HeaderRow,
  type HttpMethod,
} from '@/src/lib/httpRequest';
import { t } from '@/src/i18n/t';

export type HttpRequestEditorValue = {
  url: string;
  method: HttpMethod;
  headersJson: string;
  body: string;
};

type Props = {
  value: HttpRequestEditorValue;
  onChange: (patch: Partial<HttpRequestEditorValue>) => void;
  showIntro?: boolean;
};

type RequestTab = 'headers' | 'body';

export function HttpRequestEditor({ value, onChange, showIntro = true }: Props) {
  const [tab, setTab] = useState<RequestTab>('headers');
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() =>
    headersJsonToRows(value.headersJson),
  );

  useEffect(() => {
    setHeaderRows(headersJsonToRows(value.headersJson));
  }, [value.headersJson]);

  const allowsBody = methodAllowsBody(value.method);

  useEffect(() => {
    if (!allowsBody && tab === 'body') setTab('headers');
  }, [allowsBody, tab]);

  const headerCount = useMemo(() => {
    try {
      const parsed = JSON.parse(value.headersJson || '{}') as Record<string, unknown>;
      return Object.keys(parsed).filter((k) => k.trim()).length;
    } catch {
      return 0;
    }
  }, [value.headersJson]);

  const syncHeaderRows = (rows: HeaderRow[]) => {
    const withTrailing =
      rows.length === 0 || rows[rows.length - 1].key.trim() || rows[rows.length - 1].value.trim()
        ? [...rows, { key: '', value: '' }]
        : rows;
    setHeaderRows(withTrailing);
    onChange({ headersJson: rowsToHeadersJson(withTrailing) });
  };

  const updateHeaderRow = (index: number, patch: Partial<HeaderRow>) => {
    const next = headerRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    syncHeaderRows(next);
  };

  const removeHeaderRow = (index: number) => {
    syncHeaderRows(headerRows.filter((_, i) => i !== index));
  };

  const addHeaderRow = () => {
    syncHeaderRows([...headerRows, { key: '', value: '' }]);
  };

  const formatBody = () => {
    const formatted = formatJsonBody(value.body);
    if (formatted != null) onChange({ body: formatted });
  };

  const tabBtn = (key: RequestTab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors',
        tab === key
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-on-surface',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-mono">
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="space-y-5">
      {showIntro ? (
        <div className="glass-card rounded-2xl p-5 sm:p-6 border border-tertiary/20 bg-tertiary/5">
          <div className="flex items-start gap-3">
            <Globe className="text-tertiary shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-on-surface">{t('taskType.HTTP_REQUEST')}</h3>
              <p className="text-sm text-on-surface-variant mt-2">{t('taskType.HTTP_REQUEST_desc')}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('httpRequest.request')}
        </label>
        <div className="mt-1 flex rounded-xl border border-white/10 overflow-hidden bg-[#0b0f14] focus-within:border-primary/40 transition-colors">
          <select
            value={value.method}
            onChange={(e) => onChange({ method: e.target.value as HttpMethod })}
            className={cn(
              'shrink-0 w-[108px] px-3 py-3 font-mono text-sm font-bold border-r border-white/10',
              'focus:outline-none cursor-pointer appearance-none text-center',
              HTTP_METHOD_STYLES[value.method],
            )}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m} className="bg-surface-container text-on-surface">
                {m}
              </option>
            ))}
          </select>
          <input
            value={value.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/v1/users"
            className="flex-1 min-w-0 px-4 py-3 font-mono text-sm text-[#d4d4d4] bg-transparent focus:outline-none"
          />
        </div>
        <p className="text-[10px] text-on-surface-variant mt-1.5">{t('workflows.commandVarsHint')}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface-container-low/30 overflow-hidden">
        <div className="flex gap-1 px-3 pt-2 border-b border-white/5">
          {tabBtn('headers', t('httpRequest.tabHeaders'), headerCount)}
          {allowsBody ? tabBtn('body', t('httpRequest.tabBody')) : null}
        </div>

        <div className="p-3 sm:p-4">
          {tab === 'headers' ? (
            <div className="space-y-2">
              <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_32px] gap-2 px-1">
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('httpRequest.headerKey')}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('httpRequest.headerValue')}
                </span>
                <span />
              </div>
              {headerRows.map((row, index) => {
                const isTrailingEmpty =
                  index === headerRows.length - 1 && !row.key.trim() && !row.value.trim();
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_32px] gap-2 items-center"
                  >
                    <input
                      value={row.key}
                      onChange={(e) => updateHeaderRow(index, { key: e.target.value })}
                      placeholder={t('httpRequest.headerKeyPlaceholder')}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-white/10 font-mono text-xs focus:outline-none focus:border-primary/40"
                    />
                    <input
                      value={row.value}
                      onChange={(e) => updateHeaderRow(index, { value: e.target.value })}
                      placeholder={t('httpRequest.headerValuePlaceholder')}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-white/10 font-mono text-xs focus:outline-none focus:border-primary/40"
                    />
                    {!isTrailingEmpty ? (
                      <button
                        type="button"
                        onClick={() => removeHeaderRow(index)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors justify-self-end sm:justify-self-center"
                        title={t('httpRequest.removeHeader')}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addHeaderRow}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 mt-1"
              >
                <Plus size={14} />
                {t('httpRequest.addHeader')}
              </button>
              <p className="text-[10px] text-on-surface-variant pt-1">{t('httpRequest.headersHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('httpRequest.bodyRaw')}
                </span>
                <button
                  type="button"
                  onClick={formatBody}
                  disabled={!value.body.trim()}
                  className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant hover:text-primary disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Braces size={12} />
                  {t('httpRequest.formatJson')}
                </button>
              </div>
              <textarea
                value={value.body}
                onChange={(e) => onChange({ body: e.target.value })}
                rows={8}
                placeholder={'{\n  "name": "{{workflow.USER_NAME}}"\n}'}
                className="w-full px-4 py-3 rounded-xl bg-[#0b0f14] border border-white/10 font-mono text-sm text-[#d4d4d4] focus:outline-none focus:border-primary/40 resize-y min-h-[140px]"
              />
              <p className="text-[10px] text-on-surface-variant">{t('httpRequest.bodyHint')}</p>
            </div>
          )}

          {!allowsBody ? (
            <p className="text-[10px] text-on-surface-variant mt-3 pt-3 border-t border-white/5">
              {t('httpRequest.bodyDisabledForGet')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
