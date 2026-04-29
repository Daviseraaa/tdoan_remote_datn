# Server DATN - Runbook Nhanh

## 1) Backend (root)

Thư mục: `c:\Users\trant\Documents\server_datn`

```bash
npm install
cp .env.example .env
npm run docker:up
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Lệnh hay dùng:

```bash
npm run build
npm run start:prod
npm run test
npm run test:e2e
npm run prisma:studio
npm run docker:down
```

## 2) Admin (frontend)

Thư mục: `c:\Users\trant\Documents\server_datn\admin`

```bash
npm install
cp .env.example .env
npm run dev
```

Build/preview:

```bash
npm run build
npm run preview
```

## 3) Agent

Thư mục: `c:\Users\trant\Documents\server_datn\agent`

```bash
npm install
cp .env.example .env
npm run start:dev
```

Tray/service:

```bash
npm run tray:dev
npm run build
npm run service:install
npm run service:uninstall
```

## 4) Endpoints Local Mặc Định

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Health: `http://localhost:3000/api/health`
- Admin dev (Vite): thường là `http://localhost:5173`

## 5) Quy tắc làm việc nhanh

- Luôn xác nhận đang ở đúng package trước khi chạy `npm run ...`.
- Không commit file `.env`.
- Khi debug realtime, kiểm tra cả backend logs và agent logs cùng lúc.

## 5.1) Logging modes + Telegram

Env dùng chung (backend/agent):

```bash
TELEGRAM_LOG_ENABLED=true
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
TELEGRAM_LOG_MIN_LEVEL=info
TELEGRAM_LOG_MODE=all
```

Mode:

- `TELEGRAM_LOG_MODE=all`: forward stream log theo level (`TELEGRAM_LOG_MIN_LEVEL`).
- `TELEGRAM_LOG_MODE=action`: chỉ gửi event quan trọng, bỏ stream log thường.

Danh sách action events hiện có (backend):

- `server.startup`
- `agent.connected` / `agent.disconnected`
- `admin.client.connected` / `admin.client.disconnected`
- `admin.action` (từ `AuditService.record`: add/sửa/xóa user, agent, task cancel, remote control...)
- `remote.client.connected` / `remote.client.disconnected`
- `task.dispatched` / `task.result` / `task.timeout`

Ghi chú vận hành:

- Prod nên dùng `mode=action` để tránh spam.
- Chỉ dùng `mode=all` khi cần debug ngắn hạn.
- Nếu token bot từng lộ, rotate ngay và không commit `.env`.

## 6) Benchmark realtime agent

Các env quan trọng (xem `agent/.env.example`):

- Tắt toàn bộ optimization (baseline cũ):
  ```
  REMOTE_DATACHANNEL_ENABLED=false
  REMOTE_ADAPTIVE_ENABLED=false
  REMOTE_TELEMETRY_ENABLED=false
  REMOTE_TARGET_FPS=8
  ```
- Bật adaptive + telemetry, giữ socket control:
  ```
  REMOTE_DATACHANNEL_ENABLED=false
  REMOTE_ADAPTIVE_ENABLED=true
  REMOTE_TELEMETRY_ENABLED=true
  ```
- Bật đầy đủ:
  ```
  REMOTE_DATACHANNEL_ENABLED=true
  REMOTE_ADAPTIVE_ENABLED=true
  REMOTE_TELEMETRY_ENABLED=true
  ```

Log quan trọng để theo dõi ở agent:

- `remote telemetry`: framesSent, framesDropped, captureMsAvg, convertMsAvg, effectiveFps, rttMs, packetLoss, jitterMs.
- `adaptive fps change`: thay đổi FPS tự động, kèm reason (degrade/recover).
- `control data channel open/closed`: trạng thái DataChannel.
- `control via data channel active; socket is fallback`: xác nhận đường control ưu tiên.

Tham chiếu kiến trúc: [05-realtime-architecture.md](05-realtime-architecture.md).

## 7) Benchmark H.264 pipeline (Windows-first)

Env flags mới (agent):

- Bật FFmpeg pipeline:
  ```
  REMOTE_VIDEO_PIPELINE=ffmpeg
  REMOTE_FFMPEG_PATH=ffmpeg
  REMOTE_H264_PREFERRED_ENCODER=auto
  ```
- Cố định encoder để test:
  ```
  REMOTE_H264_PREFERRED_ENCODER=nvenc
  # hoặc amf / qsv
  ```
- Dải adaptive encode:
  ```
  REMOTE_H264_MIN_BITRATE_KBPS=800
  REMOTE_H264_MAX_BITRATE_KBPS=4500
  REMOTE_H264_BITRATE_STEP_KBPS=300
  REMOTE_SCALE_MIN=0.5
  REMOTE_SCALE_MAX=1.0
  REMOTE_SCALE_STEP=0.1
  ```

