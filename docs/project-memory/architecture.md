# Kiến trúc tổng thể — server_datn

## Mục tiêu hệ thống

Nền tảng **server + agent + admin**: quản trị user/agent, giao việc (task) tới máy chạy agent, automation/workflow, health; realtime qua **Socket.IO** (`/ws/agent`).

## Monorepo — các package

| Thư mục | Vai trò |
|--------|---------|
| **Root** (`src/`, `prisma/`) | API **NestJS 11**, WebSocket, queue, Prisma |
| **admin-datn/** | SPA **React 19 + Vite + Tailwind**: đăng nhập, quản lý, task, workflow |
| **agent/core/** | Crate **Rust**: Socket.IO `/ws/agent`, heartbeat, task |
| **agent/desktop/** | Electron control panel: config ProgramData, tray, service install |
| **agent/bin/** | Binary `datn-agent-native.exe` (artifact, gitignore) |
| **agent/chrome-bridge/** | Native Messaging host (Rust); `target/` gitignore |

## Stack kỹ thuật (tóm tắt)

- **Backend**: NestJS, `nestjs-pino`, JWT access/refresh, Throttler, BullMQ, Schedule.
- **Dữ liệu**: PostgreSQL + **Prisma** (`prisma/schema.prisma`).
- **Hàng đợi / cache**: **Redis** + BullMQ.
- **Realtime**: **Socket.IO** — namespace `/ws/agent` (agent lifecycle + task).
- **Admin UI**: React Router, TanStack Query, fetch (`admin-datn/src/lib/api.ts`).

## Module NestJS (domain)

Đăng ký trong `src/app.module.ts`:

- **auth** — đăng nhập, refresh token.
- **users** — người dùng + RBAC (Prisma `Role`).
- **agents** — CRUD agent, cấp `agentKey`, **AgentsGateway** `/ws/agent`.
- **tasks** — tạo/hủy task, worker đẩy `task:execute` tới agent.
- **automation** — workflow (`/api/workflows`…).
- **health** — `/api/health`.
- **admin** — thống kê/audit phía quản trị.

Chung: **`src/common`** (constants, guards, filters, interceptors), **`src/prisma`**, **`src/config/configuration.ts`**.

## Hạ tầng local

- **`docker-compose.yml`**: PostgreSQL, Redis (theo cấu hình repo).
- API prefix: **`/api`** (xem `src/main.ts`); Swagger thường **`/api/docs`**.

## Khởi động nhanh (dev)

**Backend** (thư mục repo root):

```bash
npm install
cp .env.example .env
npm run docker:up
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

**Admin UI** (`admin-datn/`):

```bash
cd admin-datn
npm install
npm run dev
```

**Agent** (`agent/`):

```bash
npm install
cp .env.example .env
npm run build:core
npm run dev            # Electron tray + core
```

URL mặc định thường gặp: API `http://localhost:3000/api`, admin Vite `http://localhost:5173`.

## Logging

- **Server**: `nestjs-pino` trong `src/app.module.ts` (`LoggerModule.forRoot`), dev dùng `pino-pretty`.
- **Agent desktop**: Pino trong `agent/desktop`. Log task/WS từ **stdout/stderr** của `bin/datn-agent-native.exe`.

## Rủi ro / lưu ý vận hành

- Không commit `.env`.
- `node_modules` trong workspace có thể làm nhiễu search; tránh commit nhầm.
- Debug WS: đối chiếu log **Nest** và log **agent** cùng lúc.
