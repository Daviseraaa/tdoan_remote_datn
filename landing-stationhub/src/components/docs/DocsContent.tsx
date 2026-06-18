import { useEffect, useState } from 'react';
import type { DocBlock } from '@/src/docs/types';

type Props = {
  blocks: DocBlock[];
};

export function DocsContent({ blocks }: Props) {
  return (
    <div className="docs-prose w-full min-w-0">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={block.id} id={block.id} className="docs-h2 scroll-mt-20">
                {block.text}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={block.id} id={block.id} className="docs-h3 scroll-mt-20">
                {block.text}
              </h3>
            );
          case 'p':
            return <p key={i}>{block.text}</p>;
          case 'ul':
            return (
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function useActiveHeading(blocks: DocBlock[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = blocks
      .filter((b) => b.type === 'h2' || b.type === 'h3')
      .map((b) => b.id);

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [blocks]);

  return activeId;
}
