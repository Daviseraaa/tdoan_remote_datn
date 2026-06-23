# Icon StationHub Agent

File chính: **`icon.ico`** (Windows) — đồng bộ từ `landing-stationhub/public/favicon.ico`.

| File | Dùng cho |
|------|----------|
| `icon.ico` | `.exe`, installer NSIS, tray, cửa sổ app |
| `icon.png` | (tuỳ chọn) logo trong UI cài đặt nếu `.ico` không hiển thị |

## Build

```powershell
cd agent\desktop
npm run build
npm run dist
```

`copy-static.js` copy `icon.ico` → `dist/tray/icon.ico` và `dist/renderer/logo.ico`.

Sau `npm run dist`, `scripts/after-pack-icon.js` gắn `icon.ico` vào `StationHub Agent.exe` (shortcut Desktop/Start Menu lấy icon từ file exe).

**ICO hợp lệ Windows:** nên có nhiều kích thước (16, 32, 48, 64, 128, 256). Nếu shortcut vẫn icon cũ: gỡ app → xóa shortcut cũ → cài lại bản build mới.
