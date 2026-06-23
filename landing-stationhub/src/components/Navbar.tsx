import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Github, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { TelegramIcon, ZaloIcon } from './CommunityIcons';
import { consoleUrl } from '@/src/lib/consoleUrl';
import { githubUrl, telegramGroupUrl, zaloGroupUrl } from '@/src/lib/links';
import { t } from '@/src/i18n/t';

type Props = {
  variant?: 'transparent' | 'solid';
};

const NAV_LINK =
  'text-[15px] lg:text-base text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap';

const COMMUNITY_LINK =
  'inline-flex items-center gap-2 text-[15px] lg:text-base text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap shrink-0';

export function Navbar({ variant = 'solid' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const telegram = telegramGroupUrl();
  const zalo = zaloGroupUrl();
  const github = githubUrl();

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const headerClass =
    variant === 'transparent'
      ? 'absolute inset-x-0 top-0 z-30'
      : 'sticky top-0 z-30 border-b border-gray-200/70 bg-white/90 backdrop-blur-md';

  const navLinks: { to: string; label: string; newTab?: boolean }[] = [
    { to: '/docs', label: t('landing.navDocs'), newTab: true },
    { to: '/demo', label: t('landing.navDemo') },
  ];

  const renderNavLink = (
    { to, label, newTab }: { to: string; label: string; newTab?: boolean },
    className: string,
    onClick?: () => void,
  ) =>
    newTab ? (
      <a
        key={to}
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {label}
      </a>
    ) : (
      <Link key={to} to={to} className={className} onClick={onClick}>
        {label}
      </Link>
    );

  return (
    <header className={`${headerClass} relative w-full`}>
      <div className="w-full px-5 sm:px-6 lg:px-8 py-4">
        {/* Mobile & tablet */}
        <div className="flex lg:hidden items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-gray-900 shrink-0 min-w-0">
            <Logo className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-base sm:text-lg font-semibold tracking-tight truncate">
              StationHub
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={consoleUrl('/register')}
              className="hidden sm:inline-flex whitespace-nowrap bg-gray-900 text-white text-[15px] font-medium px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors"
            >
              {t('landing.ctaStart')}
            </a>
            <button
              type="button"
              className="w-9 h-9 rounded-full text-gray-900 hover:bg-gray-900/10 flex items-center justify-center shrink-0"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? t('nav.closeSidebar') : 'Menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop — 3 cột bằng nhau để nav căn đúng giữa viewport */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:items-center">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-gray-900 justify-self-start shrink-0"
          >
            <Logo className="w-6 h-6 shrink-0" />
            <span className="text-lg font-semibold tracking-tight whitespace-nowrap">
              StationHub
            </span>
          </Link>

          <nav className="flex items-center justify-center gap-8 w-full shrink-0">
            {navLinks.map((link) =>
              renderNavLink(
                link,
                `${NAV_LINK} ${!link.newTab && isActive(link.to) ? 'text-gray-900 font-medium' : ''}`,
              ),
            )}
          </nav>

          <div className="flex items-center justify-end gap-4 w-full shrink-0 justify-self-end">
            {telegram ? (
              <a
                href={telegram}
                target="_blank"
                rel="noopener noreferrer"
                className={COMMUNITY_LINK}
              >
                <TelegramIcon className="w-4 h-4 text-sky-500 shrink-0" />
                {t('landing.navTelegram')}
              </a>
            ) : null}
            {zalo ? (
              <a
                href={zalo}
                target="_blank"
                rel="noopener noreferrer"
                className={COMMUNITY_LINK}
              >
                <ZaloIcon className="w-4 h-4 text-blue-600 shrink-0" />
                {t('landing.navZalo')}
              </a>
            ) : null}
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className={COMMUNITY_LINK}
            >
              <Github className="w-4 h-4 shrink-0" />
              {t('landing.navGitHub')}
            </a>
            <a
              href={consoleUrl('/register')}
              className="inline-flex whitespace-nowrap bg-gray-900 text-white text-[15px] lg:text-base font-medium px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors shrink-0"
            >
              {t('landing.ctaStart')}
            </a>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden absolute left-4 right-4 top-full rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 px-5 py-3 mt-1 z-40">
          {navLinks.map((link) =>
            renderNavLink(
              link,
              'block py-2.5 text-base text-gray-700 hover:text-gray-900 border-b border-gray-100',
              () => setMobileOpen(false),
            ),
          )}
          {telegram ? (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2.5 text-base text-gray-700 hover:text-gray-900 border-b border-gray-100"
              onClick={() => setMobileOpen(false)}
            >
              <TelegramIcon className="w-4 h-4 text-sky-500" />
              {t('landing.navTelegram')}
            </a>
          ) : null}
          {zalo ? (
            <a
              href={zalo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2.5 text-base text-gray-700 hover:text-gray-900 border-b border-gray-100"
              onClick={() => setMobileOpen(false)}
            >
              <ZaloIcon className="w-4 h-4 text-blue-600" />
              {t('landing.navZalo')}
            </a>
          ) : null}
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-2.5 text-base text-gray-700 hover:text-gray-900 border-b border-gray-100"
            onClick={() => setMobileOpen(false)}
          >
            <Github className="w-4 h-4" />
            {t('landing.navGitHub')}
          </a>
          <a
            href={consoleUrl('/register')}
            className="block py-2.5 text-base font-medium text-gray-900 sm:hidden"
            onClick={() => setMobileOpen(false)}
          >
            {t('landing.ctaStart')}
          </a>
        </div>
      ) : null}
    </header>
  );
}
