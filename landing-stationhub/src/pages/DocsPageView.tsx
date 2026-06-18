import { Navigate, useParams } from 'react-router-dom';
import { DOC_BY_SLUG, DEFAULT_DOC_SLUG } from '@/src/docs/content';
import { DocsContent, useActiveHeading } from '@/src/components/docs/DocsContent';
import { DocsMobileTOC, DocsTOC } from '@/src/components/docs/DocsTOC';

export function DocsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? DOC_BY_SLUG[slug] : undefined;

  if (!page) {
    return <Navigate to={`/docs/${DEFAULT_DOC_SLUG}`} replace />;
  }

  return <DocsPageInner page={page} />;
}

function DocsPageInner({
  page,
}: {
  page: (typeof DOC_BY_SLUG)[string];
}) {
  const activeId = useActiveHeading(page.blocks);
  const Icon = page.icon;

  return (
    <div className="docs-page">
      <article className="docs-article min-w-0 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <header className="mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-gray-200">
          <div className="flex items-start gap-2.5 sm:gap-3 text-docs-accent mb-2 sm:mb-3">
            <Icon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 mt-0.5" />
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-tight min-w-0">
              {page.title}
            </h1>
          </div>
          <p className="text-gray-500 text-base sm:text-lg leading-relaxed w-full">
            {page.description}
          </p>
        </header>

        <DocsMobileTOC blocks={page.blocks} activeId={activeId} />
        <DocsContent blocks={page.blocks} />
      </article>
      <DocsTOC blocks={page.blocks} activeId={activeId} />
    </div>
  );
}
