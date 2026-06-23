# Hướng dẫn cài đặt StationHub Agent (người dùng cuối)

Tài liệu dành cho người dùng cài agent trên **Windows 10/11 (64-bit)** — không cần biết lập trình.

---

## 1. Chuẩn bị

### Yêu cầu

| Hạng mục | Chi tiết |
|----------|----------|
| Hệ điều hành | Windows 10 hoặc 11, bản 64-bit |
| Mạng | Máy truy cập được server StationHub (LAN hoặc Internet) |
| Quyền | Cài app: quyền user thường. Cài **Windows Service**: cần **Administrator** |
| Tài khoản StationHub | Đăng nhập console web để lấy **Agent Key** (xem mục 2) |

### File cài đặt

Admin/IT cung cấp file:

```
StationHub Agent Setup x.x.x.exe
```

(hoặc tên tương tự, build từ installer NSIS)

---

## 2. Lấy Agent Key trên console

Agent Key là mã bí mật để máy bạn kết nối với server. **Không chia sẻ** cho người ngoài tổ chức.

1. Đăng nhập **StationHub Console** (trang admin).
2. Vào **Agent Fleet** → **Đăng ký Agent mới**.
3. Đặt tên dễ nhận biết (vd. *Máy kế toán — Lan*).
4. Sao chép **Agent Key** (UUID) — chỉ hiện một lần khi tạo; nếu mất, admin có thể **Tạo lại key** trên console.

Bạn cũng cần biết **địa chỉ server**, ví dụ:

```
wss://your-server.example.com
```

(hoặc `ws://...` nếu môi trường nội bộ HTTP)

---

## 3. Cài đặt từ file `.exe`

1. **Double-click** `StationHub Agent Setup x.x.x.exe`.
2. Nếu Windows SmartScreen cảnh báo: chọn **More info** → **Run anyway** (file chưa ký code — bình thường với bản nội bộ).
3. Trình cài hỏi thư mục cài — mặc định thường là:
   ```
   C:\Users\<TênBạn>\AppData\Local\Programs\StationHub Agent\
   ```
   Có thể đổi thư mục nếu IT yêu cầu.
4. Bấm **Install** → chờ hoàn tất → **Finish**.
5. Ứng dụng thường **tự chạy** sau khi cài; nếu không, mở **StationHub Agent** từ Start Menu.

Sau khi cài, icon **StationHub Agent** nằm ở **khay hệ thống** (góc phải taskbar, có thể cần bấm mũi tên `^` để xem).

---

## 4. Cấu hình lần đầu

### Mở Cài đặt

1. **Click phải** icon StationHub Agent trên khay hệ thống.
2. Chọn **Cài đặt…**

### Điền thông tin bắt buộc

| Trường | Giá trị |
|--------|---------|
| **Server URL** | Địa chỉ WebSocket server (vd. `wss://your-server.example.com`) |
| **Agent Key** | Mã UUID nhận từ console (mục 2) |

Các tùy chọn khác (desktop automation, Chrome extension…) **để mặc định** trừ khi admin hướng dẫn bật.

3. Bấm **Lưu** — app ghi cấu hình và **khởi động lại agent** tự động.

Cấu hình được lưu tại:

```
C:\ProgramData\StationHub\agent.env
```

(File dùng chung cho toàn máy; chỉ admin/IT nên sửa tay.)

### Kiểm tra đã kết nối

**Cách 1 — Tray**

- Click phải icon → dòng **Agent: Rust (đang chạy)** và **Server: …** hiển thị đúng.

**Cách 2 — Console web**

- Vào **Agent Fleet** → agent của bạn hiển thị trạng thái **ONLINE**.

**Cách 3 — Xem log**

- Tray → **Show Logs**; double-click icon → **Cài đặt**.
- Tìm dòng tương tự: `Socket.IO: kết nối THÀNH CÔNG`.

