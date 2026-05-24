# Project memory — DATN

Tài liệu nội bộ cho monorepo **server_datn**, chia theo **scope** (đọc theo thứ tự gợi ý).

| File | Nội dung |
|------|-----------|
| [architecture.md](./architecture.md) | Kiến trúc tổng thể: thành phần, stack, module backend, infra, khởi động nhanh |
| [agent.md](./agent.md) | Chức năng agent: entrypoint, socket, task, cấu hình |
| [flows.md](./flows.md) | Luồng hoạt động chính (sơ đồ Mermaid): auth, agent, task |
| [code-reference.md](./code-reference.md) | Bản đồ file/thư mục code theo package |

Mẫu env: `.env.example` (root), `agent/.env.example`. Admin UI: `admin-datn/` (cấu hình `VITE_*` trong `.env` local). Agent runtime production: `%ProgramData%\DATN\agent.env` (xem [`agent/README.md`](../../agent/README.md)).
