# Tài liệu Agent

Package **`agent/`**: **`core/`** (Rust runtime) + **`desktop/`** (Electron control panel).

| File | Nội dung |
|------|----------|
| [architecture.md](./architecture.md) | Layer `connection` / `tasks` / `platform`, config ProgramData |
| [flows.md](./flows.md) | Luồng WS, registry task, heartbeat telemetry |
| [code-reference.md](./code-reference.md) | Bản đồ thư mục Rust + desktop |
| [extending-tools-and-tasks.md](./extending-tools-and-tasks.md) | Thêm task type (handler + registry + server) |
| [user-simulation.md](./user-simulation.md) | DESKTOP_AUTOMATION (handler + Win32) |

Mẫu env: [`../.env.example`](../.env.example). Production: **`%ProgramData%\DATN\agent.env`**.