Nếu **THẤT BẠI**: kiểm tra lại URL server, Agent Key, firewall, proxy.

---

## 5. Các thao tác thường dùng (menu tray)

Click phải icon khay hệ thống:

| Mục | Việc làm |
|-----|----------|
| **Cài đặt…** | Sửa server, Agent Key, bật/tắt tính năng |
| **Khởi động lại agent** | Restart kết nối / core |
| **Show Logs** | Xem log gần đây |
| **Mở thư mục config** | Mở `C:\ProgramData\StationHub\` |
| **Chrome scripts** | Chạy lại script Chrome đã ghi (nếu dùng extension) |
| **Cài Windows Service** | Chạy agent nền khi boot (cần Admin) |
| **Gỡ Windows Service** | Gỡ service nền |
| **Quit** | Thoát app tray (agent dừng) |

---

## 6. (Tuỳ chọn) Bật Wake-on-LAN (WoL)

WoL cho phép **bật máy từ xa** khi đang tắt hẳn (Shutdown). Admin bấm **Bật máy (WoL)** trên console StationHub; server gửi magic packet tới card mạng của máy bạn.

**WoL không thay đăng nhập Windows** — sau khi máy boot, vẫn cần RDP hoặc vào máy trực tiếp để đăng nhập.

### 6.1. Điều kiện

| Yêu cầu | Ghi chú |
|---------|---------|
| Agent đã cài & **online ít nhất một lần** | Console lưu MAC và broadcast subnet |
| Máy **tắt hẳn** (Shutdown), không chỉ Sleep | Sleep dùng cơ chế khác |
| **Ethernet** (cắm dây) | Wi‑Fi WoL thường không ổn định |
| Server StationHub **cùng mạng LAN** với máy agent | Hoặc router forward UDP port 9 |

### 6.2. Bật WoL trong BIOS / UEFI

Tên menu khác nhau theo hãng (ASUS, Dell, HP, Lenovo…). Vào BIOS khi khởi động (thường **F2**, **Del**, **F12**).

Tìm và **bật** một trong các mục:

- **Wake on LAN** / **WoL**
- **Power On By PCI-E** / **PME Event Wake Up**
- **ErP** — nên **tắt** nếu BIOS có (ErP có thể chặn WoL)

Lưu (**F10**) và thoát.

### 6.3. Bật WoL trên Windows (card mạng)

1. **Win + X** → **Device Manager** (Trình quản lý thiết bị).
2. Mở **Network adapters** → click phải card **Ethernet** (không chọn Bluetooth / Virtual).
3. **Properties** → tab **Power Management** (Quản lý nguồn):
   - Bật **Allow this device to wake the computer**
   - Bật **Only allow a magic packet to wake the computer** (nếu có).
4. Tab **Advanced** (Nâng cao) — nếu có:
   - **Wake on Magic Packet** → **Enabled**
   - **Wake on Pattern Match** → **Enabled** (tuỳ driver)

Lặp lại cho **Wi‑Fi** chỉ khi IT xác nhận dùng Wi‑Fi WoL.

### 6.4. Tắt Fast Startup (khuyến nghị)

Fast Startup có thể làm WoL không hoạt động sau Shutdown.

1. **Control Panel** → **Power Options** → **Choose what the power buttons do**.
2. **Change settings that are currently unavailable**.
3. Bỏ chọn **Turn on fast startup** → **Save changes**.

### 6.5. Kiểm tra trên console StationHub

1. Đảm bảo agent **ONLINE** (mục 4).
2. **Agent Fleet** → chọn máy → mở chi tiết.
3. Phần **Truy cập từ xa (WoL / RDP)**:
   - **MAC Wake-on-LAN** — có địa chỉ MAC (vd. `2C:33:58:5E:E3:8B`).
   - **Broadcast subnet** — có dạng `192.168.x.255`.
   - **Card mạng** — bấm card đúng nếu cần đổi MAC → **Lưu cấu hình**.

Nếu MAC/broadcast trống: tray → **Khởi động lại agent**, đợi vài giây, refresh trang console.

### 6.6. Admin bật máy từ xa

1. Trên console, khi agent **OFFLINE** (máy đã tắt).
2. Mở agent → **Bật máy (WoL)**.
3. Đợi **1–3 phút** — máy boot; agent có thể **ONLINE** (nhất là khi đã cài **Windows Service**, mục 7).

Nếu không lên: kiểm tra mục 6.2–6.4, thử cắm dây Ethernet, nhờ IT kiểm tra server cùng subnet.

### 6.7. Gợi ý kết hợp (IT)

| Mục tiêu | Cấu hình |
|----------|----------|
| Bật máy từ xa + agent online sớm | WoL (mục 6) + **Windows Service** (mục 7) |
| Automation desktop (chuột, recorder) | User **đăng nhập Windows** + tray chạy |

---

## 7. (Tuỳ chọn) Chạy nền với Windows Service

Dùng khi cần agent **online sớm** (trước khi mở tray), ví dụ nhận task headless hoặc sau **WoL** (mục 6).

1. **Click phải** icon tray → **Cài Windows Service**.
2. Chấp nhận UAC (quyền Administrator).
3. Thông báo *Đã cài và start StationHubAgentNative*.

Service tên **`StationHubAgentNative`**, tự start khi Windows boot.

**Lưu ý quan trọng**

- Service chạy **Session 0** — task **chuột/phím desktop, recorder** cần user đăng nhập + tray, không chỉ service.
- Nếu vừa cài service vừa mở tray, có thể **trùng 2 agent** cùng key → chỉ nên dùng **một** trong hai, trừ khi IT cấu hình riêng.

Gỡ service: tray → **Gỡ Windows Service** (hoặc xem mục 12).

---

## 8. Cài Desktop Recorder (gói zip)

Dùng khi cần **ghi thao tác chuột/phím trên Windows** và đồng bộ lên console — **không bắt buộc** cài StationHub Agent tray (nhưng nên cài Agent nếu chạy task từ server).

### File cần có

Admin/IT cung cấp:

```
StationHub-Desktop-Recorder-x.x.x.zip
```

Giải nén đầy đủ; trong thư mục phải có:

| File | Vai trò |
|------|---------|
| `Cai-dat.bat` | Script cài đặt (chạy một lần) |
| `stationhub-desktop-recorder.exe` | Ứng dụng ghi desktop |
| `stationhub-agent-native.exe` | Hỗ trợ chức năng **Chạy lại** bản ghi |

### Cài đặt

1. Giải nén zip vào một thư mục (vd. `Downloads\StationHub-Desktop-Recorder-1.0.0\`).
2. **Double-click** `Cai-dat.bat`.
3. Script tạo thư mục và copy file vào:
   ```
   C:\ProgramData\StationHub\bin\
   ```
   **Lưu ý:** thư mục `bin` nằm trong **ProgramData**, **không** xuất hiện cạnh file `Cai-dat.bat` trong thư mục giải nén.
4. Khi hỏi mở Desktop Recorder ngay — chọn **Y** hoặc **N** tùy ý.
5. (Tuỳ chọn) Tạo shortcut Desktop trỏ tới:
   ```
   C:\ProgramData\StationHub\bin\stationhub-desktop-recorder.exe
   ```

### Sử dụng

1. Mở **StationHub Desktop Recorder** (đường dẫn trên).
2. **Bắt đầu ghi** → thao tác trên máy → **Dừng & lưu** (hoặc phím **F12**).
3. Trên console: **Desktop recordings** → chọn agent online → **Đồng bộ từ agent**.

Bản ghi lưu tại: `C:\ProgramData\StationHub\desktop-recordings\`

**Chạy lại** bản ghi trên máy cần đã chạy `Cai-dat.bat` thành công (cả hai file `.exe` trong gói zip).

---

## 9. Cài Chrome Recorder (gói zip)

Dùng khi cần **ghi thao tác trên Chrome** (click, nhập text) qua extension.

### File cần có

```
StationHub-Chrome-Recorder-x.x.x.zip
```

Trong thư mục giải nén:

| Thành phần | Vai trò |
|------------|---------|
| `Cai-dat.bat` | Đăng ký Native Messaging, copy bridge |
| `stationhub-chrome-bridge.exe` | Cầu nối extension ↔ agent |
| `extension\` | Thư mục extension Chrome (load unpacked) |

### Cài đặt

1. Giải nén zip đầy đủ.
2. **Double-click** `Cai-dat.bat` — chờ dòng `[OK] Da dang ky Native Messaging`.
3. Script copy bridge vào `C:\ProgramData\StationHub\bin\` và ghi manifest tại `C:\ProgramData\StationHub\chrome-bridge\`.
4. **Tự mở Chrome** và làm lần lượt:
   1. Vào thanh địa chỉ, gõ `chrome://extensions` rồi Enter.
   2. Bật **Chế độ nhà phát triển**.
   3. **Tải extension đã giải nén** → chọn thư mục **`extension`** trong gói vừa giải nén.
   4. **Tắt Chrome hẳn** (chuột phải icon Chrome trên taskbar → **Thoát**), rồi mở lại.

