import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

type Props = {
  children: ReactNode;
  /** Navbar nền trong suốt (trang chủ) hoặc nền trắng (trang con) */
  navVariant?: 'transparent' | 'solid';
  /** Khóa chiều cao viewport, không scroll trang */
  noScroll?: boolean;
};

export function LandingLayout({ children, navVariant = 'solid', noScroll = false }: Props) {
  return (
    <div
      className={[
        'flex flex-col font-nimbus text-gray-900 bg-[#fafaf9]',
        noScroll ? 'h-dvh overflow-hidden' : 'min-h-dvh',
      ].join(' ')}
    >
      <Navbar variant={navVariant} />
      <main className={noScroll ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1'}>{children}</main>
    </div>
  );
}
