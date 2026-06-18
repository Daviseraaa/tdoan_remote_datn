import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { copyToClipboard } from '@/src/lib/copyToClipboard';
import { t } from '@/src/i18n/t';

type Props = {
  refText: string;
  label?: string;
  tone?: 'sky' | 'primary' | 'emerald' | 'neutral';
  className?: string;
  mono?: boolean;
};

const toneCls: Record<NonNullable<Props['tone']>, { btn: string; copied: string }> = {
  sky: {
    btn: 'border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20',
    copied: 'border-sky-300/50 bg-sky-400/20 text-sky-100',
  },
  primary: {
    btn: 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
    copied: 'border-primary/50 bg-primary/20 text-primary',
  },
  emerald: {
    btn: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20',
    copied: 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100',
  },
  neutral: {
    btn: 'border-white/15 bg-white/5 text-on-surface-variant hover:bg-white/10',
    copied: 'border-white/25 bg-white/10 text-on-surface',
  },
};

export function WfCopyRefButton({
  refText,
  label,
  tone = 'neutral',
  className,
  mono = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const styles = toneCls[tone];

  const onCopy = async () => {
    const ok = await copyToClipboard(refText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title={t('workflows.varCopyHint')}
      className={cn(
        'group inline-flex items-center gap-1.5 max-w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
        copied ? styles.copied : styles.btn,
        className,
      )}
    >
      {copied ? <Check size={12} className="shrink-0" /> : <Copy size={12} className="shrink-0 opacity-70" />}
      <span
        className={cn(
          'truncate text-[10px]',
          mono ? 'font-mono' : 'font-medium',
        )}
      >
        {label ?? refText}
      </span>
    </button>
  );
}
