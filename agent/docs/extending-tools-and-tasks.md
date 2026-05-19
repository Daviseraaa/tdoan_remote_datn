# Mở rộng tool và task

Bổ sung [architecture.md](./architecture.md) và [flows.md](./flows.md). **Luồng production là Rust** — thêm task = handler mới + đăng ký registry; logic OS = `platform/`.

---

## 1. Đánh giá nhanh (Rust)

| Chủ đề | Cách xử lý hiện tại |
|--------|---------------------|
| **Song song task** | `TASK_MAX_CONCURRENCY` + `Semaphore` trong `connection/runner.rs` |
| **Type không hỗ trợ** | Không có trong `HANDLERS` → `task:result` FAILED |
| **Shell an toàn** | `platform/shell.rs` |
| **Capability** | `metadata.capabilities` lúc connect (từ `tasks/registry.rs`) |

---

## 2. Checklist: thêm **hành vi** cho task type đã có (Rust)

1. Sửa file handler tương ứng trong `core/src/tasks/handlers/`.
2. Nếu output đổi format → `protocol/wire.rs`.
3. `npm run build:core` từ `agent/`.
4. Kiểm thử task thật từ API/admin.

---

## 3. Checklist: thêm **task type** mới (full stack)

1. **Prisma:** enum `TaskType` + migration.
2. **Server:** DTO tạo task, `tasks.processor.ts` emit `task:execute`; [`TaskExecutePayload`](../../src/common/types/ws-protocol.ts) nếu cần.
3. **Rust agent:**
   - Tạo `core/src/tasks/handlers/<name>.rs` implement `TaskHandler`.
   - Thêm `&handlers::<name>::Handler` vào `HANDLERS` trong `tasks/registry.rs`.
   - Logic phụ thuộc OS → trait trong `platform/mod.rs` + impl dưới `platform/<os>/`.
4. **(Tuỳ chọn)** Admin UI nếu enum cứng.
5. **Test:** tạo task → `task:result` đúng `taskId`; connect metadata có type mới trong `capabilities`.

---

## 4. Tham chiếu file

| Thành phần | File thực thi (Rust) |
|-------------|----------------------|
| Registry task | [`core/src/tasks/registry.rs`](../core/src/tasks/registry.rs) |
| Handler (ví dụ) | [`core/src/tasks/handlers/`](../core/src/tasks/handlers/) |
| Wire `task:result` | [`core/src/protocol/wire.rs`](../core/src/protocol/wire.rs) |
| Socket + task listener | [`core/src/connection/runner.rs`](../core/src/connection/runner.rs) |
| Mở app | [`core/src/platform/open_app/`](../core/src/platform/open_app/) |
| Desktop automation (Windows) | [`core/src/platform/windows/desktop.rs`](../core/src/platform/windows/desktop.rs) |
| Contract WS | [`src/common/constants/index.ts`](../../src/common/constants/index.ts), [`src/common/types/ws-protocol.ts`](../../src/common/types/ws-protocol.ts) |

Desktop DSL (payload giống server): [user-simulation.md](./user-simulation.md).

---

## 5. Thêm hỗ trợ OS mới

1. Impl `OpenApp` / `DesktopAutomation` (nếu cần) trong `platform/<os>/`.
2. Nhánh trong `Platform::current()` (`platform/mod.rs`).
3. Không thêm `#[cfg]` trong `tasks/handlers/` — chỉ gọi qua `ctx.platform`.
