import type { PaginatedMeta, PaginatedResponse } from '@/src/types/api';

/** Normalize backend paginated shapes into { items, meta }. */
export function normalizePaginated<T>(raw: unknown): PaginatedResponse<T> {
  if (!raw || typeof raw !== 'object') {
    return { items: [], meta: { total: 0, page: 1, limit: 10 } };
  }
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.items) && r.meta && typeof r.meta === 'object') {
    return raw as PaginatedResponse<T>;
  }

  const data = r.data;
  const items = (Array.isArray(r.items)
    ? r.items
    : Array.isArray(data)
      ? data
      : []) as T[];

  const meta = (r.meta ?? r.pagination ?? {}) as PaginatedMeta;
  return {
    items,
    meta: {
      total: Number(meta.total ?? items.length),
      page: Number(meta.page ?? 1),
      limit: Number(meta.limit ?? (items.length || 10)),
      totalPages: meta.totalPages,
    },
  };
}
