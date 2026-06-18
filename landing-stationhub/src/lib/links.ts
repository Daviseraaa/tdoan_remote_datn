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
