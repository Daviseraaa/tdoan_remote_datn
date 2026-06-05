# Bản đồ file code

Mô tả **thư mục / file quan trọng** theo từng package. Đường dẫn gốc: repo `server_datn/`.

---

## Root — NestJS backend (`src/`)

### Entry & cấu hình

| Đường dẫn | Vai trò |
|-----------|---------|
| `src/main.ts` | Bootstrap Nest, prefix `/api`, Swagger, CORS, Socket.IO adapter nếu có. |
| `src/app.module.ts` | Import toàn bộ module domain + Bull + Throttler + Pino. |
| `src/config/configuration.ts` | Factory cấu hình env (port, jwt, redis, cors, throttle, webrtc config legacy nếu còn). |

### Prisma & DB

| Đường dẫn | Vai trò |
|-----------|---------|
| `prisma/schema.prisma` | Schema: User, Agent, Task, Role, … |
| `prisma/seed.ts` | Seed dev |
| `src/prisma/prisma.module.ts` | `PrismaService` inject global. |

### `src/common/`

| Đường dẫn | Vai trò |
|-----------|---------|
| `constants/index.ts` | `WS_EVENTS`, `TASK_QUEUE`, … |
| `types/ws-protocol.ts` | Type payload WS agent (task, heartbeat, …). |
| `guards/jwt-auth.guard.ts`, `roles.guard.ts` | Bảo vệ HTTP theo JWT + role. |
| `filters/http-exception.filter.ts` | Chuẩn hóa lỗi HTTP. |
| `interceptors/transform.interceptor.ts` | Bọc response. |

### `src/modules/auth/`

| File | Vai trò |
|------|---------|
| `auth.module.ts` | JwtModule, Passport strategies. |
| `auth.controller.ts` | `POST /api/auth/...` login, refresh, … |
| `auth.service.ts` | Logic auth, hash, token. |
| `strategies/jwt.strategy.ts`, `jwt-refresh.strategy.ts` | Passport JWT. |
| `dto/*.ts` | Login, refresh, register. |

### `src/modules/users/`

| File | Vai trò |
|------|---------|
| `users.controller.ts` | CRUD user (`/api/users`). |
| `users.service.ts` | Nghiệp vụ user. |

### `src/modules/agents/`

| File | Vai trò |
|------|---------|
| `agents.controller.ts` | CRUD agent, tạo `agentKey` (`/api/agents`). |
| `agents.service.ts` | Online/offline, metadata. |
| `agents.gateway.ts` | **WebSocket `/ws/agent`**: connect theo `agentKey`, room `agent:{id}`, `task:execute` / `task:result`, heartbeat. |

### `src/modules/tasks/`

| File | Vai trò |
|------|---------|
| `tasks.controller.ts` | `/api/tasks` + **`/api/tasks/templates`** (CRUD, `…/run`). |
| `tasks.service.ts` | Task + template, enqueue. |
| `tasks.processor.ts` | **BullMQ worker** → `AgentsGateway`. |
| `dto/*.ts` | Create/query/template DTO. |

### `src/modules/automation/`

| File | Vai trò |
|------|---------|
| `automation.controller.ts` | `/api/workflows`, `POST :id/execute`. |
| `automation.service.ts` | CRUD workflow, graph, execute entry. |
| `workflow-runtime.service.ts` | Chạy workflow, `WorkflowRun`. |
| `workflow-runtime/graph-scheduler.ts` | Lập lịch bước theo graph. |
| `workflow-graph.ts` | Deserialize/validate graph. |

### `src/modules/triggers/`

| File | Vai trò |
|------|---------|
| `triggers.controller.ts` | `/api/triggers`, Telegram bots. |
| `triggers.service.ts` | CRUD trigger, list theo workflow. |
| `schedule-trigger.service.ts` | Cron/schedule. |
| `trigger-dispatcher.service.ts` | Dispatch → workflow runtime. |
| `telegram/telegram-webhook.controller.ts` | Webhook Telegram (public). |

### `src/modules/chrome-scripts/` · `desktop-recordings/`

| File | Vai trò |
|------|---------|
| `*.controller.ts` | CRUD + **`POST …/sync`** → `AgentsGateway`. |
| `*.service.ts` | Upsert DB từ payload agent. |

### `src/modules/admin/`

| File | Vai trò |
|------|---------|
| `admin.controller.ts` | `/api/admin` (users, agents, tasks, templates, audit). |
| `client.gateway.ts` | WebSocket **`/ws/client`**. |
| `audit.service.ts` | Audit log. |

### `src/modules/health/`

| File | Vai trò |
|------|---------|
| `health.controller.ts` | `GET /api/health`. |

---

## Admin UI (`admin-datn/src/`)

| Đường dẫn | Vai trò |
|-----------|---------|
| `main.tsx` | React root. |
| `App.tsx` | Router, layout, providers (Auth, WS). |
| `components/Navigation.tsx` | Sidebar + top bar. |
| `views/Login.tsx` | Đăng nhập. |
| `views/Dashboard.tsx` | Tổng quan. |
| `views/Agents.tsx` | Danh sách agent. |
| `views/Tasks.tsx` | Task + template. |
| `views/Workflows.tsx` | Workflow editor (XYFlow). |
| `views/Automations.tsx` | Triggers (read-only list). |
| `views/ChromeScripts.tsx`, `ChromeScriptEditor.tsx` | Chrome scripts + flow. |
| `views/DesktopRecordings.tsx`, `DesktopRecordingEditor.tsx` | Desktop recordings. |
| `views/TaskTemplateEditor.tsx` | Wizard template. |
| `views/Settings.tsx` | Quản lý user (admin). |
| `views/Documentation.tsx` | Trang docs. |
| `views/AuditLog.tsx` | Audit log. |
| `lib/api.ts` | Fetch wrapper + interceptors. |
| `lib/auth.ts` | Token / logout helper. |
| `lib/ws.ts` | Socket.IO client. |
| `lib/mappers.ts`, `apiScope.ts` | Tiện ích UI. |

---

## Agent core — Rust (`agent/core/src/`)

| Đường dẫn | Vai trò |
|-----------|---------|
| `main.rs` | Subcommand: `agent`, `service`, `worker`, … |
| `agent/runner.rs` | Socket.IO, heartbeat, tasks |
| `agent/tools.rs` | Dispatch `TaskType` |
| `agent/env_load.rs` | Load `%ProgramData%\DATN\agent.env` |
| `open_app.rs`, `desktop.rs`, `service.rs` | OPEN_APP, automation, SCM |

## Agent desktop — Electron (`agent/desktop/src/`)

| Đường dẫn | Vai trò |
|-----------|---------|
| `main/index.ts` | Entry |
| `shared/env-file.ts`, `env-schema.ts`, `paths.ts` | Config UI |
| `tray/tray.ts` | Tray + spawn core |
| `service/*.ts` | Windows service install |

---

## Hằng số socket (tham chiếu nhanh)

`WS_EVENTS` — `src/common/constants/index.ts`; payload — `src/common/types/ws-protocol.ts`.

- **Agent** `/ws/agent`: `task:execute`, `task:result`, `agent:heartbeat`, `agent:chrome-scripts:sync`, …
- **Admin** `/ws/client`: `task:completed`, `task:failed`, …

---

## Góc quên / mở rộng

- **`docker-compose.yml`**, **`package.json`** scripts ở root và từng package.
- **Test**: `test/`, `*.spec.ts` trong module.

Cập nhật file này khi thêm module hoặc đổi tên file entry quan trọng.
