# Desktop Recorder icon

| File | Mô tả |
|------|--------|
| `icon.ico` | Icon Windows — **file nguồn duy nhất** (exe + taskbar) |

Build:

```powershell
cd agent
npm run build:desktop-recorder
```

Script build: `winres` + embed runtime (taskbar) + `rcedit` trên `bin/stationhub-desktop-recorder.exe`.