### Sử dụng

1. Mở tab cần ghi → bấm icon extension **StationHub** → **Bắt đầu ghi**.
2. Thao tác trên trang → popup extension → **Dừng & lưu**.
3. Trên console: **Chrome scripts** → chọn agent online → **Đồng bộ từ agent**.

Script lưu tại: `C:\ProgramData\StationHub\chrome-scripts\`

**Chạy task/workflow từ server** cần StationHub Agent (tray) đang chạy và bật Chrome extension trong **Cài đặt Agent** (`CHROME_EXTENSION_ENABLED=true`).

---

## 10. Dữ liệu agent lưu ở đâu?

Gỡ app qua Windows **không** tự xóa các thư mục sau:

| Đường dẫn | Nội dung |
|-----------|----------|
| `C:\ProgramData\StationHub\agent.env` | Cấu hình (Agent Key, server, flag tính năng) |
| `C:\ProgramData\StationHub\bin\` | Desktop Recorder, Chrome bridge, agent-native (sau khi chạy `Cai-dat.bat`) |
| `C:\ProgramData\StationHub\chrome-bridge\` | Manifest Native Messaging Chrome |
| `C:\ProgramData\StationHub\chrome-scripts\` | Script Chrome đã ghi |
| `C:\ProgramData\StationHub\desktop-recordings\` | Bản ghi desktop |
| `C:\ProgramData\StationHub\captures\` | Ảnh chụp màn hình task |
| `C:\ProgramData\StationHub\browser-profiles\` | Profile trình duyệt (Cloak/Chrome) |

Thư mục cài app (vd. `%LocalAppData%\Programs\StationHub Agent\`) chứa file chương trình; gỡ qua Settings sẽ xóa phần này.

---

## 11. Gỡ cài đặt ứng dụng

### Bước 1 — Thoát agent

1. Click phải icon tray → **Quit**.
2. (Nếu đã cài service) → **Gỡ Windows Service** trước.

### Bước 2 — Gỡ app

**Windows 11**

1. **Settings** → **Apps** → **Installed apps**.
2. Tìm **StationHub Agent** → **Uninstall** → xác nhận.

**Windows 10**

1. **Settings** → **Apps** → tìm **StationHub Agent** → **Uninstall**.

Hoặc: **Control Panel** → **Programs and Features** → **StationHub Agent** → **Uninstall**.

Trình gỡ NSIS xóa file trong thư mục cài đặt và shortcut Start Menu.

---

## 12. Xóa dữ liệu & cấu hình (gỡ sạch)

Thực hiện **sau khi gỡ app** nếu muốn xóa hết dấu vết / Agent Key / bản ghi local.

1. Mở File Explorer, gõ thanh địa chỉ:
   ```
   C:\ProgramData\StationHub
   ```
2. **Xóa cả thư mục `StationHub`** (cần quyền admin nếu Windows hỏi).

Hoặc PowerShell (Run as Administrator):

```powershell
Remove-Item -Recurse -Force 'C:\ProgramData\StationHub'
```

### Gỡ Windows Service (nếu còn sót)

PowerShell **Administrator**:

```powershell
sc stop StationHubAgentNative
sc delete StationHubAgentNative
```

### (Tuỳ chọn) Chrome extension

Nếu đã cài extension StationHub trên Chrome:

1. Mở `chrome://extensions`
2. Tắt / **Remove** extension **StationHub Agent Bridge**

