const GSI_SRC = 'https://accounts.google.com/gsi/client';

let loadPromise: Promise<void> | null = null;

/** Chỉ tải script GIS khi Login/Register — tránh COOP/postMessage trên Dashboard. */
export function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GSI chỉ chạy trên browser'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('Google GSI không khởi tạo'));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google GSI load failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => done();
    script.onerror = () => reject(new Error('Google GSI load failed'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
