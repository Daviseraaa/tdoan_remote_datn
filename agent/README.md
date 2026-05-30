# DATN Agent

Monorepo máy trạm: **Rust core** (runtime) + **desktop** (Electron — quản lý cấu hình, tray, service).

## Cấu trúc

```
agent/
├── core/           # Rust — WebSocket, task, Win32 (datn-agent-native)
├── desktop/        # Electron — cài đặt env, tray, log, cài service
├── bin/            # datn-agent-native.exe (sau build:core)
├── docs/
├── .env.example    # mẫu biến
└── .env            # dev fallback (gitignore)
```

**Config runtime (production):** `%ProgramData%\DATN\agent.env` — desktop app ghi file này; Rust đọc khi khởi động.

## Yêu cầu

- Windows 10/11 x64 (chính)
- Rust toolchain
- Node.js 20+

## Build

```powershell
cd agent
npm install
npm run build          # core + desktop
npm run build:all      # core + cloak-runner + desktop (installer đầy đủ)
```

### CloakBrowser (`OPEN_BROWSER`)

```powershell
pip install -e agent/CloakBrowser   # một lần trên máy build
npm run build:cloak-runner          # → agent/bin/cloak/
```

Dev không build exe: Rust dùng `python agent/cloak-runner/main.py` nếu có Python + cloakbrowser.

`OPEN_BROWSER`: **admin** chọn Cloak hoặc Chrome qua payload task (`useChromeProfile`). Mặc định Cloak. Chrome profile thật: `{ "useChromeProfile": true, "chromeProfile": "Default" }`.

### Chrome extension (`CHROME_EXTENSION`)

DOM snapshot / click / fill trên **Chrome thật** qua extension + Native Messaging (không CDP).

```powershell
npm run build:chrome-bridge
npm run chrome-bridge:install   # registry Native Messaging + manifest
```

1. `chrome://extensions` → bật Developer mode → **Load unpacked** → `agent/chrome-extension/`
2. Mở Chrome (extension tự `connectNative`)
3. Trong `%ProgramData%\DATN\agent.env`: `CHROME_EXTENSION_ENABLED=true`
4. Chạy agent (tray hoặc `datn-agent-native.exe agent`)

Task ví dụ:

```json
{
  "action": "snapshotDom",
  "urlPattern": "https://example.com/*",
  "maxNodes": 200
}
```

Hoặc `steps[]`: `snapshotDom`, `click`, `fill`, `waitFor`, `delay`.

### Desktop automation recorder

Ghi thao tác chuột/phím trên Windows, xuất JSON tương thích `DESKTOP_AUTOMATION`.

```powershell
npm run build:desktop-recorder
# → agent/bin/datn-desktop-recorder.exe
```

**GUI (khuyến nghị):** double-click `datn-desktop-recorder.exe` hoặc chạy không tham số — quản lý bản ghi, **Bắt đầu ghi** (cửa sổ tự thu nhỏ), **Chạy lại**, xóa, mở thư mục.

**CLI:** `datn-desktop-recorder.exe record --name "Mo ung dung"` — F12 dừng và lưu → `%ProgramData%\DATN\desktop-recordings\{uuid}.json`

**Chạy lại local:** GUI → chọn bản ghi → **Chạy lại**, hoặc:

```powershell
npm run build:core   # cần datn-agent-native.exe
datn-agent-native.exe desktop-replay C:\ProgramData\DATN\desktop-recordings\<id>.json
# hoặc
datn-desktop-recorder.exe replay C:\ProgramData\DATN\desktop-recordings\<id>.json
```

Admin → **Desktop recordings** → chọn agent online → **Đồng bộ từ agent** → **Tạo task template**.

Chạy lại qua agent/task trên server cần `DESKTOP_AUTOMATION_ENABLED=true` trong `agent.env`. Chạy lại local từ recorder **không** cần flag đó.

### Ghi & chạy lại script (recorder)

1. Icon extension → popup **Bắt đầu ghi** trên tab đang mở.
2. Thao tác trang (click, nhập text, chọn) — badge đỏ góc phải hiện số bước.
3. **Dừng & lưu** → file JSON: `%ProgramData%\DATN\chrome-scripts\{uuid}.json` (không cần agent online; chỉ cần native host `datn-chrome-bridge.exe` chạy được)
4. Tray DATN → **Chrome scripts** → **Chạy lại** (local).
5. Admin → **Chrome scripts** → chọn agent online → **Đồng bộ từ agent** (server pull toàn bộ file local).