Native Messaging host (sau khi chạy `Cai-dat.bat` của gói Chrome Recorder): xóa cùng thư mục `StationHub` ở trên, hoặc IT gỡ registry `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.stationhub.chrome_bridge`.

---

## 13. Cài lại sau khi gỡ sạch

1. Cài lại `StationHub Agent Setup x.x.x.exe` (mục 3).
2. Nhập lại **Server URL** + **Agent Key** (mục 4).
   - Key cũ vẫn dùng được nếu admin **chưa thu hồi** agent trên console.
   - Nếu admin đã xóa agent hoặc **Tạo lại key**, dùng key mới.

---

## 14. Xử lý sự cố nhanh

| Triệu chứng | Thử |
|-------------|-----|
| Không thấy icon tray | Start Menu → mở **StationHub Agent**; kiểm tra icon ẩn trong `^` |
| Agent OFFLINE trên web | Tray → **Khởi động lại agent**; kiểm tra mạng & firewall |
| Key không hợp lệ | Lấy key mới trên console; **Cài đặt…** → dán lại → Lưu |
| Log báo connect fail | Kiểm tra `SERVER_WS_URL` (đúng `ws://` hoặc `wss://`) |
| Cài service lỗi | Mở PowerShell **Run as administrator**; gỡ service cũ rồi cài lại từ tray |
| Task desktop không chạy | Đảm bảo đã **đăng nhập Windows** và tray đang chạy; bật `DESKTOP_AUTOMATION_ENABLED` nếu IT yêu cầu |
| Không thấy thư mục `bin` sau `Cai-dat.bat` | Kiểm tra `C:\ProgramData\StationHub\bin\` — không nằm cạnh file zip. Chạy lại `Cai-dat.bat` và đọc dòng `[OK]` hoặc `LOI:` |
| Desktop Recorder — Chạy lại báo thiếu cài đặt | Chạy lại `Cai-dat.bat` từ gói zip đủ cả hai file `.exe` |
| Chrome extension — Native host exited | Chạy lại `Cai-dat.bat` → tắt Chrome hẳn → mở lại; kiểm tra `C:\ProgramData\StationHub\bin\stationhub-chrome-bridge.exe` tồn tại |
| **WoL không bật được máy** | Kiểm tra BIOS + card mạng (mục 6.2–6.3); tắt Fast Startup; dùng Ethernet; kiểm tra MAC/broadcast trên console; server cùng LAN |

Chi tiết kỹ thuật: [README agent](../README.md), [remote-access.md](./remote-access.md).

---

## 15. Liên hệ hỗ trợ

Khi gửi ticket cho IT/admin, cung cấp:

- Tên agent trên console
- Hostname máy (tray → **About** hoặc `Settings → System → About`)
- Ảnh chụp **Show Logs** (10–20 dòng cuối)
- Đường dẫn config: `C:\ProgramData\StationHub\agent.env` (che **Agent Key** khi gửi)
