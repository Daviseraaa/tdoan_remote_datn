import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { DOC_NAV } from '@/src/docs/content';
import { t } from '@/src/i18n/t';

type Props = {
  variant?: 'inline' | 'drawer';
  onNavigate?: () => void;
  onClose?: () => void;
};

export function DocsSidebar({ variant = 'inline', onNavigate, onClose }: Props) {
  const { pathname } = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOC_NAV.map((s) => [s.id, true])),
  );

  const toggle = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const nav = (
    <nav className="space-y-4 text-[15px]">
      {DOC_NAV.map((section) => {
        const SectionIcon = section.icon;
        const isOpen = openSections[section.id] ?? true;
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="flex items-center gap-2 w-full text-left font-semibold text-gray-900 mb-1.5"
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              )}
              <SectionIcon className="w-4 h-4 text-gray-500 shrink-0" />
              <span>{t(section.labelKey)}</span>
            </button>
            {isOpen && (
              <ul className="space-y-0.5 ml-1">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const href = `/docs/${item.slug}`;
                  const active = pathname === href;
                  return (
                    <li key={item.slug}>
                      <Link
                        to={href}
                        onClick={onNavigate}
                        className={[
                          'flex items-center gap-2 rounded-md px-2.5 py-2 sm:py-1.5 transition-colors',
                          active
                            ? 'bg-docs-accent/10 text-docs-accent font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80',
                        ].join(' ')}
                      >
                        <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  if (variant === 'drawer') {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{t('docs.menuTitle')}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label={t('docs.closeMenu')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{nav}</div>
      </>
    );
  }

  return <nav className="w-full shrink-0">{nav}</nav>;
}
