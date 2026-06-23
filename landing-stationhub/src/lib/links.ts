function env(key: keyof ImportMetaEnv): string {
  const v = import.meta.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

export { toYoutubeEmbedUrl, toYoutubeThumbnail } from '@/src/lib/youtube';

export function telegramGroupUrl(): string | null {
  const url = env('VITE_TELEGRAM_GROUP_URL');
  return url || null;
}

export function zaloGroupUrl(): string | null {
  const url = env('VITE_ZALO_GROUP_URL');
  return url || null;
}

const DEFAULT_GITHUB_URL = 'https://github.com/Daviseraaa/StationHub';

export function githubUrl(): string {
  const url = env('VITE_GITHUB_URL');
  return url || DEFAULT_GITHUB_URL;
}
