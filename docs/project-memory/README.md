# Project memory — DATN

Tài liệu nội bộ cho monorepo **server_datn**. Đọc theo thứ tự gợi ý bên dưới.

## Chỉ mục

| File | Nội dung |
|------|-----------|
| [architecture.md](./architecture.md) | **Kiến trúc** — context, container, deployment, module Nest, admin, agent, ER diagram |
| [flows.md](./flows.md) | **Luồng hoạt động** — 12+ sơ đồ Mermaid (auth, agent, task, workflow, trigger, sync) |
| [agent.md](./agent.md) | Agent Rust / Electron / Chrome Extension |
| [code-reference.md](./code-reference.md) | Bản đồ file/thư mục theo package |

## Sơ đồ ở đâu?

| Nhu cầu | Mở file |
|---------|---------|
| Hệ thống gồm những gì? Ai nói chuyện với ai? | [architecture.md §2 Container](./architecture.md#2-sơ-đồ-container-container) |
| Module backend | [architecture.md §5](./architecture.md#5-kiến-trúc-module-nestjs) |
| Admin routes & components | [architecture.md §6](./architecture.md#6-kiến-trúc-admin-spa) |
| Đăng nhập / task / workflow | [flows.md](./flows.md) |
| Trạng thái task | [flows.md §4](./flows.md#4-trạng-thái-task) |

Hub tài liệu repo: [../README.md](../README.md).

## Cấu hình

| File | Phạm vi |
|------|---------|
| `.env.example` (root) | Backend |
| `admin-datn/.env` | `VITE_*` |
| `agent/.env.example` | Dev agent |
| `%ProgramData%\DATN\agent.env` | Agent production — [agent/README.md](../../agent/README.md) |

## Cập nhật tài liệu

Khi thêm module hoặc luồng mới:

1. Bổ sung sơ đồ vào `architecture.md` hoặc `flows.md` (Mermaid).
2. Cập nhật `code-reference.md` nếu có thư mục/file mới.
3. Giữ tên event/API trùng code (`WS_EVENTS`, route `/api/...`).
