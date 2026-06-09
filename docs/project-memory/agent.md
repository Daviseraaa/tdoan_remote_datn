# Agent — chức năng và cấu hình

Trên máy được quản lý, process **Rust** (`agent/core`, binary `stationhub-agent-native`) duy trì **Socket.IO** tới backend (**`/ws/agent`**).

**Desktop** (`agent/desktop`, Electron): quản lý **`%ProgramData%\StationHub\agent.env`**, tray, log, cài service — không chạy task.

Tài liệu: [`agent/docs/README.md`](../../agent/docs/README.md).

## Phân vùng mã

| Vị trí | Việc chính |
|--------|------------|
| **`agent/core/`** | Rust: runner, tools, wire, command, env_load, open_app, desktop |
| **`agent/desktop/`** | Electron: env-schema, settings UI, tray, service scripts |
| **`agent/bin/`** | `stationhub-agent-native.exe` (artifact) |

## Config

- **Production:** `%ProgramData%\StationHub\agent.env` (desktop ghi, core đọc qua `dotenvy`)
- **Dev:** `agent/.env` fallback
- Override: `STATIONHUB_AGENT_CONFIG`

## Entrypoint

| Entry | Hành vi |
|-------|--------|
| `bin/stationhub-agent-native.exe agent` | Foreground |
| `bin/stationhub-agent-native.exe service` | Windows Service `StationHubAgentNative` |
| `cd agent && npm run dev` | Desktop tray + spawn core |

## Build

```bash
cd agent && npm run build:core && npm run dev
```

Installer: `npm run dist:desktop` → `agent/desktop/release/`.
