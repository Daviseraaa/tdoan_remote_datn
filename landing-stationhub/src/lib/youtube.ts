export function extractYoutubeId(raw: string): string | null {
  if (!raw) return null;

  const fromUrl = raw.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  )?.[1];

  if (fromUrl) return fromUrl;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  return null;
}

export function toYoutubeWatchUrl(raw: string): string | null {
  const id = extractYoutubeId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function toYoutubeEmbedUrl(raw: string): string | null {
  const id = extractYoutubeId(raw);
  if (id) return `https://www.youtube.com/embed/${id}`;
  if (raw.includes('youtube.com/embed/')) return raw;
  return raw || null;
}

export function toYoutubeThumbnail(raw: string): string | null {
  const id = extractYoutubeId(raw);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

type OembedResponse = {
  title?: string;
  thumbnail_url?: string;
};

export async function fetchYoutubeMetadata(
  raw: string,
): Promise<{ title: string; thumbnail: string | null } | null> {
  const watchUrl = toYoutubeWatchUrl(raw);
  if (!watchUrl) return null;

  const res = await fetch(
    `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as OembedResponse;
  if (!data.title) return null;

  return {
    title: data.title,
    thumbnail: data.thumbnail_url ?? toYoutubeThumbnail(raw),
  };
}
