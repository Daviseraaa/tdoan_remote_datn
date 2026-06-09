# Mô phỏng hành động người dùng (DESKTOP_AUTOMATION)

Task type **`DESKTOP_AUTOMATION`**: một chuỗi **bước** (delay, mở app, chuột, phím, cuộn, …) trên máy chạy agent.

## Thực thi hiện tại (Rust)

- Handler: [`core/src/tasks/handlers/desktop.rs`](../core/src/tasks/handlers/desktop.rs) — validate steps, policy env.
- Platform: [`core/src/platform/windows/desktop.rs`](../core/src/platform/windows/desktop.rs) — Win32 (`SetCursorPos`, `SendInput`).
- Input không qua Node/nut-js.
- **Cuộn ngang** (`scroll` `left`/`right`): có thể trả lỗi “chưa implement”; cuộn dọc dùng `MOUSEEVENTF_WHEEL`.
- Trên macOS/Linux: `platform.desktop().is_available() == false` → task failed; type không có trong `metadata.capabilities` lúc connect.

## Bảo mật và bật/tắt

- Mặc định **tắt**: `DESKTOP_AUTOMATION_ENABLED=true` trong `.env` trên máy agent.
- Chỉ bật trong môi trường tin cậy — task hợp lệ trên server có thể điều khiển máy nếu flag bật.

## Phiên làm việc (Windows)

- **Windows Service (`StationHubAgentNative`)** thường chạy **không** trong session desktop người dùng → gửi input tới màn hình người dùng **không đáng tin**.
- **Khuyến nghị:** chạy agent trong session đăng nhập: `npm start`, hoặc **Electron tray** (`npm run dev` / bản đóng gói) — process Rust là con của user session.

## macOS / Linux

Binary và desktop automation được tối ưu cho **Windows**. Trên hệ khác, handler trả lỗi tương đương “chỉ hỗ trợ Windows”.

## Payload: `command` hoặc `payload`

Server gửi `task:execute`. Handler đọc (logic trong `tasks/handlers/desktop.rs`):

1. `payload.steps` — mảng bước (khuyến nghị).
2. `payload.script` — chuỗi JSON → mảng hoặc `{ "steps": [...] }`.
3. `command` — nếu bắt đầu bằng `[` hoặc `{` thì parse JSON.

## Các bước (`action`)

| `action` | Trường | Mô tả |
|----------|--------|--------|
| `delay` | `ms` | Giới hạn `DESKTOP_AUTOMATION_MAX_DELAY_MS`. Dùng `tokio::time::sleep`. |
| `openApp` | `target` | Qua `platform::open_app::open_app_resolve`. **Windows:** chỉ thành công khi có cửa sổ hiển thị (poll `MainWindowHandle` / cửa sổ mới, timeout `OPEN_APP_WINDOW_WAIT_MS`). |
| `move` | `x`, `y` | |
| `click` | `x?`, `y?`, `button?`, `double?` | `left` / `right`. |
| `typeText` | `text` | Unicode qua `SendInput`. Giới hạn `DESKTOP_AUTOMATION_MAX_TYPE_CHARS`. |
| `keyCombo` | `keys` | Token: `ctrl`, `alt`, `shift`, phím một ký tự, `F1`… |
| `scroll` | `direction`, `amount` | `up`/`down`/`left`/`right`; trái/phải có thể không hỗ trợ. |

Số bước tối đa: `DESKTOP_AUTOMATION_MAX_STEPS`.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|-----------|---------|
| `DESKTOP_AUTOMATION_ENABLED` | `false` | |
| `DESKTOP_AUTOMATION_MAX_STEPS` | `200` | |
| `DESKTOP_AUTOMATION_MAX_DELAY_MS` | `60000` | |
| `DESKTOP_AUTOMATION_MAX_TYPE_CHARS` | `8000` | |

## Ví dụ payload

(Xem README agent — ví dụ JSON mảng `steps` không đổi; dán vào `command` hoặc `payload.steps` trên admin/API.)

## Kết quả task

- Thành công: JSON có `outcomes`, `steps` (`platform/windows/desktop::run_steps_json`).
- Lỗi: message mô tả bước lỗi.

## Liên quan code

| Thành phần | File thực thi |
|-------------|----------------|
| Task handler + validate steps | [`core/src/tasks/handlers/desktop.rs`](../core/src/tasks/handlers/desktop.rs) |
| Desktop Win32 | [`core/src/platform/windows/desktop.rs`](../core/src/platform/windows/desktop.rs) |
| Mở app (task `OPEN_APP` + bước `openApp`) | [`core/src/platform/open_app/mod.rs`](../core/src/platform/open_app/mod.rs) |
| Registry / capabilities | [`core/src/tasks/registry.rs`](../core/src/tasks/registry.rs) |

Xem thêm [extending-tools-and-tasks.md](./extending-tools-and-tasks.md).
