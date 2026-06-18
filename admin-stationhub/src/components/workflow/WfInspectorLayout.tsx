import type { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

export type WfInspectorTone = 'vars' | 'properties' | 'config';

const blockTone: Record<WfInspectorTone, string> = {
  vars: 'border-sky-400/25 bg-sky-400/[0.07]',
  properties: 'border-amber-400/25 bg-amber-400/[0.06]',
  config: 'border-white/12 bg-white/[0.03]',
};

/** Khối nội dung — phân vùng bằng màu, không tiêu đề section. */
export function WfInspectorBlock({
  tone,
  children,
  className,
}: {
  tone: WfInspectorTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border p-3.5 sm:p-4 space-y-3',
        blockTone[tone],
        className,
      )}
    >
      {children}
    </section>
  );
}

export type WfSubsectionTone = 'workflow' | 'upstream' | 'export' | 'telegram' | 'default';

const subsectionTone: Record<WfSubsectionTone, { label: string; box: string }> = {
  workflow: {
    label: 'text-sky-300/90',
    box: 'rounded-lg border border-sky-400/15 bg-sky-950/20 p-2.5 space-y-2',
  },
  upstream: {
    label: 'text-primary/90',
    box: 'rounded-lg border border-primary/20 bg-primary/[0.06] p-2.5 space-y-2',
  },
  export: {
    label: 'text-emerald-300/90',
    box: 'rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-2.5 space-y-2',
  },
  telegram: {
    label: 'text-cyan-300/90',
    box: 'rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] p-2.5 space-y-2',
  },
  default: {
    label: 'text-on-surface-variant/80',
    box: 'space-y-2',
  },
};

export function WfInspectorSubsection({
  title,
  children,
  empty,
  tone = 'default',
}: {
  title: string;
  children?: ReactNode;
  empty?: boolean;
  tone?: WfSubsectionTone;
}) {
  const isEmpty = empty ?? (children == null || children === false);
  const styles = subsectionTone[tone];

  return (
    <div className={styles.box}>
      <p className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', styles.label)}>
        {title}
      </p>
      {isEmpty ? (
        <p className="text-[10px] text-on-surface-variant/40 italic">{t('workflows.varsEmpty')}</p>
      ) : (
        children
      )}
    </div>
  );
}
