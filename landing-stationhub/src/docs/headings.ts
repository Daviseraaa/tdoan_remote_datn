import type { DocBlock } from '@/src/docs/types';

export function extractHeadings(blocks: DocBlock[]) {
  return blocks
    .filter((b): b is Extract<DocBlock, { type: 'h2' } | { type: 'h3' }> =>
      b.type === 'h2' || b.type === 'h3',
    )
    .map((b) => ({
      id: b.id,
      level: b.type === 'h2' ? 2 : 3,
      text: b.text,
    }));
}
