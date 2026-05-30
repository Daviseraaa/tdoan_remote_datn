import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const LG_BREAKPOINT = 1024;

type NavLayoutContextValue = {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
  closeNav: () => void;
};

const NavLayoutContext = createContext<NavLayoutContextValue | null>(null);

export function NavLayoutProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);

  useEffect(() => {
    closeNav();
  }, [location.pathname, closeNav]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= LG_BREAKPOINT) closeNav();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [closeNav]);

  useEffect(() => {
    const isMobile = window.innerWidth < LG_BREAKPOINT;
    if (navOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
    return undefined;
  }, [navOpen]);

  const value = useMemo(
    () => ({ navOpen, setNavOpen, toggleNav, closeNav }),
    [navOpen, toggleNav, closeNav],
  );

  return <NavLayoutContext.Provider value={value}>{children}</NavLayoutContext.Provider>;
}

export function useNavLayoutContext() {
  const ctx = useContext(NavLayoutContext);
  if (!ctx) throw new Error('useNavLayoutContext must be used within NavLayoutProvider');
  return ctx;
}
