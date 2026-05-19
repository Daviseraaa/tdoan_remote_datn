# Bản đồ file

Gốc: **`agent/`**

## Rust — `core/src/`

| File / thư mục | Vai trò |
|----------------|---------|
| `main.rs` | Subcommand: `agent`, `service`, `worker`, `desktop-exec`, `ping-console` |
| `config/settings.rs` | `AgentConfig` từ env |
| `config/env_load.rs` | Nạp `%ProgramData%\DATN\agent.env` + fallback dev |
| `connection/runner.rs` | Socket.IO `/ws/agent`, `task:execute`, `agent:heartbeat` |
| `connection/telemetry.rs` | Sample CPU/RAM/IP cho heartbeat |
| `protocol/wire.rs` | `TaskWire` → `task:result` |
| `tasks/registry.rs` | `TaskHandler` registry, `run_task`, `supported_task_types` |
| `tasks/handlers/*.rs` | Một handler mỗi task type |
| `platform/shell.rs` | `COMMAND` / `SCRIPT` (PowerShell/cmd) |
| `platform/open_app/mod.rs` | Resolve + launch app (Win/macOS/Linux) |
| `platform/mod.rs` | `Platform` facade, traits `OpenApp`, `DesktopAutomation` |
| `platform/windows/desktop.rs` | Win32 `DESKTOP_AUTOMATION` |
| `platform/windows/service.rs` | Windows Service SCM |
| `platform/windows/ipc.rs` | Named pipe protocol v1 |
| `platform/windows/ipc_dispatch.rs` | Handler IPC (ping, desktop runSteps) |
| `platform/windows/pipe_server.rs` | Accept pipe svc / user |
| `bin/main_test.rs` | Dev: thử `open_app_resolve` nhanh |

## Desktop — `desktop/src/`

| File | Vai trò |
|------|---------|
| `main/index.ts` | Electron entry |
| `main/ipc.ts` | IPC settings |
| `main/settings-window.ts` | Cửa sổ cài đặt |
| `shared/paths.ts` | ProgramData config, core exe path |
| `shared/env-schema.ts` | Định nghĩa field UI |
| `shared/env-file.ts` | Đọc/ghi agent.env |
| `tray/tray.ts` | Tray, spawn core, menu |
| `service/*.ts` | Cài/gỡ service |

## Scripts

| Script | Việc |
|--------|------|
| `npm run build:core` | cargo release → `bin/` |
| `npm run build:desktop` | tsc + copy renderer |
| `npm run dev` | Electron dev |
| `npm run dist:desktop` | electron-builder NSIS |

Contract WS: `src/common/constants/index.ts`, `src/common/types/ws-protocol.ts` (repo root).
