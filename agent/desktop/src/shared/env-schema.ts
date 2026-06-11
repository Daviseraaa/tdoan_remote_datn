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

export function userVisibleEnvFields(): EnvFieldDef[] {
  return [...ENV_FIELDS];
}

export function userVisibleEnvGroups(): string[] {
  const groups: string[] = [];
  for (const f of userVisibleEnvFields()) {
    if (!groups.includes(f.group)) groups.push(f.group);
  }
  return groups;
}

/** Khớp `agent/core/src/config/settings.rs` + `agent/.env.example`. */
export const ENV_FIELDS: readonly EnvFieldDef[] = [
  {
    key: 'AGENT_KEY',
    label: 'Agent Key',
    type: 'string',
    group: 'Kết nối',
    required: true,
    hint: 'Lấy từ StationHub Console → Agents → tạo hoặc copy key',
  },
  {
    key: 'COMMAND_TIMEOUT_MS',
    label: 'Thời gian chờ lệnh (ms)',
    type: 'number',
    group: 'Task / Shell',
    default: '300000',
    hint: 'Tối đa chờ một task shell hoàn thành',
  },
  {
    key: 'MAX_OUTPUT_BYTES',
    label: 'Giới hạn output (bytes)',
    type: 'number',
    group: 'Task / Shell',
    default: '1000000',
  },
  {
    key: 'DEFAULT_SHELL',
    label: 'Shell mặc định',
    type: 'select',
    group: 'Task / Shell',
    default: 'powershell',
    options: ['powershell', 'cmd'],
  },
  {
    key: 'TASK_MAX_CONCURRENCY',
    label: 'Số task chạy đồng thời',
    type: 'number',
    group: 'Task / Shell',
    default: '1',
    hint: 'Giá trị từ 1 đến 32',
  },
  {
    key: 'DESKTOP_AUTOMATION_ENABLED',
    label: 'Bật điều khiển desktop',
    type: 'boolean',
    group: 'Desktop automation',
    default: 'false',
    hint: 'Chuột/phím từ xa — chỉ bật trên máy tin cậy',
  },
  {
    key: 'SCREEN_CAPTURE_ENABLED',
    label: 'Bật chụp màn hình',
    type: 'boolean',
    group: 'Desktop automation',
    default: 'true',
    hint: 'Task SCREEN_CAPTURE — cần session desktop user',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_STEPS',
    label: 'Số bước tối đa',
    type: 'number',
    group: 'Desktop automation',
    default: '200',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_DELAY_MS',
    label: 'Delay tối đa mỗi bước (ms)',
    type: 'number',
    group: 'Desktop automation',
    default: '60000',
  },
  {
    key: 'DESKTOP_AUTOMATION_MAX_TYPE_CHARS',
    label: 'Số ký tự gõ tối đa',
    type: 'number',
    group: 'Desktop automation',
    default: '8000',
  },
  {
    key: 'OPEN_APP_WINDOW_WAIT_MS',
    label: 'Chờ cửa sổ sau OPEN_APP (ms)',
    type: 'number',
    group: 'Mở ứng dụng',
    default: '15000',
    hint: 'Windows — từ 1000 đến 60000',
  },
  {
    key: 'OPEN_BROWSER_HEADLESS',
    label: 'Chạy Cloak ẩn (headless)',
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
    default: 'C:\\ProgramData\\StationHub\\browser-profiles\\default',
  },
  {
    key: 'CLOAK_RUNNER_DIR',
    label: 'Thư mục stationhub-cloak-runner',
    type: 'string',
    group: 'Trình duyệt',
    hint: 'Tùy chọn — mặc định: resources/cloak khi cài bản đóng gói',
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
    label: 'Số bước tối đa',
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
    label: 'URL cho phép',
    type: 'string',
    group: 'Chrome extension',
    default: '',
    hint: 'Phân cách bằng dấu phẩy; để trống = tất cả',
  },
  {
    key: 'RUSTDESK_EXE_PATH',
    label: 'Đường dẫn rustdesk.exe',
    type: 'string',
    group: 'Remote (RustDesk)',
    default: 'C:\\Program Files\\RustDesk\\rustdesk.exe',
    hint: 'Trên máy agent — dùng khi admin bấm Mở Remote',
  },
  {
    key: 'RUSTDESK_ID',
    label: 'RustDesk ID',
    type: 'string',
    group: 'Remote (RustDesk)',
    hint: 'ID hiển thị trong app RustDesk trên máy này',
  },
  {
    key: 'RUSTDESK_PASSWORD',
    label: 'Mật khẩu RustDesk',
    type: 'string',
    group: 'Remote (RustDesk)',
    hint: 'Mật khẩu kết nối tới máy này (Permanent password)',
  },
] as const;

export const ENV_GROUPS = [
  'Kết nối',
  'Task / Shell',
  'Desktop automation',
  'Mở ứng dụng',
  'Trình duyệt',
  'Chrome extension',
  'Remote (RustDesk)',
] as const;
