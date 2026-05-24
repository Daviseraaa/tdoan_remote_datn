import React from 'react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, limit, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const to = Math.min(safePage * limit, total);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 flex-wrap',
        className,
      )}
    >
      <div className="text-xs font-medium text-on-surface-variant opacity-60">
        {total === 0
          ? t('pagination.noItems')
          : t('pagination.range', { from, to, total })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          {t('pagination.previous')}
        </button>
        <span className="px-0 py-2 text-[10px] font-mono font-bold text-on-surface-variant self-center">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          {t('pagination.next')}
        </button>
      </div>
    </div>
  );
}