CLI (khi `datn-agent-native.exe` đã build):

```powershell
datn-agent-native.exe chrome-replay C:\ProgramData\DATN\chrome-scripts\<id>.json
```

**MVP recorder:** một tab, `click` / `fill` / `delay` tự động; không scroll/drag/file upload/iframe khác origin.

**Lỗi "Timeout lưu script"**

- Bản bridge cũ chờ agent pipe 30s rồi thoát → extension không nhận `recordingSaved`. Sửa: rebuild `npm run build:chrome-bridge`, đóng Chrome (hoặc `taskkill /IM datn-chrome-bridge.exe /F`), `npm run chrome-bridge:install`, reload extension.
- Registry native host phải trỏ tới `agent/bin/datn-chrome-bridge.exe` (hoặc bản vừa build trong `chrome-bridge/target/release/`).

**Kiểm thử thủ công**

- [ ] Popup ghi → dừng → file xuất hiện trong `chrome-scripts`
- [ ] Tray replay lặp lại thao tác
- [ ] Admin **Đồng bộ từ agent** → thấy bản ghi trên server
- [ ] Tạo template / import vào bước workflow `CHROME_EXTENSION`

### Chụp màn hình (`SCREEN_CAPTURE`)

```json
{
  "type": "SCREEN_CAPTURE",
  "command": "0",
  "payload": {
    "monitor": 0,
    "includeBase64": true,
    "savePath": "C:\\ProgramData\\DATN\\captures\\shot.png"
  }
}
```

- `SCREEN_CAPTURE_ENABLED=true` (mặc định) trong `agent.env`.
- `monitor`: 0 = màn hình chính.
- Để trống `savePath` → `%ProgramData%\DATN\captures\{taskId}.png`.
- Telegram: `sendTelegram`, `telegramBotId`, `chatId`, `caption`, `onlySendTelegram` / `saveToFile: false`.
- `telegramSendAs`: `photo` (mặc định, `sendPhoto`) hoặc `document` (`sendDocument`); `telegramFileName` khi gửi file (mặc định `screenshot.png`).
- Kết quả JSON: `path`, `width`, `height`, `stdout` (tóm tắt); `base64` nếu file nhỏ hơn `MAX_OUTPUT_BYTES`.

Extension ID cố định (manifest `key`): xem `chrome-extension/EXTENSION_ID.txt`. Nếu Chrome báo `key` invalid: `node scripts/generate-chrome-extension-key.js` rồi `npm run chrome-bridge:install`.

Chỉ core:

```powershell
npm run build:core
```

Chỉ desktop:

```powershell
npm run build:desktop
```

## Chạy dev

```powershell
npm run build:core
npm run dev            # Electron tray + spawn core
```

Hoặc chạy core trực tiếp (đã có `.env` hoặc ProgramData config):

```powershell
.\bin\datn-agent-native.exe agent
```

## Desktop installer (.exe)

```powershell
npm run dist:desktop
```

Output: `desktop/release/` — `DATN Agent Setup x.x.x.exe` (NSIS) và `win-unpacked/` (portable).

Build local không ký code (`signAndEditExecutable: false`). Nếu vẫn lỗi symlink khi giải nén cache: bật **Developer Mode** (Settings → System → For developers) hoặc chạy terminal **Administrator**, rồi xóa `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` và chạy lại.

## Windows Service

```powershell
npm run service:install    # cần Admin
npm run service:uninstall
```

Service: **`DATNAgentNative`** → `bin\datn-agent-native.exe service`

## AGENT_KEY

Tạo trên server `POST /api/agents`, nhập trong **Cài đặt** (tray → Cài đặt…) hoặc ghi vào `%ProgramData%\DATN\agent.env`.

## Tài liệu

[`docs/README.md`](./docs/README.md)

## Dọn artifact (tùy chọn)

```powershell
npm run clean          # xóa bin/, desktop/dist, core/target
```

**Không** commit `bin/`, `core/target/`, `chrome-bridge/target/`, `desktop/release/`. Crate Rust nằm tại `core/`.

## Debug nhanh

| Vấn đề | Xem |
|--------|-----|
| Task / WS | Log trong cửa sổ Logs (tray) |
| Config | `%ProgramData%\DATN\agent.env` |
| Core | `bin\datn-agent-native.exe agent` |
| UI | `cd desktop && npm run dev` |
