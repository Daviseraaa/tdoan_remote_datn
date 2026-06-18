import { useRef } from 'react';
import { List } from 'lucide-react';
import type { DocBlock } from '@/src/docs/types';
import { extractHeadings } from '@/src/docs/headings';
import { t } from '@/src/i18n/t';

type Props = {
  blocks: DocBlock[];
  activeId: string | null;
};

function TocList({
  headings,
  activeId,
  onLinkClick,
}: {
  headings: ReturnType<typeof extractHeadings>;
  activeId: string | null;
  onLinkClick?: () => void;
}) {
  return (
    <ul className="space-y-2.5 text-[15px] border-l border-gray-200">
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            onClick={onLinkClick}
            className={[
              'block border-l-2 -ml-px pl-3 py-0.5 transition-colors',
              h.level === 3 ? 'ml-3' : '',
              activeId === h.id
                ? 'border-docs-accent text-docs-accent font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DocsTOC({ blocks, activeId }: Props) {
  const headings = extractHeadings(blocks);
  if (headings.length === 0) return null;

  return (
    <aside className="docs-toc-col" aria-label={t('docs.onThisPage')}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        <List className="w-3.5 h-3.5" />
        {t('docs.onThisPage')}
      </p>
      <TocList headings={headings} activeId={activeId} />
    </aside>
  );
}

export function DocsMobileTOC({ blocks, activeId }: Props) {
  const headings = extractHeadings(blocks);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  if (headings.length === 0) return null;

  return (
    <details ref={detailsRef} className="xl:hidden mb-6 rounded-xl border border-gray-200 bg-white/80 group">
      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none text-[15px] font-medium text-gray-700 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <List className="w-4 h-4 text-gray-400" />
          {t('docs.onThisPage')}
        </span>
        <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
        <TocList
          headings={headings}
          activeId={activeId}
          onLinkClick={() => {
            if (detailsRef.current) detailsRef.current.open = false;
          }}
        />
      </div>
    </details>
  );
}
