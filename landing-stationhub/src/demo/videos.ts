import { extractYoutubeId } from '@/src/lib/youtube';

export type DemoVideo = {
  /** ID YouTube (11 ký tự) */
  id: string;
  source: string;
};

export function parseVideoUrlsFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getDemoVideoUrlsFromEnv(): string[] {
  return parseVideoUrlsFromEnv(import.meta.env.VITE_DEMO_VIDEO_URLS);
}

export function buildDemoVideos(urls: string[]): DemoVideo[] {
  const seen = new Set<string>();

  return urls
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((source) => {
      const id = extractYoutubeId(source);
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return { id, source };
    })
    .filter((v): v is DemoVideo => v != null);
}

export const DEMO_VIDEOS = buildDemoVideos(getDemoVideoUrlsFromEnv());

export function getInitialVideoId(): string {
  return DEMO_VIDEOS[0]?.id ?? '';
}
