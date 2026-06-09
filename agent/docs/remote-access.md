# Remote access — WoL & RDP metadata

Agent báo cáo MAC/RDP khi connect Socket.IO; server lưu trong `agents.metadata` và hỗ trợ gửi Wake-on-LAN.

## Metadata agent gửi (connect)

| Trường | Mô tả |
|--------|--------|
| `wolMacAddress` | MAC ưu tiên card Ethernet / Wi‑Fi |
| `wolBroadcast` | Broadcast subnet IPv4 (vd. `192.168.1.255`) — tính từ IP/prefix card WoL |
| `networkInterfaces` | `[{ name, mac, kind }]` |
| `rdpEnabled` | Registry `fDenyTSConnections == 0` |
| `rdpPort` | Port RDP (mặc định 3389) |
| `rdpHost` | Hostname máy |

Admin có thể ghi đè `wolMacAddress`, `wolBroadcast`, `rdpHost` qua API — giá trị admin được giữ khi agent reconnect.

## API server

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/agents/:id/wake` | Gửi magic packet UDP |
| `PATCH` | `/api/agents/:id/remote-access` | Cấu hình MAC/broadcast/RDP |
| `POST` | `/api/admin/agents/:id/wake` | Admin |
| `PATCH` | `/api/admin/agents/:id/remote-access` | Admin |

Body wake (tuỳ chọn):

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "broadcast": "192.168.1.255",
  "port": 9
}
```

Biến môi trường server:

- `WOL_DEFAULT_BROADCAST` — mặc định `255.255.255.255`
- `WOL_DEFAULT_PORT` — mặc định `9`

**Lưu ý:** Server phải reach được broadcast subnet của máy agent (cùng LAN hoặc router forward UDP).

## WoL trên máy agent

1. BIOS: Wake on LAN enabled  
2. NIC: *Allow this device to wake the computer*  
3. Tắt Fast Startup (Windows)  
4. Ưu tiên Ethernet; Wi‑Fi WoL thường không ổn định  

Sau WoL, Windows Service agent có thể online **trước** user login; RDP vẫn cần user tự nhập mật khẩu trên client RDP.

## Code

| Thành phần | File |
|------------|------|
| Magic packet | `src/modules/agents/wol.service.ts` |
| Agent MAC/RDP | `agent/core/src/platform/windows/host_info.rs` |
| Connect metadata | `agent/core/src/connection/runner.rs` |
| Admin UI | `admin-stationhub/src/components/AgentRemoteAccessPanel.tsx` |
