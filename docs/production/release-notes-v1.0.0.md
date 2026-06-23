# StationHub v1.0.0 — Windows

Bản phát hành đầu tiên của bộ công cụ máy trạm StationHub cho Windows 10/11 (64-bit).

**Server mặc định:** `wss://api.stationhub.io.vn`

---

## Tệp tải về

| Tệp | Mô tả |
|-----|--------|
| `StationHub-Agent-Setup-1.0.0.exe` | Installer Agent (tray app + core Rust + cloak runner) |
| `StationHub-Desktop-Recorder-1.0.0.zip` | Gói Desktop Recorder + `Cai-dat.bat` (khuyến nghị — đủ chức năng **Chạy lại**) |
| `stationhub-desktop-recorder-1.0.0.exe` | Bản portable — chỉ ghi bản; **Chạy lại** cần cài qua zip hoặc Agent |
| `StationHub-Chrome-Recorder-1.0.0.zip` | Gói Native Messaging + extension Chrome |

---

## Yêu cầu hệ thống

- Windows 10 hoặc 11, 64-bit
- Kết nối Internet tới server StationHub
- Google Chrome (cho ghi thao tác trình duyệt)
- **Agent Key** và quyền truy cập console (lấy từ admin StationHub)

---

## 1. Cài đặt Agent

1. Tải và chạy `StationHub-Agent-Setup-1.0.0.exe`.
2. Làm theo wizard cài đặt.
3. Mở **StationHub Agent** từ khay hệ thống (system tray).
4. Nhập **Server URL** và **Agent Key** → **Lưu**.
5. Kiểm tra agent **ONLINE** trên console.

Agent bao gồm core Rust (`stationhub-agent-native`), panel điều khiển Electron và cloak runner (Playwright).

---

## 2. Ghi thao tác Desktop (tùy chọn)

Công cụ ghi click/phím trên Windows (UI Automation). Kết quả đồng bộ lên console qua agent online.

### Khuyến nghị — gói ZIP

1. Giải nén `StationHub-Desktop-Recorder-1.0.0.zip`.
2. Chạy **`Cai-dat.bat`** (quyền user thường).
   - Copy `stationhub-desktop-recorder.exe` và `stationhub-agent-native.exe` vào `C:\ProgramData\StationHub\bin\`
   - **Lưu ý:** thư mục `bin` nằm trong ProgramData, **không** xuất hiện cạnh file zip.
3. Mở Desktop Recorder từ:
   ```
   C:\ProgramData\StationHub\bin\stationhub-desktop-recorder.exe
   ```
   (có thể tạo shortcut Desktop).
4. Console → **Desktop recordings** → chọn agent online → **Đồng bộ từ agent**.

Bản ghi lưu tại: `C:\ProgramData\StationHub\desktop-recordings\`

Cấu trúc gói ZIP:

```
StationHub-Desktop-Recorder-1.0.0/
├── Cai-dat.bat
├── stationhub-desktop-recorder.exe
└── stationhub-agent-native.exe    # cần cho «Chạy lại»
```

### Bản portable (`.exe` đơn)

Chạy trực tiếp `stationhub-desktop-recorder-1.0.0.exe` để ghi — không cần `Cai-dat.bat`. Chức năng **Chạy lại** trên máy vẫn cần `stationhub-agent-native.exe` (từ zip hoặc đã cài Agent).

---

## 3. Ghi thao tác Chrome

Extension **StationHub Agent Bridge** chưa có trên Chrome Web Store (v1.0.0). Cài **thủ công** từ thư mục `extension/` trong gói ZIP.

**Extension ID cố định:** `hdbeonmlkpnbnimjdnbpgcpmomjdiplg` (manifest có `key` — phải khớp với registry Native Messaging).

### Cài đặt (theo thứ tự)

1. Giải nén `StationHub-Chrome-Recorder-1.0.0.zip`.
2. Chạy **`Cai-dat.bat`** (quyền user thường).
   - Copy `stationhub-chrome-bridge.exe` vào `C:\ProgramData\StationHub\bin\`
   - Tạo manifest tại `C:\ProgramData\StationHub\chrome-bridge\`
   - Ghi registry `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.stationhub.chrome_bridge`
3. **Tự mở Chrome** → gõ `chrome://extensions` trên thanh địa chỉ.
4. Bật **Chế độ nhà phát triển** (Developer mode).
5. **Tải extension đã giải nén** (Load unpacked) → chọn thư mục `extension\` trong gói vừa giải nén.
6. **Tắt Chrome hẳn** (chuột phải icon Chrome trên taskbar → **Thoát**), rồi mở lại.
7. Mở **StationHub Agent** (tray) → **Cài đặt** → bật **Chrome extension bridge** (`CHROME_EXTENSION_ENABLED=true`).
8. Mở popup extension → kiểm tra trạng thái kết nối bridge.

> **Lưu ý:** Mỗi máy phải chạy `Cai-dat.bat` và Load unpacked. Chrome có thể cảnh báo extension “không từ Chrome Web Store” — bình thường với bản sideload.

> **Đóng Chrome hoàn toàn rồi mở lại** sau bước 5 nếu extension báo lỗi Native Messaging (`Native host has exited`).

Cấu trúc gói ZIP:

```
StationHub-Chrome-Recorder-1.0.0/
├── Cai-dat.bat
├── stationhub-chrome-bridge.exe
└── extension/          # Load unpacked tại đây
```

### Khi lên Chrome Web Store (tương lai)

Sau khi publish, người dùng cài extension từ Store; **vẫn phải chạy `Cai-dat.bat`** trên từng máy (Native Messaging host không đi kèm extension Store).

---

## Thay đổi chính (v1.0.0)

- Agent Windows đầu tiên: tray app, kết nối WebSocket production, heartbeat, thực thi task.
- Desktop recorder: ghi UIA, highlight element, xuất workflow, đồng bộ qua agent.
- Chrome bridge: Native Messaging host + extension MV3 (`scripting`, `activeTab`, DOM bridge).
- Installer NSIS một click; Desktop/Chrome recorder cài qua gói zip + `Cai-dat.bat`.
- Server production: `wss://api.stationhub.io.vn`, phiên bản agent `1.0.0`.

---

## Gỡ cài đặt

| Thành phần | Cách gỡ |
|------------|---------|
| Agent | **Settings → Apps → StationHub Agent → Uninstall** |
| Chrome bridge | Gỡ extension trong `chrome://extensions`; xóa `C:\ProgramData\StationHub\` (hoặc chỉ `bin\`, `chrome-bridge\` và key registry `com.stationhub.chrome_bridge`) |
| Desktop recorder | Xóa shortcut; file trong `C:\ProgramData\StationHub\bin\` nếu đã chạy `Cai-dat.bat`; bản portable — xóa file `.exe` |
| Extension Chrome | Gỡ trong `chrome://extensions` |

---

## Hỗ trợ

- Trang web: [stationhub.io.vn](https://stationhub.io.vn)
- Console: [app.stationhub.io.vn](https://app.stationhub.io.vn)
- Liên hệ qua kênh Telegram/Zalo trên trang landing

---

*Phát hành: 13/06/2026*
