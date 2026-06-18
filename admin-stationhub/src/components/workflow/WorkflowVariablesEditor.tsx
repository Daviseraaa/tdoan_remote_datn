import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Braces, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { WfCopyRefButton } from './WfCopyRefButton';

type VarRow = { id: string; key: string; value: string };

const fieldCls =
  'w-full min-w-0 px-2.5 py-2 rounded-lg bg-black/25 border border-white/10 text-sm font-mono focus:outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20 transition-colors';

function toRows(variables?: Record<string, unknown>): VarRow[] {
  const entries = Object.entries(variables ?? {});
  if (entries.length === 0) {
    return [{ id: 'row-0', key: '', value: '' }];
  }
  return entries.map(([key, value], index) => ({
    id: `row-${index}-${key}`,
    key,
    value: formatVariableValue(value),
  }));
}

function formatVariableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function rowsToRecord(rows: VarRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.value;
  }
  return out;
}

type Props = {
  variables?: Record<string, unknown>;
  onChange: (variables: Record<string, unknown>) => void;
  className?: string;
};

export function WorkflowVariablesEditor({ variables, onChange, className }: Props) {
  const listId = useId();
  const [rows, setRows] = useState<VarRow[]>(() => toRows(variables));

  const externalKeySig = useMemo(
    () => JSON.stringify(Object.keys(variables ?? {}).sort()),
    [variables],
  );

  useEffect(() => {
    setRows((prev) => {
      const rowKeys = prev.map((r) => r.key.trim()).filter(Boolean).sort();
      const extKeys = Object.keys(variables ?? {}).sort();
      if (JSON.stringify(rowKeys) === JSON.stringify(extKeys)) return prev;
      const extOnly = extKeys.some((k) => !rowKeys.includes(k));
      if (extOnly) return toRows(variables);
      return prev;
    });
  }, [externalKeySig, variables]);

  const commit = useCallback(
    (next: VarRow[]) => {
      setRows(next);
      onChange(rowsToRecord(next));
    },
    [onChange],
  );

  const updateRow = (id: string, patch: Partial<Pick<VarRow, 'key' | 'value'>>) => {
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    commit([...rows, { id: `${listId}-${Date.now()}`, key: '', value: '' }]);
  };

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    commit(next.length > 0 ? next : [{ id: `${listId}-empty`, key: '', value: '' }]);
  };

  const filledCount = rows.filter((r) => r.key.trim()).length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] gap-2 px-1">
        <span className="text-[9px] font-mono font-bold uppercase text-sky-300/70">
          {t('workflows.workflowVarName')}
        </span>
        <span className="text-[9px] font-mono font-bold uppercase text-sky-300/70">
          {t('workflows.workflowVarValue')}
        </span>
        <span className="w-8" />
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => {
          const keyTrim = row.key.trim();
          const ref = keyTrim ? `{{workflow.${keyTrim}}}` : '';

          return (
            <div
              key={row.id}
              className="rounded-xl border border-sky-400/15 bg-sky-950/30 p-2 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] gap-2 items-start">
                <div className="min-w-0">
                  <label className="sm:sr-only text-[9px] font-mono uppercase text-sky-300/60 mb-1 block">
                    {t('workflows.workflowVarName')}
                  </label>
                  <div className="relative">
                    <Braces
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sky-400/50 pointer-events-none"
                    />
                    <input
                      value={row.key}
                      onChange={(e) => updateRow(row.id, { key: e.target.value })}
                      placeholder={t('workflows.workflowVarNamePlaceholder')}
                      className={cn(fieldCls, 'pl-8')}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="sm:sr-only text-[9px] font-mono uppercase text-sky-300/60 mb-1 block">
                    {t('workflows.workflowVarValue')}
                  </label>
                  <input
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    placeholder={t('workflows.workflowVarValuePlaceholder')}
                    className={fieldCls}
                    autoComplete="off"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="shrink-0 self-end sm:self-center p-2 rounded-lg text-on-surface-variant/70 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30"
                  title={t('workflows.removeVariable')}
                  aria-label={t('workflows.removeVariable')}
                  disabled={rows.length === 1 && !row.key && !row.value}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {ref ? (
                <WfCopyRefButton refText={ref} tone="sky" className="w-full sm:w-auto" />
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-sky-400/35 text-sky-200/90 text-xs font-bold hover:bg-sky-400/10 hover:border-sky-400/50 transition-colors"
      >
        <Plus size={15} />
        {t('workflows.addVariable')}
      </button>

      {filledCount > 0 ? (
        <p className="text-[9px] font-mono text-sky-300/50 text-center">
          {t('workflows.workflowVarCountHint', { count: filledCount })}
        </p>
      ) : null}
    </div>
  );
}
