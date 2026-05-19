# Yêu cầu Admin Console (DATN)

Tài liệu mô tả **chức năng**, **phân quyền** và **API** mà ứng dụng `admin/` (DATN Console) gọi tới backend NestJS. Base URL REST: `VITE_API_BASE_URL` (mặc định `http://localhost:3000/api`). Mọi response thành công bọc trong `{ success, data, timestamp }` — frontend dùng `unwrap()` để lấy `data`.

WebSocket client: `${VITE_WS_URL}/ws/client` (auth: Bearer access token trong `auth` / `query`).

---

## 1. Mục tiêu sản phẩm

| Vai trò | Mục đích |
|---------|----------|
| **USER** | Đăng nhập, quản lý **agent / task / workflow thuộc tài khoản**, xem dashboard theo scope của mình. |
| **ADMIN** | Toàn bộ USER + **dashboard hệ thống**, **danh sách toàn cục** agent/task/workflow, **quản lý người dùng**, **audit log**. |

Ứng dụng **không** còn remote desktop (trang `RemoteControlPage` đã gỡ). Điều khiển máy từ xa qua **task** (command, `OPEN_APP`, `DESKTOP_AUTOMATION`, …) gửi xuống agent.

---

## 2. Phân quyền & routing UI

| Route | USER | ADMIN | Ghi chú |
|-------|------|-------|---------|
| `/login` | ✓ | ✓ | Công khai |
| `/dashboard` | ✓ | ✓ | UI khác nhau theo role |
| `/agents`, `/tasks`, `/workflows` | ✓ | ✓ | API list/detail khác (tenant vs `/admin/*`) |
| `/users`, `/audit` | ✗ (redirect `/dashboard`) | ✓ | `AdminOnlyRoute` |

**Auth:** JWT access token + refresh token (localStorage). Interceptor tự refresh khi 401.

| Hành động | Method | Endpoint | Role backend |
|-----------|--------|----------|----------------|
| Đăng nhập | `POST` | `/auth/login` | Public |
| Đăng xuất | `POST` | `/auth/logout` | Authenticated |
| Refresh token | `POST` | `/auth/refresh` | (interceptor, không gọi trực tiếp từ page) |
| Profile hiện tại | `GET` | `/users/me` | Authenticated |

Body login: `{ email, password }`. Response `data`: `{ user, accessToken, refreshToken }`.

---

## 3. Dashboard (`/dashboard`)

### 3.1 ADMIN — thống kê toàn hệ thống

**Yêu cầu:** Hiển thị số liệu users/agents/tasks/workflows, biểu đồ task 7 ngày, bảng 8 task gần nhất toàn hệ thống. Tự làm mới khi agent hoàn thành/thất bại task (WebSocket).

| Chức năng | API |
|-----------|-----|
| Thẻ thống kê + `taskTrend` | `GET /admin/stats` |
| Bảng task gần đây | `GET /admin/tasks?page=1&limit=8` |

**WebSocket:** lắng nghe `task:completed`, `task:failed` → invalidate query `['admin']`.

**Response `GET /admin/stats` (`data`):**

```ts
{
  users: { total, admins, active },
  agents: { total, online, offline, busy },
  tasks: { total, pending, running, completed, failed, cancelled },
  workflows: { total, active },
  taskTrend: Array<{ date: string; completed: number; failed: number }>
}
```

*Lưu ý:* `failed` trên stats gộp cả `FAILED` và `TIMEOUT` ở DB.

Polling: stats 15s, recent tasks 10s.

### 3.2 USER — thống kê theo tài khoản

| Chức năng | API |
|-----------|-----|
| Đếm agent / task / workflow | `GET /agents?page=1&limit=1` → `meta.total` (tương tự `/tasks`, `/workflows`) |
| Task gần đây | `GET /tasks?page=1&limit=8` |

**WebSocket:** cùng event → invalidate `['user']`, `['tasks']`, `['agents']`.

---

## 4. Agent (`/agents`)

