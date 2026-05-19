# Luồng hoạt động (sơ đồ)

Các luồng chính giữa **admin**, **API/Nest**, **agent**, **DB/Redis**. Sự kiện socket lấy tên logic từ `src/common/constants/index.ts` và payload từ `src/common/types/ws-protocol.ts`.

---

## 1. Đăng nhập admin → gọi API có JWT

```mermaid
sequenceDiagram
  participant B as Browser (admin)
  participant API as Nest /api
  participant DB as PostgreSQL

  B->>API: POST /api/auth/login
  API->>DB: verify user
  API-->>B: access + refresh token
  B->>B: Lưu token (memory/local)
  Note over B,API: Các request sau: Authorization Bearer access JWT
```

Refresh: client gọi endpoint refresh (theo `auth` module), server cấp access mới.

---

## 2. Agent online (`/ws/agent`)

```mermaid
sequenceDiagram
  participant A as datn-agent-native Rust runner
  participant GW as AgentsGateway /ws/agent
  participant DB as PostgreSQL

  A->>GW: connect auth.agentKey + metadata
  GW->>DB: findUnique agent by agentKey
  alt invalid key
    GW-->>A: disconnect
  else ok
    GW->>DB: markOnline(...)
    GW-->>A: emit agent:status ONLINE
  end

  loop heartbeat
    A->>GW: emit agent:heartbeat
  end
```

Khi agent ngắt kết nối: gateway đánh dấu offline (logic trong `agents.gateway` / service).

---

## 3. Task: server → agent → kết quả

```mermaid
sequenceDiagram
  participant AD as Admin / API
  participant Q as BullMQ / TasksService
  participant GW as AgentsGateway
  participant AG as Rust runner tools::dispatch

  AD->>Q: Tạo / dispatch task (HTTP hoặc nội bộ)
  Q->>GW: emit task:execute tới room agent:{id}
  GW->>AG: socket event task:execute
  Note over AG: Theo type COMMAND SCRIPT SYSTEM_INFO …
  AG->>GW: emit task:result
  GW->>Q: Cập nhật DB (tasks service / processor)
```

Chi tiết dispatch nằm ở module **`tasks`** + gateway **`agents`**.

---

## 4. Phụ thuộc dữ liệu (tổng quan)

```mermaid
flowchart LR
  subgraph Clients
    AD[Admin SPA]
    AG[datn-agent-native]
  end

  subgraph Server
    API[Nest HTTP /api]
    WS1[/ws/agent]
  end

  DB[(Postgres)]
  RD[(Redis)]

  AD --> API
  AG --> WS1
  API --> DB
  WS1 --> DB
  API --> RD
```

---

Ghi chú: tên event thực tế trùng với hằng số string trong code (ví dụ `task:execute`); bảng đầy đủ xem **`code-reference.md`** phần constants.
