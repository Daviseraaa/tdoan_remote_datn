import { useEffect, useState } from 'react';
import { fetchYoutubeMetadata } from '@/src/lib/youtube';

export type VideoMetadata = {
  title: string;
  thumbnail: string | null;
};

export function useYoutubeVideoMetadata(
  items: { id: string; source: string }[],
): { meta: Record<string, VideoMetadata>; loading: boolean } {
  const [meta, setMeta] = useState<Record<string, VideoMetadata>>({});
  const [loading, setLoading] = useState(true);

  const key = items.map((i) => `${i.id}:${i.source}`).join('|');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const withSource = items.filter((i) => i.source.trim());
      if (withSource.length === 0) {
        if (!cancelled) {
          setMeta({});
          setLoading(false);
        }
        return;
      }

      const results = await Promise.all(
        withSource.map(async (item) => {
          const data = await fetchYoutubeMetadata(item.source);
          return { id: item.id, data };
        }),
      );

      if (cancelled) return;

      const next: Record<string, VideoMetadata> = {};
      for (const { id, data } of results) {
        if (data) next[id] = data;
      }
      setMeta(next);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed by id+source

  return { meta, loading };
}
