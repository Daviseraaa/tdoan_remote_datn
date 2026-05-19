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
```

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

**Không** commit `bin/`, `core/target/`, `desktop/release/`. Crate Rust nằm tại `core/` — thư mục `native/` ở repo root chỉ còn README redirect (bản cũ `native/datn-agent-native` đã bỏ).

## Debug nhanh

| Vấn đề | Xem |
|--------|-----|
| Task / WS | Log trong cửa sổ Logs (tray) |
| Config | `%ProgramData%\DATN\agent.env` |
| Core | `bin\datn-agent-native.exe agent` |
| UI | `cd desktop && npm run dev` |
