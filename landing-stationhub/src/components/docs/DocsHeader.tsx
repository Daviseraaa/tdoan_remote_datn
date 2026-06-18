import { ExternalLink, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/src/components/Logo';
import { DocsSearch } from './DocsSearch';
import { consoleUrl } from '@/src/lib/consoleUrl';
import { t } from '@/src/i18n/t';

type Props = {
  onOpenNav: () => void;
};

export function DocsHeader({ onOpenNav }: Props) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 h-16 min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenNav}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 shrink-0"
            aria-label={t('docs.openMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/docs" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Logo className="w-7 h-7 sm:w-8 sm:h-8 text-docs-accent shrink-0" />
            <span className="text-lg sm:text-xl font-semibold text-docs-accent tracking-tight truncate">
              <span className="sm:hidden">Docs</span>
              <span className="hidden sm:inline">StationHub Docs</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <DocsSearch />
          <a
            href={consoleUrl('/login')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-docs-accent text-white text-sm font-medium h-10 px-3 sm:px-4 hover:bg-docs-accent-hover transition-colors"
            aria-label={t('docs.goToApp')}
          >
            <span className="hidden sm:inline">{t('docs.goToApp')}</span>
            <ExternalLink className="w-3.5 h-3.5 sm:ml-0" />
          </a>
        </div>
      </div>
    </header>
  );
}
