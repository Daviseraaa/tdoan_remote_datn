# Tài liệu Agent

Package **`agent/`**: **`core/`** (Rust runtime) + **`desktop/`** (Electron control panel).

| File | Nội dung |
|------|----------|
| [architecture.md](./architecture.md) | Layer `connection` / `tasks` / `platform`, config ProgramData |
| [flows.md](./flows.md) | Luồng WS, registry task, heartbeat telemetry |
| [code-reference.md](./code-reference.md) | Bản đồ thư mục Rust + desktop |
| [extending-tools-and-tasks.md](./extending-tools-and-tasks.md) | Thêm task type (handler + registry + server) |
| [user-simulation.md](./user-simulation.md) | DESKTOP_AUTOMATION (handler + Win32) |
| [remote-access.md](./remote-access.md) | WoL metadata, RDP, API server |
| [huong-dan-cai-dat.md](./huong-dan-cai-dat.md) | **Hướng dẫn cài/gỡ agent cho người dùng cuối** |

Mẫu env: [`../.env.example`](../.env.example). Production: **`%ProgramData%\StationHub\agent.env`**.
