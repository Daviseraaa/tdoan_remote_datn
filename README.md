# DATN Server — Automation & Agent Task Platform

Backend server xây dựng bằng **NestJS 11** cho hệ thống quản lý agent, hàng đợi task và tự động hóa.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ / TypeScript |
| Framework | NestJS 11 |
| Database | PostgreSQL 16 (Prisma ORM) |
| Cache/Queue | Redis 7 + BullMQ |
| WebSocket | Socket.IO |
| Auth | JWT (access + refresh token) + RBAC |
| API Docs | Swagger |
| Logging | Pino |

## Cài đặt và chạy

### 1. Yêu cầu

- Node.js >= 20
- Docker & Docker Compose
- npm

### 2. Clone và cài dependencies

```bash
npm install
```

### 3. Cấu hình environment

```bash
cp .env.example .env
# Chỉnh sửa .env nếu cần
```

### 4. Khởi động PostgreSQL + Redis

```bash
docker-compose up -d postgres redis
```

### 5. Chạy migration và seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 6. Chạy server

```bash
# Development (hot-reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 7. Truy cập

- **API**: http://localhost:3000/api
- **Swagger docs**: http://localhost:3000/api/docs
- **Health check**: http://localhost:3000/api/health

## Seed accounts

| Email | Password | Role |
|-------|----------|------|
| admin@datn.com | admin123 | ADMIN |
| user@datn.com | user123 | USER |

## API Modules

### Auth (`/api/auth`)
- `POST /register` - Đăng ký
- `POST /login` - Đăng nhập
- `POST /refresh` - Refresh token
- `POST /logout` - Đăng xuất

### Users (`/api/users`)
- `GET /me` - Xem profile
- `PATCH /me` - Cập nhật profile
- `POST /me/change-password` - Đổi mật khẩu
- `GET /` - Danh sách user (Admin)
- `DELETE /:id` - Xóa user (Admin)

### Agents (`/api/agents`)
- `POST /` - Đăng ký agent mới
- `GET /` - Danh sách agents
- `GET /:id` - Chi tiết agent
- `DELETE /:id` - Xóa agent

### Tasks (`/api/tasks`)
- `POST /` - Tạo task
- `GET /` - Danh sách tasks
- `GET /:id` - Chi tiết task + logs
- `DELETE /:id` - Hủy task

### Workflows (`/api/workflows`)
- `POST /` - Tạo workflow
- `GET /` - Danh sách workflows
- `GET /:id` - Chi tiết workflow
- `PATCH /:id` - Cập nhật workflow
- `DELETE /:id` - Xóa workflow
- `POST /:id/execute` - Chạy workflow thủ công

## WebSocket

Agent kết nối qua namespace `/ws/agent` với `agentKey` authentication.

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `agent:heartbeat` | Agent → Server | Heartbeat mỗi 30s |
| `task:execute` | Server → Agent | Gửi lệnh thực thi |
| `task:result` | Agent → Server | Kết quả thực thi |
| `task:completed` | Server → Client | Thông báo hoàn thành |

## Cấu trúc thư mục

```
src/
├── main.ts                 # Bootstrap + Swagger
├── app.module.ts           # Root module
├── config/                 # Typed configuration
├── prisma/                 # Prisma service (global)
├── common/
│   ├── constants/          # App constants, WS events
│   ├── decorators/         # @Public, @Roles, @CurrentUser
│   ├── guards/             # JWT, Roles, WS auth guards
│   ├── filters/            # Global exception filter
│   ├── interceptors/       # Response transform
│   └── dto/                # Pagination DTOs
└── modules/
    ├── auth/               # JWT auth, strategies
    ├── users/              # User CRUD
    ├── agents/             # Agent CRUD + WebSocket gateway
    ├── tasks/              # Task CRUD + BullMQ processor
    ├── automation/         # Workflow CRUD + execution
    └── health/             # Health checks
```

## Docker

```bash
# Chạy toàn bộ stack
docker-compose up -d

# Chỉ database + redis
docker-compose up -d postgres redis
```

## Scripts

```bash
npm run start:dev     # Dev mode (hot-reload)
npm run build         # Build production
npm run start:prod    # Run production
npm run lint          # ESLint
npm run format        # Prettier
npm run prisma:studio # Prisma Studio GUI
```

## Workstation agent

Máy trạm: [`agent/README.md`](./agent/README.md) — Rust core (`agent/core`) + Electron desktop (`agent/desktop`). Build: `cd agent && npm run build:core`.

## Logging

- **Backend**: `nestjs-pino` — cấu hình trong `src/app.module.ts` (`LoggerModule.forRoot`); dev dùng `pino-pretty`.
- **Agent desktop**: `agent/desktop` — Pino; **Rust core**: stdout / `RUST_LOG`.

### Environment

- `LOG_LEVEL` (`trace|debug|info|warn|error|fatal`): root `.env` cho server; agent dev: `agent/.env`, production: `%ProgramData%\DATN\agent.env`.

### Backend vs Agent

Hai process đọc env khác nhau; có thể chỉnh `LOG_LEVEL` riêng khi debug.
