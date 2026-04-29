# DATN Remote Agent

Production-ready Windows agent dành cho hệ thống DATN. Kết nối tới server qua WebSocket, nhận task và thực thi lệnh PowerShell/CMD.

## Yêu cầu
- Windows 10/11 (x64)
- Node.js 20+ (chỉ cần cho build/dev; bản đóng gói exe không cần)
- Quyền Administrator (để cài service)

## Cài đặt (dev)
```powershell
cd agent
npm install
cp .env.example .env
# Sửa AGENT_KEY, SERVER_WS_URL trong .env
npm run build
```

## Lấy `AGENT_KEY`
Gọi API đăng ký agent (yêu cầu JWT hợp lệ):
```http
POST /api/agents
{
  "name": "my-workstation"
}
```
Response trả về `agentKey`, paste vào `.env`.

## Các chế độ chạy

### 1) CLI (dev/debug, không tray)
```powershell
npm run start:dev   # chạy bằng ts-node, watch-friendly
# hoặc
npm run build; npm start
```

### 2) Tray mode (debug/dev, có UI mini)
```powershell
npm run build
npm run tray:dev
```
Icon sẽ xuất hiện trong system tray. Double-click xem log, click phải để Reconnect/Quit.

### 3) Windows Service (production)
Mở **PowerShell as Administrator**:
```powershell
npm run build
npm run service:install
```

Service name: `DATN Remote Agent`  
Tự khởi động cùng Windows, tự restart khi crash.

Gỡ cài đặt:
```powershell
npm run service:uninstall
```

Xem trạng thái:
```powershell
Get-Service "datnremoteagent*"
```

## Cấu hình (`.env`)
| Biến | Mặc định | Ghi chú |
|---|---|---|
| `SERVER_WS_URL` | `ws://localhost:3000` | Đổi sang `wss://` cho prod |
| `AGENT_KEY` | — | Bắt buộc |
| `HEARTBEAT_INTERVAL_MS` | `30000` | |
| `COMMAND_TIMEOUT_MS` | `300000` | Timeout mặc định mỗi lệnh |
| `MAX_OUTPUT_BYTES` | `1000000` | Cắt output nếu vượt |
| `DEFAULT_SHELL` | `powershell` | `powershell` hoặc `cmd` |
| `LOG_LEVEL` | `info` | `trace`/`debug`/`info`/`warn`/`error` |

## Kiến trúc nội bộ
```
src/
├── config.ts              # Đọc env, expose config
├── logger.ts              # pino + pino-pretty
├── types.ts               # WS_EVENTS + payload types
├── core/
│   ├── connection-manager.ts   # socket.io-client, auto-reconnect
│   ├── heartbeat.ts            # gửi agent:heartbeat định kỳ
│   ├── command-executor.ts     # spawn PowerShell/CMD, timeout, output guard
│   └── task-runner.ts          # handle task:execute, emit task:result
├── service/
│   ├── install.ts         # cài Windows Service bằng node-windows
│   └── uninstall.ts
├── tray/
│   └── tray.ts            # Electron tray với menu & log viewer
└── main.ts                # CLI entrypoint
```

## WebSocket contract (đồng bộ với server)
- `agent:register` — tự động qua `handshake.auth.agentKey`
- `agent:heartbeat` — agent → server, mỗi `HEARTBEAT_INTERVAL_MS`
- `task:execute` — server → agent: `{ taskId, type, command, payload, timeout }`
- `task:result` — agent → server: `{ taskId, status, result, exitCode }`
- `task:progress` — agent → server (optional)
- `agent:status` — server → agent (state broadcast)

## An toàn lệnh
- Reject whitelist-style một số pattern nguy hiểm (`format C:`, `rm -rf /`, etc.) trong `command-executor.ts`.
- Timeout cứng từng task (kill SIGTERM -> SIGKILL sau 2s).
- Giới hạn output size, cắt nếu vượt.
- Process không hiện window (`windowsHide: true`).

## Triển khai production (checklist)
1. Build server và chạy bằng `wss://` (Let's Encrypt/Nginx/Cloudflare).
2. Build agent: `npm run build`.
3. Copy thư mục `agent/` (kèm `dist/`, `node_modules/`, `.env`) sang máy target.
4. Trên máy target, mở PowerShell as Admin → `npm run service:install`.
5. Kiểm tra trạng thái qua API `GET /api/agents` hoặc cổng WS log của server.
6. Smoke test: tạo task type `SYSTEM_INFO` từ client, xác nhận task chuyển `COMPLETED` trong vài giây.

## Đóng gói single-exe (tùy chọn)
Dùng `pkg`:
```powershell
npm install -g pkg
npm run package:exe
# Output: build/datn-agent.exe
```
Lưu ý: `node-windows` và Electron không đóng gói được bằng `pkg` đơn giản. Cho **service mode**, nên deploy bằng cách copy folder + chạy `npm run service:install` (đây là cách `node-windows` kỳ vọng). Cho **tray mode**, dùng `electron-builder` để tạo installer.

## Troubleshooting
- **Không kết nối được**: kiểm tra `SERVER_WS_URL`, firewall, WS endpoint server có đang bật không.
- **Agent báo disconnected liên tục**: kiểm tra `AGENT_KEY` đúng chưa, xem log server (`AgentsGateway`).
- **Service không start**: xem log `%APPDATA%\datnremoteagent\daemon\` hoặc Event Viewer → Applications.
- **Task luôn timeout**: tăng `COMMAND_TIMEOUT_MS` hoặc kiểm tra lệnh có block (đợi input) không.
