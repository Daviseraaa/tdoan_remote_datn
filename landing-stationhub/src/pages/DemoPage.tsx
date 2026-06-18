import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { LandingLayout } from '@/src/components/LandingLayout';
import { DEMO_VIDEOS, getInitialVideoId, type DemoVideo } from '@/src/demo/videos';
import { useYoutubeVideoMetadata } from '@/src/hooks/useYoutubeVideoMetadata';
import { toYoutubeEmbedUrl, toYoutubeThumbnail } from '@/src/lib/youtube';
import { t } from '@/src/i18n/t';

const HERO_BG =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260611_133301_d5f2a94a-b22e-4e4a-a6b6-eacdddf1f5b0.png&w=1280&q=85';

function resolveTitle(
  videoId: string,
  source: string,
  meta: ReturnType<typeof useYoutubeVideoMetadata>['meta'],
  loading: boolean,
): string {
  if (meta[videoId]?.title) return meta[videoId].title;
  if (!source.trim()) return t('landing.demoNoVideo');
  if (loading) return t('landing.demoLoadingTitle');
  return t('landing.demoUntitled');
}

function VideoPlayer({ embedUrl, title }: { embedUrl: string | null; title: string }) {
  return (
    <div className="relative w-full h-full min-h-0 bg-[#0a0a0b]">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${HERO_BG})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#111] via-[#111]/95 to-black/90" aria-hidden />
          <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center ring-1 ring-white/20">
            <Play className="w-8 h-8 sm:w-9 sm:h-9 text-white fill-white ml-1" />
          </div>
          <p className="relative z-10 text-white/70 text-sm sm:text-base max-w-md leading-relaxed">
            {t('landing.demoPlaceholder')}
          </p>
        </div>
      )}
    </div>
  );
}

function VideoListItem({
  video,
  active,
  title,
  thumbnail,
  onSelect,
}: {
  video: DemoVideo;
  active: boolean;
  title: string;
  thumbnail: string | null;
  onSelect: () => void;
}) {
  const thumb = thumbnail ?? toYoutubeThumbnail(video.source);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left flex gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl transition-colors',
        active ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-900',
      ].join(' ')}
    >
      <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-gray-200">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Play className="w-5 h-5 text-white/60 fill-white/60" />
          </div>
        )}
        {active ? (
          <div className="absolute inset-0 ring-2 ring-white/40 rounded-lg pointer-events-none" />
        ) : null}
      </div>
      <span
        className={[
          'text-[14px] sm:text-[15px] leading-snug line-clamp-3 pt-0.5',
          active ? 'text-white' : 'text-gray-700',
          title === t('landing.demoLoadingTitle') ? 'animate-pulse text-gray-400' : '',
        ].join(' ')}
      >
        {title}
      </span>
    </button>
  );
}

export function DemoPage() {
  const [activeId, setActiveId] = useState(getInitialVideoId);
  const videos = useMemo(() => DEMO_VIDEOS, []);
  const { meta, loading } = useYoutubeVideoMetadata(videos);

  const activeVideo = videos.find((v) => v.id === activeId) ?? videos[0];
  const activeSource = activeVideo?.source ?? '';
  const activeEmbed = useMemo(() => toYoutubeEmbedUrl(activeSource), [activeSource]);
  const activeTitle = activeVideo
    ? resolveTitle(activeVideo.id, activeSource, meta, loading)
    : t('landing.demoNoVideo');

  return (
    <LandingLayout noScroll>
      <section className="h-full flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-[1_1_0%] min-h-0 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 w-full">
            <VideoPlayer embedUrl={activeEmbed} title={activeTitle} />
          </div>
        </div>

        <aside className="flex-[0_0_38%] sm:flex-[0_0_36%] lg:flex-[0_0_22rem] xl:flex-[0_0_24rem] min-h-0 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200/80 bg-white flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 py-2.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{t('landing.demoListTitle')}</h2>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3 space-y-1">
            {videos.length === 0 ? (
              <li className="px-3 py-6 text-sm text-gray-500 text-center">{t('landing.demoNoVideo')}</li>
            ) : (
              videos.map((video) => (
                <li key={video.id}>
                  <VideoListItem
                    video={video}
                    active={video.id === activeVideo?.id}
                    title={resolveTitle(video.id, video.source, meta, loading)}
                    thumbnail={meta[video.id]?.thumbnail ?? null}
                    onSelect={() => setActiveId(video.id)}
                  />
                </li>
              ))
            )}
          </ul>
        </aside>
      </section>
    </LandingLayout>
  );
}
