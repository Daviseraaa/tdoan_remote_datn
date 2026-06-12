import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function preconnectApiPlugin(apiBaseUrl: string) {
  return {
    name: 'inject-api-preconnect',
    transformIndexHtml(html: string) {
      try {
        const origin = new URL(apiBaseUrl).origin;
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return html;
        }
        const tags = [
          `<link rel="preconnect" href="${origin}" crossorigin />`,
          `<link rel="dns-prefetch" href="${origin}" />`,
        ].join('\n    ');
        return html.replace('</head>', `    ${tags}\n  </head>`);
      } catch {
        return html;
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? '';

  return {
  plugins: [react(), tailwindcss(), preconnectApiPlugin(apiBase)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5173,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
};
});
