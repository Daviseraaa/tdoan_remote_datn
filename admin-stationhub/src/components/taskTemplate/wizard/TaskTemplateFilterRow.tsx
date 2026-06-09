import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/** Bộ lọc agent — mobile cuộn ngang. */
export function TaskTemplateFilterRow({ children }: Props) {
  return (
    <div className="-mx-1 overflow-x-auto custom-scrollbar overscroll-x-contain">
      <div className="flex gap-2 w-max min-w-full pb-0.5">{children}</div>
    </div>
  );
}