**Yêu cầu:** Danh sách phân trang, đăng ký agent mới (nhận `agentKey`), xem chi tiết/key, regenerate key, xóa agent.

Logic path: `admin/src/lib/apiScope.ts` — `isAdmin` chọn prefix.

| Chức năng | USER | ADMIN |
|-----------|------|-------|
| Danh sách | `GET /agents?page&limit` | `GET /admin/agents?page&limit` |
| Tạo agent | `POST /agents` | `POST /agents` *(gán `userId` = JWT)* |
| Xóa | `DELETE /agents/:id` | `DELETE /admin/agents/:id` |
| Regenerate key | `POST /agents/:id/regenerate-key` | `POST /admin/agents/:id/regenerate-key` |

**Tạo agent** — body:

```json
{ "name": "string", "os?": "string", "hostname?": "string" }
```

Response trả agent kèm `agentKey` (chỉ lúc tạo/regenerate).

UI: auto-refresh list 10s; drawer hiển thị key copyable.

*Backend admin:* `DELETE` / `regenerate-key` ghi audit (`agent.delete`, `agent.regenerate_key`).

---

## 5. Task (`/tasks`)

**Yêu cầu:** Lọc theo status/type, phân trang, tạo task, xem chi tiết (result + logs), hủy task đang chạy, chạy lại task đã kết thúc.

| Chức năng | USER | ADMIN |
|-----------|------|-------|
| Danh sách | `GET /tasks?page&limit&status&type` | `GET /admin/tasks?...` (+ optional `agentId`, `userId` trên backend, UI chưa expose) |
| Chi tiết | `GET /tasks/:id` | `GET /admin/tasks/:id` |
| Tạo | `POST /tasks` | `POST /tasks` |
| Hủy | `DELETE /tasks/:id` | `DELETE /admin/tasks/:id` |
| Chạy lại | `POST /tasks/:id/retry` | `POST /admin/tasks/:id/retry` |

**Tạo task** — body (`CreateTaskDto`):

| Field | Bắt buộc | Mô tả |
|-------|----------|--------|
| `type` | ✓ | `COMMAND`, `SCRIPT`, `FILE_OPERATION`, `SYSTEM_INFO`, `OPEN_APP`, `DESKTOP_AUTOMATION` |
| `agentId` | ✓ | UUID agent |
| `command` | ✓ | Lệnh shell, đường dẫn app, hoặc JSON kịch bản automation |
| `timeout` | | ms, mặc định form 60000, backend min 5000 |
| `payload` | | JSON bổ sung (UI chưa có field riêng) |
| `priority` | | 0–10 |

**UI logic:**

- Task `COMPLETED` \| `FAILED` \| `TIMEOUT` \| `CANCELLED` → nút **Chạy lại** (`retry`).
- Các status khác → nút **Hủy** (`DELETE`).
- Picker agent: `GET` list agents (cùng scope admin/tenant), `limit=100`.
- Detail drawer poll 3s khi mở.

*Tham chiếu automation:* `agent/docs/user-simulation.md` cho `DESKTOP_AUTOMATION`.

*Admin cancel/retry:* audit `task.cancel`, `task.retry`.

---

## 6. Workflow (`/workflows`)

**Yêu cầu:** CRUD workflow nhiều bước, bật/tắt active, cron (lưu trên DB), chạy thủ công.

| Chức năng | List API | Mutate API |
|-----------|----------|------------|
| Danh sách | `GET /workflows` hoặc `GET /admin/workflows` | — |
| Tạo | | `POST /workflows` |
| Sửa | | `PATCH /workflows/:id` |
| Xóa | | `DELETE /workflows/:id` |
| Chạy ngay | | `POST /workflows/:id/execute` |

**Body tạo/sửa (UI):**

```json
{
  "name": "string",
  "description?": "string",
  "cronExpression?": "string",
  "isActive": true,
  "steps": [
    {
      "order": 1,
      "type": "COMMAND|SCRIPT|DELAY|CONDITION",
      "config": { },
      "onFailure": "STOP|SKIP|RETRY"
    }
  ]
}
```

