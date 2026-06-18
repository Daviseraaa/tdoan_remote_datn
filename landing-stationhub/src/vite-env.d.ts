/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSOLE_URL?: string;
  readonly VITE_TELEGRAM_GROUP_URL?: string;
  readonly VITE_ZALO_GROUP_URL?: string;
  /** Danh sách link YouTube, phân tách bằng dấu phẩy hoặc xuống dòng */
  readonly VITE_DEMO_VIDEO_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
