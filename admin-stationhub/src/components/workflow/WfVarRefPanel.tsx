import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatStepVar } from '@/src/lib/workflowGraph';
import type { UpstreamOutputKey } from '@/src/lib/workflowGraph';

type Props = {
  upstream: UpstreamOutputKey[];
  workflowVarKeys?: string[];
  className?: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function VarChip({
  label,
  sublabel,
  refs,
}: {
  label: string;
  sublabel?: string;
  refs: { primary: string; secondary?: string };
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const pick = async (text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(text);
      window.setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] font-bold text-on-surface truncate" title={label}>
          {label}
        </span>
        {sublabel ? (
          <span className="text-[9px] font-mono text-primary shrink-0">{sublabel}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => void pick(refs.primary)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono',
            'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors',
          )}
          title={t('workflows.varCopyHint')}
        >
          {copied === refs.primary ? <Check size={10} /> : <Copy size={10} />}
          stdout
        </button>
        {refs.secondary ? (
          <button
            type="button"
            onClick={() => void pick(refs.secondary!)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono',
              'border border-white/15 bg-white/5 text-on-surface-variant hover:bg-white/10 transition-colors',
            )}
            title={t('workflows.varCopyHint')}
          >
            {copied === refs.secondary ? <Check size={10} /> : <Copy size={10} />}
            exitCode
          </button>
        ) : null}
      </div>
      <p className="text-[9px] font-mono text-on-surface-variant/80 truncate" title={refs.primary}>
        {refs.primary}
      </p>
    </div>
  );
}

export function WfVarRefPanel({ upstream, workflowVarKeys = [], className }: Props) {
  if (upstream.length === 0 && workflowVarKeys.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2', className)}>
      <p className="text-[10px] font-mono font-bold uppercase text-primary">
        {t('workflows.varsAvailable')}
      </p>
      <p className="text-[10px] text-on-surface-variant">{t('workflows.varsHint')}</p>

      {workflowVarKeys.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {workflowVarKeys.map((k) => {
            const ref = `{{workflow.${k}}}`;
            return (
              <button
                key={k}
                type="button"
                onClick={() => void copyText(ref)}
                className="px-2 py-1 rounded-lg text-[9px] font-mono border border-white/15 bg-white/5 hover:bg-white/10"
              >
                workflow.{k}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-2">
        {upstream.map((u) => (
          <VarChip
            key={u.nodeId}
            label={u.label}
            sublabel={u.key}
            refs={{
              primary: formatStepVar(u.key, 'stdout'),
              secondary: formatStepVar(u.key, 'exitCode'),
            }}
          />
        ))}
      </div>

      {upstream.length === 1 ? (
        <p className="text-[9px] font-mono text-on-surface-variant">{t('workflows.varPath_prev_stdout')}</p>
      ) : null}
    </div>
  );
}
