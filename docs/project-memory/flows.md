# Luồng hoạt động (sơ đồ)

Các luồng chính giữa **admin**, **API/Nest**, **agent**, **DB/Redis**. Tên event socket: `src/common/constants/index.ts`, payload: `src/common/types/ws-protocol.ts`.

> **Xem sơ đồ:** GitHub/GitLab preview, VS Code extension *Mermaid*, hoặc trang `/docs` trong admin.

---

## Mục lục luồng

| # | Luồng | Loại sơ đồ |
|---|--------|------------|
| 1 | [Đăng nhập admin](#1-đăng-nhập-admin--jwt) | Sequence |
| 2 | [Agent online](#2-agent-online-wsagent) | Sequence |
| 3 | [Task dispatch](#3-task-server--agent--kết-quả) | Sequence |
| 4 | [Trạng thái task](#4-trạng-thái-task) | State |
| 5 | [Chạy workflow thủ công](#5-chạy-workflow-thủ-công) | Sequence |
| 6 | [Trigger lịch](#6-trigger-lịch-schedule) | Flowchart |
| 7 | [Trigger Telegram](#7-trigger-telegram) | Sequence |
| 8 | [Sync Chrome script](#8-đồng-bộ-chrome-script-từ-agent) | Sequence |
| 9 | [Sync desktop recording](#9-đồng-bộ-desktop-recording) | Sequence |
| 10 | [Task template → task](#10-task-template--tạo-task) | Flowchart |
| 11 | [Phụ thuộc tổng quan](#11-phụ-thuộc-dữ-liệu-tổng-quan) | Flowchart |

---

## 1. Đăng nhập admin → JWT

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (admin-datn)
  participant API as Nest /api/auth
  participant DB as PostgreSQL

  B->>API: POST /api/auth/login { email, password }
  API->>DB: verify User + hash password
  alt sai thông tin
    API-->>B: 401 Unauthorized
  else hợp lệ
    API-->>B: accessToken + refreshToken
    B->>B: Lưu token (localStorage / memory)
  end

  Note over B,API: Request sau: Header Authorization Bearer accessToken

  B->>API: POST /api/auth/refresh (khi access hết hạn)
  API-->>B: accessToken mới
```

---

## 2. Agent online (`/ws/agent`)

```mermaid
sequenceDiagram
  autonumber
  participant A as datn-agent-native
  participant GW as AgentsGateway
  participant DB as PostgreSQL

  A->>GW: connect + auth { agentKey, metadata }
  GW->>DB: Agent.findUnique(agentKey)
  alt key không hợp lệ
    GW-->>A: disconnect
  else ok
    GW->>DB: status ONLINE, lastSeenAt
    GW-->>A: agent:status ONLINE
  end

  loop mỗi ~30s
    A->>GW: agent:heartbeat
    GW->>DB: cập nhật lastSeenAt
  end

  Note over A,GW: Ngắt kết nối → mark OFFLINE
```

---

## 3. Task: server → agent → kết quả

```mermaid
sequenceDiagram
  autonumber
  participant UI as Admin / API client
  participant TS as TasksService
  participant Q as BullMQ Queue
  participant GW as AgentsGateway
  participant AG as Agent dispatch
  participant DB as PostgreSQL

  UI->>TS: POST /api/tasks (type, payload, agentId)
  TS->>DB: Task PENDING / QUEUED
  TS->>Q: add job dispatch
  Q->>GW: emit task:execute → room agent:{id}
  GW->>AG: WebSocket event
  Note over AG: COMMAND · SCRIPT · DESKTOP_AUTOMATION · CHROME_EXTENSION …
  AG->>GW: task:result { status, output, logs }
  GW->>TS: handler cập nhật
  TS->>DB: COMPLETED / FAILED / TIMEOUT
  UI->>TS: GET /api/tasks/:id (poll hoặc refresh)
  TS-->>UI: task + logs
```

---

## 4. Trạng thái task

```mermaid
stateDiagram-v2
  [*] --> PENDING: tạo task
  PENDING --> QUEUED: vào hàng đợi
  QUEUED --> RUNNING: agent nhận execute
  RUNNING --> COMPLETED: thành công
  RUNNING --> FAILED: lỗi
  RUNNING --> TIMEOUT: quá hạn
  PENDING --> CANCELLED: hủy
  QUEUED --> CANCELLED: hủy
  RUNNING --> CANCELLED: hủy
  COMPLETED --> [*]
  FAILED --> [*]
  TIMEOUT --> [*]
  CANCELLED --> [*]
```

---

## 5. Chạy workflow thủ công

Admin bấm **Chạy** trên `WorkflowEditor` → `POST /api/workflows/:id/execute`.

```mermaid
sequenceDiagram
  autonumber
  participant UI as WorkflowEditor
  participant API as AutomationController
  participant RT as WorkflowRuntimeService
  participant TS as TasksService
  participant GW as AgentsGateway
  participant AG as Agent
  participant DB as PostgreSQL

  UI->>API: POST /workflows/:id/execute
  API->>RT: startRun(workflowId)
  RT->>DB: WorkflowRun RUNNING
  loop từng WorkflowStep (graph-scheduler)
    RT->>RT: resolve biến / branch
    alt StepType COMMAND hoặc SCRIPT
      RT->>TS: tạo Task + enqueue
      TS->>GW: task:execute
      GW->>AG: thực thi
      AG->>GW: task:result
      TS->>DB: WorkflowStepRun + Task
    else StepType TELEGRAM / DELAY / CONDITION
      RT->>RT: xử lý trong runtime (telegram, delay, nhánh)
    end
    RT->>DB: WorkflowStepRun
  end
  RT->>DB: WorkflowRun COMPLETED / FAILED
  API-->>UI: executionResult + runStatusByStepId
```

---

## 6. Trigger lịch (SCHEDULE)

```mermaid
flowchart TB
  subgraph Scheduler
    CRON["@nestjs/schedule / cron"]
    TRS[TriggersService]
  end

  subgraph Runtime
    RT[WorkflowRuntimeService]
  end

  CRON -->|"đến giờ (cron/daily/interval)"| TRS
  TRS -->|"enabled + workflow active"| RT
  RT -->|"startRun(triggerId, SCHEDULE)"| DB[(WorkflowRun)]
  RT --> Tasks[TasksService / agents]
```

Điều kiện: `WorkflowTrigger.enabled`, `Workflow.isActive`, `scheduleKind` + `cronExpression` / `intervalSeconds` / `dailyHour`.

---

## 7. Trigger Telegram

```mermaid
sequenceDiagram
  autonumber
  participant TG as Telegram Bot API
  participant API as Nest webhook
  participant TR as TriggersService
  participant RT as WorkflowRuntimeService
  participant TS as TasksService

  TG->>API: webhook update (message / command)
  API->>TR: match bot + matchConfig
  alt khớp trigger
    TR->>RT: execute workflow
    RT->>TS: các bước task
    RT->>TR: TelegramWorkflowProgress (tin nhắn tiến độ)
    TR->>TG: gửi phản hồi
  else không khớp
    API-->>TG: bỏ qua / log
  end
```

---

## 8. Đồng bộ Chrome script từ agent

```mermaid
sequenceDiagram
  autonumber
  participant UI as ChromeScripts view
  participant API as ChromeScriptsController
  participant SVC as ChromeScriptsService
  participant AG as Agent + Extension
  participant DB as PostgreSQL

  UI->>API: POST /api/chrome-scripts/sync { agentId }
  API->>GW: AgentsGateway.syncChromeScripts
  GW->>AG: WS agent:chrome-scripts:sync
  AG-->>GW: agent:chrome-scripts:result
  GW->>SVC: upsert danh sách script
  loop từng script
    SVC->>DB: find by userId + agentId + localId
    alt đã có
      SVC->>DB: update
    else mới
      SVC->>DB: insert
    end
  end
  API-->>UI: { inserted, updated, skipped, total }
```

Admin có thể **import** script vào workflow graph (`WfChromeScriptImport`).

---

## 9. Đồng bộ desktop recording

```mermaid
sequenceDiagram
  autonumber
  participant UI as DesktopRecordings view
  participant API as DesktopRecordingsController
  participant GW as AgentsGateway
  participant SVC as DesktopRecordingsService
  participant AG as Agent
  participant DB as PostgreSQL

  UI->>API: POST /api/desktop-recordings/sync { agentId }
  API->>GW: syncDesktopRecordings
  GW->>AG: WS agent:desktop-recordings:sync
  AG-->>GW: agent:desktop-recordings:result
  GW->>SVC: upsert
  SVC->>DB: theo userId + agentId + localId
  API-->>UI: sync summary
```

Tương tự chrome: import vào workflow hoặc **tạo task template** từ recording.

---

## 10. Task template → tạo task

```mermaid
flowchart LR
  subgraph Admin
    WIZ[TaskTemplateEditor wizard]
    TLIST[Tasks / Run template]
  end

  subgraph API
    TS[tasks module<br/>/api/tasks/templates]
  end

  WIZ -->|"POST/PATCH /api/tasks/templates"| TS
  TS --> DB[(TaskTemplate)]
  TLIST -->|"POST /api/tasks/templates/:id/run"| TS
  TS --> Q[BullMQ]
  Q --> AG[Agent]
```

Payload template hỗ trợ: `DESKTOP_AUTOMATION`, `CHROME_EXTENSION`, `SCREEN_CAPTURE`, …

---

## 11. Phụ thuộc dữ liệu (tổng quan)

```mermaid
flowchart TB
  subgraph Clients
    AD[Admin SPA]
    AG[datn-agent-native]
    TG[Telegram]
  end

  subgraph Server
    API[Nest HTTP /api]
    WS[/ws/agent AgentsGateway]
    RT[WorkflowRuntime]
    SCH[Schedule / Triggers]
  end

  DB[(PostgreSQL)]
  RD[(Redis BullMQ)]

  AD --> API
  AG --> WS
  TG --> API
  API --> DB
  WS --> DB
  API --> RD
  SCH --> RT
  RT --> API
  RT --> WS
```

---

## 12. Luồng UI — Workflows (admin)

```mermaid
flowchart LR
  LIST[WorkflowListSidebar]
  ED[WorkflowEditor React Flow]
  PAL[WorkflowNodePalette]
  INS[StepInspector]

  LIST -->|chọn workflow| ED
  PAL -->|thêm node| ED
  ED -->|chọn node/edge| INS
  ED -->|Save| API[PATCH workflow]
  ED -->|Run| API2[POST execute]
```

Mobile: list overlay → tap canvas ẩn list; desktop: ẩn list khi focus editor, nút **Mở danh sách workflow** mở lại.

---

## Bảng event WebSocket

### Namespace `/ws/agent` (agent)

| Event | Hướng | Mô tả |
|-------|--------|--------|
| `agent:register` | Agent → Server | Đăng ký metadata lúc connect |
| `agent:heartbeat` | Agent → Server | Giữ online |
| `agent:telemetry` | Agent → Server | CPU/RAM, … |
| `agent:status` | Server → Agent | Trạng thái |
| `task:execute` | Server → Agent | Lệnh thực thi |
| `task:result` | Agent → Server | Kết quả |
| `task:progress` | Agent → Server | Tiến độ (nếu có) |
| `agent:chrome-scripts:sync` / `:result` | ↔ | Đồng bộ script |
| `agent:desktop-recordings:sync` / `:result` | ↔ | Đồng bộ recording |
| `agent:chrome-profiles:sync` / `:result` | ↔ | Đồng bộ profile Chrome |

### Namespace `/ws/client` (admin UI)

| Event | Hướng | Mô tả |
|-------|--------|--------|
| `task:completed` | Server → Browser | Thông báo task xong (UI refresh) |
| `task:failed` | Server → Browser | Task lỗi |

Nguồn: **`src/common/constants/index.ts`** (`WS_EVENTS`), payload: **`src/common/types/ws-protocol.ts`**.

---

## Tài liệu liên quan

- [architecture.md](./architecture.md) — sơ đồ kiến trúc container & module
- [code-reference.md](./code-reference.md) — đường dẫn file implementation
