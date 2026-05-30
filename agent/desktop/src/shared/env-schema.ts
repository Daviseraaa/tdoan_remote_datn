export type EnvFieldType = 'string' | 'number' | 'boolean' | 'select';

export interface EnvFieldDef {
  key: string;
  label: string;
  type: EnvFieldType;
  group: string;
  required?: boolean;
  default?: string;
  options?: readonly string[];
  hint?: string;
}

/** Khớp `agent/core/src/config/settings.rs` + `agent/.env.example`. */
export const ENV_FIELDS: readonly EnvFieldDef[] = [
  {
    key: 'SERVER_WS_URL',
    label: 'Server WebSocket URL',
    type: 'string',
    group: 'Kết nối',
    required: true,
    default: 'ws://localhost:3000',
  },
  {
    key: 'AGENT_KEY',
    label: 'Agent key',
    type: 'string',
    group: 'Kết nối',
    required: true,
    hint: 'Lấy từ POST /api/agents trên server',
  },
  {
    key: 'AGENT_VERSION',
    label: 'Agent version (metadata)',
    type: 'string',
    group: 'Kết nối',
    default: '1.1.0',
  },
  {
    key: 'PUBLIC_IP_LOOKUP_URL',
    label: 'Public IP lookup URL',
    type: 'string',
    group: 'Kết nối',
    default: 'https://api.ipify.org',
    hint: 'Telemetry; để trống = mặc định ipify',
  },
  {
    key: 'COMMAND_TIMEOUT_MS',
    label: 'Command timeout (ms)',
    type: 'number',
    group: 'Task / Shell',
    default: '300000',
  },
  {
    key: 'MAX_OUTPUT_BYTES',
    label: 'Max output (bytes)',
    type: 'number',
    group: 'Task / Shell',
    default: '1000000',
  },
  {
    key: 'DEFAULT_SHELL',
    label: 'Default shell',
    type: 'select',
    group: 'Task / Shell',
    default: 'powershell',
    options: ['powershell', 'cmd'],
  },
  {
    key: 'TASK_MAX_CONCURRENCY',
    label: 'Max concurrent tasks',
    type: 'number',
    group: 'Task / Shell',
    default: '1',
    hint: '1–32',
  },
  {
    key: 'LOG_LEVEL',
    label: 'Log level (desktop)',
    type: 'select',
    group: 'Khác',
    default: 'info',
    options: ['trace', 'debug', 'info', 'warn', 'error'],
  },
  {
    key: 'DESKTOP_AUTOMATION_ENABLED',
    label: 'Bật desktop automation',
    type: 'boolean',
    group: 'Desktop automation',
    default: 'false',
    hint: 'Nguy hiểm — chỉ bật máy tin cậy, session user',
  },
  {
    key: 'SCREEN_CAPTURE_ENABLED',
    label: 'Bật chụp màn hình',
    type: 'boolean',
    group: 'Desktop automation',
    default: 'true',
    hint: 'Task SCREEN_CAPTURE — session desktop user',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_STEPS',
    label: 'Max steps',
    type: 'number',
    group: 'Desktop automation',
    default: '200',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_DELAY_MS',
    label: 'Max delay per step (ms)',
    type: 'number',
    group: 'Desktop automation',
    default: '60000',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_TYPE_CHARS',
    label: 'Max typeText chars',
    type: 'number',
    group: 'Desktop automation',
    default: '8000',
  },
  {
    key: 'OPEN_APP_WINDOW_WAIT_MS',
    label: 'OPEN_APP chờ cửa sổ (ms)',
    type: 'number',
    group: 'Mở ứng dụng',
    default: '15000',
    hint: 'Windows — 1000–60000',
  },
  {
    key: 'OPEN_BROWSER_HEADLESS',
    label: 'Cloak headless',
    type: 'boolean',
    group: 'Trình duyệt',
    default: 'false',
  },
  {
    key: 'OPEN_BROWSER_HUMANIZE',
    label: 'Cloak humanize',
    type: 'boolean',
    group: 'Trình duyệt',
    default: 'true',
  },
  {
    key: 'OPEN_BROWSER_KEEP_OPEN',
    label: 'Giữ trình duyệt mở sau task',
    type: 'boolean',
    group: 'Trình duyệt',
    default: 'true',
  },
  {
    key: 'OPEN_BROWSER_PROFILE_DIR',
    label: 'Thư mục profile Cloak',
    type: 'string',
    group: 'Trình duyệt',
    default: 'C:\\ProgramData\\DATN\\browser-profiles\\default',
  },
  {
    key: 'CLOAK_RUNNER_DIR',
    label: 'Thư mục datn-cloak-runner (tùy chọn)',
    type: 'string',
    group: 'Trình duyệt',
    hint: 'Mặc định: resources/cloak khi cài bản đóng gói',
  },
  {
    key: 'CHROME_EXTENSION_ENABLED',
    label: 'Bật Chrome extension bridge',
    type: 'boolean',
    group: 'Chrome extension',
    default: 'false',
  },
  {
    key: 'CHROME_EXTENSION_MAX_STEPS',
    label: 'Số bước tối đa (extension)',
    type: 'number',
    group: 'Chrome extension',
    default: '50',
  },
  {
    key: 'CHROME_EXTENSION_MAX_NODES',
    label: 'Số node DOM tối đa / snapshot',
    type: 'number',
    group: 'Chrome extension',
    default: '500',
  },
  {
    key: 'CHROME_EXTENSION_ALLOWED_URLS',
    label: 'URL cho phép (phẩy, rỗng = tất cả)',
    type: 'string',
    group: 'Chrome extension',
    default: '',
  },
] as const;

export const ENV_GROUPS = [
  'Kết nối',
  'Task / Shell',
  'Desktop automation',
  'Mở ứng dụng',
  'Trình duyệt',
  'Chrome extension',
  'Khác',
] as const;
