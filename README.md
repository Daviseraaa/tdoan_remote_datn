# StationHub — Nền tảng Agent, Task & Workflow Automation

Monorepo triển khai hệ thống **điều phối agent máy trạm**, **hàng đợi task**, **workflow đồ thị**, **trigger lịch/Telegram** và **console quản trị web**. Agent chạy trên Windows (Rust native + Electron tray), server điều phối qua HTTP REST và WebSocket.

---

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Công nghệ](#công-nghệ)
3. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
4. [Chrome & Desktop recording](#chrome--desktop-recording-agent)
5. [Cài đặt & chạy dev](#cài-đặt--chạy-dev)
6. [Triển khai production](#triển-khai-production)
7. [Luồng hoạt động](#luồng-hoạt-động)
8. [API & WebSocket](#api--websocket)
9. [Tài liệu chi tiết](#tài-liệu-chi-tiết)

---

## Tổng quan

| Thành phần | Vai trò |
|------------|---------|
| **Server** (`src/`) | NestJS API, BullMQ worker, Socket.IO gateway, trigger Telegram/lịch, billing |
| **Admin UI** (`admin-stationhub/`) | React SPA — dashboard, agent fleet, task template, workflow editor, bot Telegram |
| **Agent** (`agent/`) | `stationhub-agent-native` (Rust) kết nối WS, thực thi task; Electron tray cấu hình & service Windows |
| **Chrome Extension** | Ghi/chạy lại thao tác DOM qua Native Messaging |
| **Desktop Recorder** | Ghi chuột/phím/UIA, xuất JSON `DESKTOP_AUTOMATION` |

**Luồng nghiệp vụ chính:** User tạo workflow / task template trên admin → server enqueue qua Redis → gửi `task:execute` tới agent online → agent trả `task:result` → cập nhật DB + push realtime tới UI.

---

## Công nghệ

### Backend (server)

| Lớp | Công nghệ |
|-----|-----------|
| Runtime | Node.js 20+, TypeScript 5 |
| Framework | NestJS 11 |
| ORM | Prisma 6 + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Realtime | Socket.IO (`@nestjs/platform-socket.io`) |
| Auth | JWT access/refresh, Passport, RBAC (`ADMIN` / `USER`) |
| Billing | SePay VietQR + webhook |
| Lịch | `@nestjs/schedule` + cron triggers |
| API docs | Swagger (`/api/docs`) |
| Log | Pino (`nestjs-pino`) |

### Frontend (admin-stationhub)

| Lớp | Công nghệ |
|-----|-----------|
| UI | React 19, Vite 6, Tailwind CSS 4 |
| Routing | React Router 7 |
| Data | TanStack Query 5 |
| Workflow canvas | React Flow (`@xyflow/react`) |
| Realtime | `socket.io-client` |
| i18n | Type-safe keys (`src/i18n/vi.ts`) |

### Agent (máy trạm)

| Lớp | Công nghệ |
|-----|-----------|
| Core runtime | Rust (`agent/core`) — WebSocket, task registry, Win32 |
| Desktop shell | Electron (`agent/desktop`) — tray, cài đặt, installer NSIS |
| UIA | `stationhub-windows-uia` crate |
| Recorder | `stationhub-desktop-recorder` (egui) |
| Chrome bridge | `stationhub-chrome-bridge` + MV3 extension |

### Task types hỗ trợ trên agent

`COMMAND` · `SCRIPT` · `SYSTEM_INFO` · `OPEN_APP` · `OPEN_BROWSER` · `DESKTOP_AUTOMATION` · `CHROME_EXTENSION` · `SCREEN_CAPTURE` · `HTTP_REQUEST` · (`FILE_OPERATION` — chưa implement)

---

## Cấu trúc thư mục

```
server_stationhub/
├── src/                          # NestJS backend
│   ├── main.ts                   # Bootstrap, Swagger, global prefix /api
│   ├── app.module.ts             # Root module
│   ├── config/                   # Typed env configuration
│   ├── prisma/                   # PrismaService (global)
│   ├── common/                   # Guards, filters, WS protocol, decorators
│   └── modules/
│       ├── auth/                 # Đăng ký, login, refresh token
│       ├── users/                # Profile, admin quản lý user
│       ├── agents/               # CRUD agent + AgentsGateway (/ws/agent)
│       ├── tasks/                # Task, template, BullMQ processor
│       ├── automation/           # Workflow, runtime graph, biến {{steps.*}}
│       ├── triggers/             # Schedule + Telegram bot/webhook
│       ├── billing/              # Gói đăng ký, SePay
│       ├── chrome-scripts/       # Script Chrome sync từ agent
│       ├── desktop-recordings/   # Bản ghi desktop sync từ agent
│       ├── admin/                # API admin + audit
│       └── health/               # Health check
│
├── admin-stationhub/                   # React admin SPA
│   ├── src/
│   │   ├── views/                # Trang: Dashboard, Agents, Tasks, Workflows…
│   │   ├── components/           # UI, workflow editor, forms task
│   │   ├── api/                  # HTTP client modules
│   │   ├── context/              # Auth, WebSocket provider
│   │   └── lib/                  # Workflow graph, mappers, i18n
│   └── .env.example              # VITE_API_BASE_URL, VITE_WS_URL
│
├── agent/                        # Máy trạm Windows
│   ├── core/                     # stationhub-agent-native (Rust)
│   ├── desktop/                  # Electron tray + installer
│   ├── desktop-recorder/         # GUI/CLI ghi desktop
│   ├── chrome-bridge/            # Native messaging host
│   ├── chrome-extension/         # Extension Chrome
│   ├── stationhub-windows-uia/         # UI Automation helpers
│   ├── bin/                      # Binary sau build (gitignore)
│   └── docs/                     # Luồng agent, mở rộng task
│
├── prisma/
│   ├── schema.prisma             # Schema đầy đủ
│   ├── seed.ts                   # User demo, gói trial/tháng
│   └── migrations/
│       └── 20260401000000_baseline/   # Migration gộp (baseline)
│
├── docs/                         # Kiến trúc & flows chi tiết (Mermaid)
├── docker-compose.yml            # PostgreSQL, Redis, app
├── Dockerfile                    # Multi-stage build NestJS
└── .env.example                  # Biến môi trường server
```

---

## Chrome & Desktop recording (Agent)

Hai công cụ ghi **trên máy agent** (Windows), lưu JSON local rồi **đồng bộ lên server** để tạo task template / import vào workflow.

### Chrome Extension — ghi thao tác trình duyệt

Ghi lại click, nhập text, delay trên **một tab Chrome** qua extension MV3 + Native Messaging — **không dùng CDP**.

| Hạng mục | Chi tiết |
|----------|----------|
| Thành phần | `agent/chrome-extension/` (UI popup), `agent/chrome-bridge/` (`stationhub-chrome-bridge.exe`) |
| Task type | `CHROME_EXTENSION` — replay `steps[]`: `snapshotDom`, `click`, `fill`, `waitFor`, `delay` |
| Lưu local | `%ProgramData%\StationHub\chrome-scripts\{uuid}.json` |
| Admin | **Chrome scripts** → chọn agent online → **Đồng bộ từ agent** → sửa / import workflow |
| Tray agent | **Chrome scripts** → **Chạy lại** (replay local, không cần server) |

**Cài đặt (một lần trên máy agent):**

```powershell
cd agent
npm run build:chrome-bridge
npm run chrome-bridge:install    # registry Native Messaging
```

1. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `agent/chrome-extension/`
2. Trong `%ProgramData%\StationHub\agent.env`: `CHROME_EXTENSION_ENABLED=true`
3. Popup extension → **Bắt đầu ghi** → thao tác trang → **Dừng & lưu**

**Luồng ghi → chạy → đồng bộ:**

```mermaid
sequenceDiagram
  participant EXT as Chrome Extension
  participant BR as stationhub-chrome-bridge
  participant AG as stationhub-agent-native
  participant API as Server
  participant UI as Admin

  EXT->>BR: Native Messaging (bước ghi)
  BR->>AG: lưu file JSON
  Note over AG: chrome-scripts/*.json
  AG->>AG: chrome-replay (tray, local)
  UI->>API: POST /chrome-scripts/sync
  API->>AG: đọc danh sách file
  AG-->>API: metadata + nội dung
  API-->>UI: import template / workflow
```

---

### Desktop Recorder — ghi thao tác Windows

Ghi chuột, phím, delay trên desktop; tùy chọn **UI Automation (UIA)** cho click chính xác theo control.

| Hạng mục | Chi tiết |
|----------|----------|
| Thành phần | `agent/desktop-recorder/` → `stationhub-desktop-recorder.exe` (GUI egui + CLI) |
| Task type | `DESKTOP_AUTOMATION` — payload `steps[]`: `click`, `typeText`, `delay`, `openApp`, … |
| Lưu local | `%ProgramData%\StationHub\desktop-recordings\{uuid}.json` |
| Admin | **Desktop recordings** → **Đồng bộ từ agent** → tạo template / workflow |
| UIA | Mặc định bật — replay ưu tiên `InvokePattern`, fallback tọa độ vật lý (DPI-aware) |

**Build & chạy:**

```powershell
cd agent
npm run build:desktop-recorder
# GUI: double-click stationhub-desktop-recorder.exe
# CLI: stationhub-desktop-recorder.exe record --name "Mo ung dung"
# Dừng ghi: F12
```

**Chạy lại local (không qua server):**

```powershell
stationhub-desktop-recorder.exe replay C:\ProgramData\StationHub\desktop-recordings\<id>.json
# hoặc
stationhub-agent-native.exe desktop-replay <path.json>
```

Chạy qua task trên server cần `DESKTOP_AUTOMATION_ENABLED=true` trong `agent.env`.

**Luồng ghi → chạy → đồng bộ:**

```mermaid
sequenceDiagram
  participant REC as desktop-recorder
  participant FS as ProgramData StationHub
  participant AG as stationhub-agent-native
  participant API as Server
  participant UI as Admin

  REC->>FS: ghi desktop-recordings/*.json
  REC->>REC: replay local (GUI)
  AG->>FS: desktop-replay / task handler
  UI->>API: POST /desktop-recordings/sync
  API->>AG: pull bản ghi
  AG-->>API: danh sách + JSON
  API-->>UI: template DESKTOP_AUTOMATION
```

---

## Cài đặt & chạy dev

### Yêu cầu

- **Node.js** ≥ 20, npm
- **Docker** & Docker Compose (PostgreSQL + Redis local)
- **Rust toolchain** (chỉ khi build agent)
- Windows 10/11 x64 (chạy agent đầy đủ tính năng)

### 1. Clone & cài dependency server

```bash
git clone <repo-url> server_stationhub
cd server_stationhub
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Chỉnh DATABASE_URL, REDIS_*, JWT_*, CORS_ORIGINS
```

| File | Phạm vi |
|------|---------|
| `.env` (root) | Backend, DB, Redis, JWT, SePay, `PUBLIC_API_BASE_URL` |
| `admin-stationhub/.env` | `VITE_API_BASE_URL`, `VITE_WS_URL` |
| `agent/.env` | Dev agent (`SERVER_WS_URL`, `AGENT_KEY`) |
| `%ProgramData%\StationHub\agent.env` | Agent production (Windows) |

### 3. Khởi động PostgreSQL + Redis

```bash
docker compose up -d postgres redis
```

### 4. Database

```bash
# DB mới (trống)
npx prisma migrate deploy
npx prisma db seed

# Dev (tạo migration mới khi đổi schema)
npx prisma migrate dev
```

> **Lưu ý:** Repo dùng **một migration baseline** `20260401000000_baseline`. DB đã chạy migration cũ trước đó cần baseline lại — xem [Triển khai production](#triển-khai-production).

### 5. Chạy backend

```bash
npm run start:dev
# API:     http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs
# Health:  http://localhost:3000/api/health
```

### 6. Chạy admin UI

```bash
cd admin-stationhub
cp .env.example .env
npm install
npm run dev
# http://localhost:5173
```

### 7. Build & chạy agent (Windows)

```powershell
cd agent
npm install
npm run build:core          # → agent/bin/stationhub-agent-native.exe
npm run dev                 # Electron tray + spawn core
```

Tạo agent trên admin → copy **Agent Key** → nhập trong tray **Cài đặt** hoặc `agent.env`.

### Tài khoản seed

| Email | Mật khẩu | Role |
|-------|----------|------|
| admin@stationhub.com | admin123 | ADMIN |
| user@stationhub.com | user123 | USER |

---

## Triển khai production

### Docker (server)

```bash
# Build & chạy full stack (postgres + redis + app)
docker compose up -d --build
```

`Dockerfile` multi-stage: `npm ci` → `prisma generate` → `nest build` → image production chạy `node dist/main.js`.

### Admin SPA

```bash
cd admin-stationhub
npm run build
# Phục vụ thư mục dist/ qua nginx / CDN
# VITE_API_BASE_URL trỏ tới domain API production
```

### Agent Windows

```powershell
cd agent
npm run dist:desktop   # NSIS installer trong desktop/release/
npm run service:install   # Windows Service StationHubAgentNative (cần Admin)
```

Config production: `%ProgramData%\StationHub\agent.env`

### Telegram webhook

Telegram yêu cầu **HTTPS public**. Đặt trong `.env`:

```env
PUBLIC_API_BASE_URL=https://<domain-hoặc-ngrok>/api
```

Đăng ký bot tại admin **Bot** → server gọi `setWebhook` tới `/api/webhooks/telegram/{botId}/{secret}`.

### Migration baseline (DB đã tồn tại)

Nếu DB đã apply migration cũ trước khi gộp baseline:

```sql
DELETE FROM "_prisma_migrations";
```

```bash
npx prisma migrate resolve --applied 20260401000000_baseline
npx prisma migrate status   # phải: up to date
```

### Biến môi trường quan trọng

| Biến | Mô tả |
|------|--------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_*` / `REDIS_URL` | BullMQ + cache |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Bắt buộc đổi trên production |
| `CORS_ORIGINS` | Origin admin SPA |
| `PUBLIC_API_BASE_URL` | Base HTTPS cho Telegram webhook |
| `SEPAY_*` | Thanh toán VietQR |
| `TASK_WORKER_CONCURRENCY` | Số job BullMQ song song |

---

## Luồng hoạt động

### Kiến trúc tổng quan

```mermaid
flowchart TB
  subgraph Users["Người dùng"]
    U[User / Admin]
  end

  subgraph Clients["Client"]
    SPA["admin-stationhub<br/>React SPA"]
    AG["stationhub-agent-native<br/>+ Electron tray"]
    EXT["Chrome Extension"]
    REC["desktop-recorder"]
  end

  subgraph Server["NestJS Server"]
    API["REST /api"]
    WS["WebSocket<br/>/ws/agent"]
    WH["Webhook<br/>/webhooks/telegram"]
    WRK["BullMQ Workers"]
    CRON["Schedule Triggers"]
  end

  subgraph Data["Hạ tầng dữ liệu"]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end

  U --> SPA
  SPA -->|JWT REST| API
  SPA -->|socket.io client| API
  AG -->|agentKey + heartbeat| WS
  EXT -->|Native Messaging| AG
  REC -->|JSON recordings| AG
  WH --> WRK
  CRON --> WRK
  API --> PG
  API --> RD
  WS --> PG
  WRK --> RD
  WRK -->|task:execute| WS
```

### Kết nối Agent & heartbeat

```mermaid
sequenceDiagram
  participant AG as Agent (Rust)
  participant GW as AgentsGateway
  participant DB as PostgreSQL

  AG->>GW: Connect /ws/agent (agentKey, metadata)
  GW->>DB: markOnline, validate subscription
  GW-->>AG: accepted
  loop mỗi ~2s
    AG->>GW: agent:heartbeat (cpu, ram)
    GW->>DB: lastSeenAt (throttle 30s)
  end
  Note over AG,GW: Mất kết nối → markOffline → client tự reconnect
```

### Thực thi Task đơn

```mermaid
sequenceDiagram
  participant UI as Admin UI
  participant API as Tasks API
  participant Q as BullMQ
  participant GW as AgentsGateway
  participant AG as Agent

  UI->>API: POST /api/tasks (hoặc chạy template)
  API->>Q: enqueue job
  Q->>GW: dispatch task:execute
  GW->>AG: WebSocket emit
  AG->>AG: TaskHandler (COMMAND, HTTP_REQUEST, …)
  AG->>GW: task:result
  GW->>API: cập nhật status + result
  GW-->>UI: task:completed / task:failed (WS)
```

### Workflow đồ thị

> Trong sơ đồ Mermaid, biến template viết dạng `steps.ten_buoc.*` (không dùng `{{ }}` — ký tự `}` làm hỏi parser).

```mermaid
flowchart LR
  T["Trigger<br/>Manual / Schedule / Telegram"]
  W["Workflow Graph<br/>nodes + edges"]
  R[WorkflowRuntime]
  S1["Bước 1<br/>outputKey vào scope"]
  S2["Bước 2<br/>resolve steps.ten_buoc.*"]
  SN["Bước N"]

  T --> R
  W --> R
  R --> S1
  S1 -->|publishStepOutput| S2
  S2 --> SN
```

```mermaid
sequenceDiagram
  participant TR as Trigger / User
  participant RT as WorkflowRuntime
  participant AG as Agent
  participant VAR as Biến scope

  TR->>RT: startRun(workflowId)
  RT->>VAR: workflow.*, telegram.*
  RT->>AG: task bước 1
  AG-->>RT: result → steps.api.data
  RT->>VAR: merge biến steps.api.*
  RT->>AG: task bước 2 (command đã resolve template)
  RT-->>TR: WorkflowRun COMPLETED
```

### Trigger Telegram

```mermaid
sequenceDiagram
  participant TG as Telegram
  participant WH as Webhook Controller
  participant UP as TelegramUpdateService
  participant DP as TriggerDispatcher
  participant RT as WorkflowRuntime

  TG->>WH: POST /webhooks/telegram/botId/secret
  WH->>WH: verify secret
  WH->>UP: processUpdate
  UP->>UP: match triggers (commands, events)
  UP->>DP: dispatch(triggerId, userId, payload)
  DP->>RT: startRunFromTrigger
```

Xem chi tiết ghi hình và đồng bộ tại [Chrome & Desktop recording](#chrome--desktop-recording-agent).

---

## API & WebSocket

### REST (prefix `/api`)

| Module | Đường dẫn | Mô tả |
|--------|-----------|--------|
| Auth | `/auth` | register, login, refresh, logout |
| Users | `/users` | profile, admin CRUD |
| Agents | `/agents` | fleet, regenerate key |
| Tasks | `/tasks` | task + template, cancel, retry |
| Workflows | `/workflows` | CRUD, execute, graph |
| Triggers | `/triggers` | schedule, telegram; `/triggers/telegram/bots` |
| Billing | `/billing` | gói, checkout SePay |
| Chrome scripts | `/chrome-scripts` | sync, CRUD |
| Desktop recordings | `/desktop-recordings` | sync, CRUD |
| Admin | `/admin` | users, plans, audit |
| Health | `/health` | liveness |

### WebSocket

| Namespace | Client | Auth |
|-----------|--------|------|
| `/ws/agent` | `stationhub-agent-native` | `agentKey` trong handshake |
| Client events (UI) | admin SPA | JWT qua socket auth |

| Event | Hướng | Mô tả |
|-------|--------|--------|
| `agent:heartbeat` | Agent → Server | Telemetry ~2s |
| `task:execute` | Server → Agent | Payload task |
| `task:result` | Agent → Server | Kết quả thực thi |
| `task:running` / `task:completed` / `task:failed` | Server → UI | Cập nhật realtime |

Chi tiết payload: `src/common/types/ws-protocol.ts`, `src/common/constants/index.ts`.

### Biến workflow

| Prefix | Ví dụ | Nguồn |
|--------|-------|--------|
| `workflow.` | `{{workflow.API_URL}}` | Biến workflow / trigger payload |
| `steps.` | `{{steps.api.data}}` | Output bước (theo `outputKey`) |
| `prev.` | `{{prev.stdout}}` | Bước hoàn thành gần nhất |
| `telegram.` | `{{telegram.chatId}}` | Trigger Telegram |

---

## Tài liệu chi tiết

| Tài liệu | Nội dung |
|----------|----------|
| [docs/README.md](./docs/README.md) | Hub tài liệu + sơ đồ tóm tắt |
| [docs/project-memory/architecture.md](./docs/project-memory/architecture.md) | Kiến trúc container, module, ER |
| [docs/project-memory/flows.md](./docs/project-memory/flows.md) | Sequence diagram đầy đủ |
| [agent/README.md](./agent/README.md) | Build agent, Chrome, desktop recorder |
| [agent/docs/flows.md](./agent/docs/flows.md) | Luồng WS & task trên Rust |
| [admin-stationhub/README.md](./admin-stationhub/README.md) | Frontend admin |

### Scripts hữu ích

```bash
# Backend
npm run start:dev
npm run build && npm run start:prod
npm run prisma:studio

# Docker
npm run docker:up
npm run docker:down

# Agent (trong thư mục agent/)
npm run build:core
npm run build:all
npm run clean
```

### Ghi chú vận hành

- Agent cần **subscription active** mới giữ kết nối WS (heartbeat kiểm tra gói).
- `HTTP_REQUEST` chạy trên agent — gọi API nội bộ/VPN/localhost của máy agent.
- Build artifacts (`agent/**/target/`, `agent/bin/`) đã gitignore — rebuild sau khi clone.
- Log server: `LOG_LEVEL` trong `.env`; agent: `%ProgramData%\StationHub\agent.env` hoặc `RUST_LOG`.

---

**License:** UNLICENSED (private).
