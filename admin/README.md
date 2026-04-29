# DATN Console (Admin Portal)

Ung dung web React + Vite + TypeScript: **USER** dang nhap de quan ly agent/task/workflow cua minh; **ADMIN** co them menu Nguoi dung + Audit + dashboard tong he thong.

## Environment

Tao file `.env` trong thu muc `admin/`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

(`socket.io-client` se noi toi `${VITE_WS_URL}/ws/client` — chi can origin, khong them `/ws/client` vao bien.)

## Run local

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
```

Output static nam trong `admin/dist`.

## Deploy checklist

1. Build backend truoc: `npm run build` (root project).
2. Build admin: `cd admin && npm run build`.
3. Serve `admin/dist` bang Nginx hoac CDN static hosting.
4. Set `VITE_API_BASE_URL` tro vao domain backend `/api`.
5. Set `VITE_WS_URL` tro vao namespace websocket client.
6. Confirm CORS allowlist tren backend (`CORS_ORIGINS`) co origin admin (Vite dev thuong `http://localhost:5173`).
7. Phan quyen: tai khoan **USER** cho nguoi dung cuoi; **ADMIN** cho van hanh he thong — khuyen nghi khong dung chung mat khau.

## Security notes

- Access token/refresh token duoc luu localStorage (hien tai theo luong bearer token).
- Backend da bat rate-limit cho route auth va admin mutate.
- Frontend co ErrorBoundary de tranh trang trang khi runtime error.
- Neu chuyen sang cookie auth, can bo sung CSRF strategy rieng.

## Phan quyen trong UI

| Chuc nang | USER | ADMIN |
|-----------|------|-------|
| Dashboard | Thong ke theo tai khoan (agents/tasks/workflows) | Thong ke toan he thong + bieu do |
| Agent / Task / Workflow | API tenant (`/agents`, `/tasks`, `/workflows`) | List toan cuc + API tenant cho tao task/workflow; agent list qua `/admin/agents` |
| Nguoi dung, Audit | Khong co menu; vao URL `/users` hoac `/audit` se redirect ve `/dashboard` | Day du |

USER dang ky agent: nut **Dang ky agent** — `POST /agents`. Regenerate key: `POST /agents/:id/regenerate-key` (chu so huu).

## Test quick flow

1. **USER**: dang nhap (`user@datn.com` neu da seed) — Dashboard co so lieu; tao agent, task, workflow.
2. **ADMIN**: dang nhap — day du menu; dashboard tong; Users + Audit.
3. USER mo truc tiep `/users` — tu dong ve `/dashboard`.