Test matrix tối thiểu:

- GPU: NVIDIA, AMD, Intel, và máy không có hardware encoder.
- Mạng VPN: RTT 20/80/150ms và loss 0/2/5%.
- Mỗi case chạy ít nhất 10 phút + 1 case soak 60 phút.

Log cần quan sát:

- `remote telemetry` (thêm `effectiveBitrateKbps`, `ffmpegRestartCount`).
- `adaptive target change` (fps/bitrate/scale thay đổi).
- `ffmpeg unstable, switching to software pipeline` (auto fallback hoạt động).

Canary rollout:

1. Bật `REMOTE_VIDEO_PIPELINE=ffmpeg` cho nhóm pilot nội bộ.
2. Theo dõi 24-72h, nếu restart count cao thì giữ software.
3. Mở rộng dần theo nhóm GPU đã ổn định.

## 8) Benchmark media engine `ndc` (RTP/H264 direct)

Env tối thiểu:

```
REMOTE_MEDIA_ENGINE=ndc
REMOTE_VIDEO_PIPELINE=ffmpeg
REMOTE_FFMPEG_PATH=ffmpeg
REMOTE_H264_PREFERRED_ENCODER=auto
```

Rollback nóng:

```
REMOTE_MEDIA_ENGINE=wrtc
```

Checklist test:

- Mở phiên remote từ admin và xác nhận có video.
- Kiểm tra input control vẫn hoạt động (DataChannel ưu tiên, socket fallback).
- Theo dõi log agent:
  - `ndc state`
  - `ndc ffmpeg exited`
  - `switching ndc -> wrtc fallback`
- Kiểm tra fallback: tắt ffmpeg giữa phiên, agent phải tự hạ về `wrtc`.

## 9) Script benchmark tự động (p95 CPU/Latency/FPS)

Chạy từ thư mục `agent`:

```bash
npm run benchmark:realtime -- --durationSec 120
```

Tuỳ chọn:

- `--command "npm run start:dev"`: lệnh khởi động agent benchmark.
- `--durationSec 120`: thời lượng cho mỗi scenario.
- `--matrix default`: matrix benchmark (`wrtc-software-baseline`, `wrtc-ffmpeg`, `ndc-ffmpeg`).
- `--matrix phase2`: matrix theo profile/region (`ndc-lowlat-sg`, `ndc-balanced-jp`, `ndc-high-us`).
- `--matrix tilepatch`: so sánh tile patch bật/tắt (`wrtc-tilepatch-on` vs `wrtc-tilepatch-off`).
- `--outputDir benchmark-results`: thư mục lưu report.

Output:

- JSON: `benchmark-results/benchmark-<timestamp>.json`
- Markdown: `benchmark-results/benchmark-<timestamp>.md`

Lưu ý quan trọng:

- Script cần phiên remote live trong lúc chạy để thu `remote telemetry`; nếu không sẽ cảnh báo `No remote telemetry samples captured`.
- CPU p95 được sample theo PID tiến trình agent mỗi 1 giây (PowerShell `Get-Process`).

## 10) Phase 2 realtime controls

- Khi tạo phiên remote từ admin:
  - chọn `Quality`: `Low Latency` | `Balanced` | `High Quality`.
  - chọn `Region`: `SG` | `JP` | `US`.
- Agent gửi telemetry realtime về admin qua `remote:telemetry`.
- TURN selection backend:
  - ưu tiên `preferredRegion` user chọn,
  - fallback theo RTT report (`remote:rtt:report`),
  - fallback cuối cùng về TURN default list.
- Bật dirty-tile diff ở agent:
  - `REMOTE_TILE_DIFF_ENABLED=true`
  - `REMOTE_TILE_SIZE=64`
  - `REMOTE_TILE_DIFF_THRESHOLD=22`

## 11) Tile patch overlay (RGBA qua DataChannel)  

Agent (cần `REMOTE_MEDIA_ENGINE=wrtc`, `REMOTE_VIDEO_PIPELINE=software`):

```
REMOTE_TILE_PATCH_ENABLED=true
REMOTE_TILE_PATCH_MAX_TILES=48
REMOTE_TILE_PATCH_MAX_BYTES_PER_SEC=1500000
REMOTE_TILE_DIFF_ENABLED=true
```

Admin (`admin/.env`):

```
VITE_REMOTE_TILE_PATCH_ENABLED=true
```

Benchmark matrix so sánh bật/tắt patch:

```bash
npm run benchmark:realtime -- --matrix tilepatch --durationSec 120
```

Trong lúc chạy benchmark, mở phiên remote thật để log `remote telemetry` có `patchBytes` / `patchDropCount`.