`config` mỗi step là object JSON (form nhập string rồi parse).

*Lưu ý:* Admin chỉ dùng `/admin/workflows` cho **đọc danh sách toàn hệ thống**; create/update/delete/execute vẫn qua `/workflows/*` (workflow gắn `userId` người tạo).

---

## 7. Người dùng (`/users`) — ADMIN only

**Yêu cầu:** Danh sách user, tạo, sửa tên/role, bật/tắt active, xóa.

| Chức năng | Method | Endpoint | Ghi chú |
|-----------|--------|----------|---------|
| Danh sách | `GET` | `/users?page&limit` | Cần quyền admin trên backend |
| Tạo | `POST` | `/admin/users` | `{ email, password, name, role? }` |
| Sửa | `PATCH` | `/admin/users/:id` | UI: `{ name, role }` |
| Toggle active | `PATCH` | `/users/:id/toggle-active` | |
| Xóa | `DELETE` | `/users/:id` | |

Tạo user ghi audit `user.create`; patch admin ghi `user.update`.

---

## 8. Audit log (`/audit`) — ADMIN only

**Yêu cầu:** Xem nhật ký hành động quản trị, lọc email actor và action.

| Chức năng | API |
|-----------|-----|
| Danh sách | `GET /admin/audit-logs?page&limit&actor&action` |

Query `actor`: email (partial match tùy backend `AuditService`). `action`: ví dụ `user.create`, `agent.delete`, `task.cancel`, `workflow.execute`, …

Rate limit backend: 40 req/phút.

---

## 9. Bảng tổng hợp API theo module backend

| Prefix | Controller | Role guard | Dùng bởi Console |
|--------|------------|------------|------------------|
| `/auth/*` | `auth.controller` | Public / JWT | Login, logout, refresh |
| `/users/*` | `users.controller` | JWT (+ admin cho list) | `/users/me`, Users page |
| `/agents/*` | `agents.controller` | JWT (tenant) | Agent CRUD tenant, tạo agent |
| `/admin/*` | `admin.controller` | **ADMIN** | Stats, list global, user create/patch, audit |
| `/tasks/*` | `tasks.controller` | JWT (tenant) | Task CRUD + retry |
| `/workflows/*` | `automation.controller` | JWT (tenant) | Workflow CRUD + execute |

Swagger tag: `Admin` — các route dưới `/admin` yêu cầu `Role.ADMIN` + `Authorization: Bearer`.

---

## 10. WebSocket (client)

| Event | Hành vi UI |
|-------|------------|
| `task:completed` | Invalidate cache dashboard / tasks |
| `task:failed` | Giống trên |

Kết nối: `socket.io` namespace `/ws/client`, token từ `getAccessToken()`.

---

## 11. Biến môi trường & triển khai

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

Backend `CORS_ORIGINS` phải chứa origin admin (dev: `http://localhost:5173`).

---

## 12. Khoảng trống / hành vi cần biết

1. **USER không vào được `/users`, `/audit`** — redirect, không gọi API.
2. **ADMIN tạo task/workflow/agent** vẫn dùng endpoint tenant (`POST /tasks`, …) — dữ liệu thuộc admin user, không “thay mặt” user khác trừ khi backend hỗ trợ `userId` (task list admin có filter `userId`, UI chưa có).
3. **Remote control** không còn trong admin; không có API WebRTC trong scope tài liệu này.
4. Response lỗi: frontend `apiErrorMessage()` hiển thị message từ backend.

---

## 13. File tham chiếu mã nguồn

| Thành phần | Đường dẫn |
|------------|-----------|
| Routes | `admin/src/App.tsx` |
| API scope admin vs tenant | `admin/src/lib/apiScope.ts` |
| Backend admin | `src/modules/admin/admin.controller.ts` |
| Trang UI | `admin/src/pages/*.tsx` |
