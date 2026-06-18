# Hướng dẫn xuất biểu đồ Use Case UML (đúng mẫu báo cáo)

Mẫu báo cáo BKHN: **actor** (hình người), **use case** (oval vàng), **khung use case cha** (rectangle), đường nối actor → use case con.

**Quy tắc đồ án:** Mỗi use case mức cao trong Hình 2.1 có **một mục 2.2.x riêng**; tên đề mục và tiêu đề khung phân rã **phải khớp** tên trên biểu đồ tổng quan.

## File PlantUML

| Hình | Mục báo cáo | Use case mức cao | File |
|------|-------------|------------------|------|
| 2.1 | 2.2.1 | Tổng quan (9 use case) | [`hinh-2-1-use-case-tong-quan.puml`](./hinh-2-1-use-case-tong-quan.puml) |
| 2.2 | 2.2.2 | Đăng nhập / đăng ký | [`hinh-2-2-dang-nhap-dang-ky.puml`](./hinh-2-2-dang-nhap-dang-ky.puml) |
| 2.3 | 2.2.3 | Quản lý fleet agent | [`hinh-2-3-quan-ly-fleet-agent.puml`](./hinh-2-3-quan-ly-fleet-agent.puml) |
| 2.4 | 2.2.4 | Quản lý task và template | [`hinh-2-4-quan-ly-task-template.puml`](./hinh-2-4-quan-ly-task-template.puml) |
| 2.5 | 2.2.5 | Thiết kế workflow | [`hinh-2-5-thiet-ke-workflow.puml`](./hinh-2-5-thiet-ke-workflow.puml) |
| 2.6 | 2.2.6 | Chạy task / workflow | [`hinh-2-6-chay-task-workflow.puml`](./hinh-2-6-chay-task-workflow.puml) |
| 2.7 | 2.2.7 | Cấu hình trigger (Cron · Telegram) | [`hinh-2-7-cau-hinh-trigger.puml`](./hinh-2-7-cau-hinh-trigger.puml) |
| 2.8 | 2.2.8 | Xem dashboard | [`hinh-2-8-xem-dashboard.puml`](./hinh-2-8-xem-dashboard.puml) |
| 2.9 | 2.2.9 | Quản lý người dùng | [`hinh-2-9-quan-ly-nguoi-dung.puml`](./hinh-2-9-quan-ly-nguoi-dung.puml) |
| 2.10 | 2.2.10 | Xem nhật ký audit | [`hinh-2-10-xem-nhat-ky-audit.puml`](./hinh-2-10-xem-nhat-ky-audit.puml) |
| 2.11 | 2.2.11 | Quy trình nghiệp vụ (activity) | Mermaid trong [`bao-cao-bieu-do.md`](../bao-cao-bieu-do.md) |

### File cũ (không dùng — tên không khớp Hình 2.1)

- `hinh-2-2-use-case-phan-ra-task.puml` — tên *Thực thi task trên agent* (sai)
- `hinh-2-2b-use-case-phan-ra-workflow.puml` — đã gộp vào Hình 2.6

---

## Cách 1 — PlantUML Online (nhanh nhất)

1. Mở [https://www.plantuml.com/plantuml/uml/](https://www.plantuml.com/plantuml/uml/)
2. Copy toàn bộ nội dung file `.puml` → paste vào ô soạn thảo.
3. Bấm **Submit** → tải **PNG** hoặc **SVG**.
4. Chèn vào Word, chú thích ví dụ: *Hình 2.6 Phân rã use case Chạy task / workflow*.

---

## Cách 2 — VS Code / Cursor

1. Cài extension **PlantUML** (jebbs.plantuml).
2. Cài **Graphviz** (Windows): [https://graphviz.org/download/](https://graphviz.org/download/) — cần cho render local.
3. Mở file `.puml` → `Alt+D` preview → export PNG.

---

## Cách 3 — CLI (Java)

```bash
java -jar plantuml.jar docs/diagrams/hinh-2-1-use-case-tong-quan.puml
java -jar plantuml.jar docs/diagrams/hinh-2-*.puml
```

Output: cùng thư mục, file `.png`.

---

## Lưu ý đồ án

- **Hình 2.1:** 2 actor (USER trái, ADMIN phải); 9 use case oval trong khung hệ thống.
- **Hình 2.2–2.10:** Mỗi hình phân rã **đúng một** use case từ Hình 2.1; khung rectangle ghi tên use case cha.
- **Hình 2.6:** Có thể dùng `<<include>>` thể hiện pipeline; actor *Hệ thống (Trigger)* cho luồng tự động.
- **Hình 2.9, 2.10:** Chỉ actor ADMIN.
- Không ghi agent key, URL production lên hình.
- Màu oval: `#FFFACD` — chỉnh trong `skinparam usecase` nếu cần khớp mẫu lớp trên.
