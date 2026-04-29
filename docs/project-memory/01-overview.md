# Server DATN - Project Overview

## Monorepo Components

- `src` + `prisma` + root `package.json`: NestJS backend (API + WS + queue).
- `admin`: React + Vite admin dashboard.
- `agent`: Node/Electron client agent chạy trên máy điều khiển từ xa.
- `9remote`: project phụ độc lập, không thấy được wired vào scripts root.

## Backend Architecture (NestJS)

- Entry: `src/main.ts` (global prefix `/api`, Swagger `/api/docs`).
- Root module: `src/app.module.ts`.
- Core modules đang có:
  - `src/modules/auth`
  - `src/modules/users`
  - `src/modules/agents`
  - `src/modules/tasks`
  - `src/modules/automation`
  - `src/modules/health`
  - `src/modules/admin`
  - `src/modules/remote`
- Shared layer: `src/common` (decorators/guards/filters/interceptors/constants).
- Config: `src/config/configuration.ts`.
- ORM: `prisma/schema.prisma` + `src/prisma`.

## Data/Infra Dependencies

- PostgreSQL + Prisma.
- Redis + BullMQ.
- Socket.IO cho kênh giao tiếp backend <-> agent.
- Docker stack ở `docker-compose.yml`.

## Frontend Admin Architecture

- Entry: `admin/src/main.tsx` -> `admin/src/App.tsx`.
- Router/pages nằm ở `admin/src/routes`, `admin/src/pages`.
- State/data stack: React Query + Zustand + Axios.

## Agent Architecture

- Runtime entry: `agent/src/main.ts`.
- Tray entry: `agent/src/tray/tray.ts`.
- Agent kết nối server qua Socket.IO client.
- Có scripts cho Windows service install/uninstall.

## Environment Files (templates)

- Root backend: `.env.example`
- Admin frontend: `admin/.env.example`
- Agent: `agent/.env.example`

Ghi chú: file `.env` thật đang tồn tại trong workspace (ví dụ `admin/.env`), không commit và không copy vào docs.

## Known Risks / Things To Watch

- Workspace hiện có `node_modules` trong repo tree, dễ gây nhiễu khi tìm file và tăng rủi ro commit nhầm.
- Có nhiều package con (`root`, `admin`, `agent`, `9remote/src`), cần chạy lệnh đúng thư mục.
