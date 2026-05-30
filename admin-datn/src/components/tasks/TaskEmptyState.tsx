import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function TaskEmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 border-dashed py-16 px-8 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-4">
        <Icon size={28} className="opacity-70" />
      </div>
      <p className="text-base font-bold text-on-surface">{title}</p>
      {description ? (
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
