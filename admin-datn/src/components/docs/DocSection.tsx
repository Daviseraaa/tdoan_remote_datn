import React from 'react';
import { cn } from '@/src/lib/utils';

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  className?: string;
};

export function DocSection({ id, title, subtitle, icon: Icon, children, className }: Props) {
  return (
    <section id={id} className={cn('scroll-mt-24', className)}>
      <div className="flex items-start gap-3 mb-4">
        {Icon ? (
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Icon size={20} className="text-primary" />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="prose-description text-sm text-on-surface-variant mt-1">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-surface-container-low/30 p-5 md:p-6 space-y-4">
        {children}
      </div>
    </section>
  );
}

export function DocCodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-xl bg-[#0b0f14] border border-white/10 px-4 py-3 font-mono text-xs text-[#d4d4d4] overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export function DocSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-on-surface-variant list-decimal list-inside">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
