# Server DATN - Working Notes

## Current Understanding Snapshot

- Đây là hệ thống điều khiển/automation từ xa gồm 3 phần chính: backend, admin, agent.
- Backend chịu trách nhiệm auth, quản lý user/agent/task/workflow, queue, websocket.
- Agent là đầu chạy lệnh trên máy remote và gửi kết quả về backend.
- Admin là UI quản trị theo dõi và thao tác task/agent.

## Suggested Next Mapping (để làm việc sâu hơn)

- Luồng auth end-to-end: login -> token refresh -> role guard.
- Luồng task end-to-end: tạo task -> queue -> push `task:execute` -> nhận `task:result`.
- Luồng đăng ký agent: POST `/api/agents` -> cấp `AGENT_KEY` -> ws connect.
- Luồng automation/workflow: trigger thủ công và scheduled nếu có.

## Conventions for Future Sessions

- Ghi thêm các phát hiện mới vào file này theo format:
  - Ngày
  - Bối cảnh
  - File liên quan
  - Kết luận
  - Việc cần làm tiếp
- Nếu đụng tới config, luôn cập nhật song song:
  - `docs/project-memory/01-overview.md`
  - `docs/project-memory/02-runbook.md`

## Red Flags

- Repo có nhiều `node_modules` đang nằm trong workspace tree, dễ tạo nhiễu khi search và review.
- Tồn tại project `9remote` song song; cần xác nhận phạm vi chính thức trước khi refactor lớn để tránh sửa nhầm domain.
