import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllDocSearchItems } from '@/src/docs/content';
import { t } from '@/src/i18n/t';

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const items = useMemo(() => getAllDocSearchItems(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (slug: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/docs/${slug}`);
  };

  const modal =
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 sm:px-4"
        role="dialog"
        aria-modal="true"
        aria-label={t('docs.searchPlaceholder')}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label={t('common.cancel')}
          onClick={() => setOpen(false)}
        />
        <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 bg-white">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('docs.searchPlaceholder')}
              className="flex-1 text-sm outline-none bg-transparent text-gray-900"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label={t('common.cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto py-2 bg-white">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-sm text-gray-500 text-center">
                {t('docs.searchEmpty')}
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => go(item.slug)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 bg-white">
            <Link to="/docs/introduction" onClick={() => setOpen(false)} className="hover:text-docs-accent">
              {t('docs.browseAll')}
            </Link>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors min-w-[200px]"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">{t('docs.searchPlaceholder')}</span>
        <kbd className="hidden lg:inline text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600"
        aria-label={t('docs.searchPlaceholder')}
      >
        <Search className="w-4 h-4" />
      </button>
      {modal}
    </>
  );
}
