const base = (import.meta.env.VITE_CONSOLE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

export function consoleUrl(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
