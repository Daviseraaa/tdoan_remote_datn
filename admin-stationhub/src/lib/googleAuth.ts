const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gsiLoadPromise: Promise<void> | null = null;

/** Safari / iOS WebKit — popup GIS thường bị chặn, dùng redirect. */
export function prefersGoogleRedirect(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox/i.test(ua);
}

export function getGoogleRedirectUri(): string {
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
  return `${apiBase.replace(/\/$/, '')}/auth/google/redirect`;
}

export function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('GSI script failed')),
        { once: true },
      );
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed'));
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}
