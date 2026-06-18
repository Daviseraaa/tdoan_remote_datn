# Nội dung báo cáo đồ án — Hệ thống quản lý và thực thi tác vụ tự động trên máy trạm Windows qua mô hình agent–server

> **Hướng dẫn sử dụng:** Copy từng chương vào file Word `docs/Báo cáo đồ án.docx`. **Cập nhật Tóm tắt/Abstract** theo mục bên dưới (đã ghi nhận triển khai **production**). Các vị trí `[chèn Hình …]` cần bổ sung ảnh chụp màn hình production hoặc sơ đồ triển khai.

---

## Tóm tắt & Abstract (cập nhật cho Word — production)

**Đoạn 4 Tóm tắt (tiếng Việt):**

Kết quả, đồ án đã xây dựng và **triển khai production** hệ thống quản lý tập trung fleet agent và tự động hóa quy trình trên máy trạm, gồm server điều phối, agent Windows và console quản trị web. Hệ thống đang vận hành trên môi trường production: backend NestJS và WebSocket trên Railway, cơ sở dữ liệu PostgreSQL và hàng đợi Redis trên dịch vụ managed, giao diện quản trị trên Firebase Hosting; agent Windows kết nối qua HTTPS/WSS và thực thi task trong điều kiện vận hành thực tế. Qua đó chứng minh tính khả thi của mô hình điều phối tập trung, giám sát thời gian thực và khả năng mở rộng.

**Đoạn 4 Abstract (English):**

As a result, the thesis delivers a **production-deployed** centralized agent fleet management and workstation automation system, comprising an orchestration server, Windows agents, and a web admin console. The system runs in production: the NestJS backend and WebSocket gateway on Railway, PostgreSQL and Redis queue on managed cloud services, and the admin UI on Firebase Hosting; Windows agents connect over HTTPS/WSS and execute tasks in live operation. This demonstrates the feasibility of centralized orchestration, real-time monitoring, and future scalability.

---

## Danh mục các từ viết tắt

| Viết tắt | Ý nghĩa |
|----------|---------|
| API | Application Programming Interface — Giao diện lập trình ứng dụng |
| CRUD | Create, Read, Update, Delete |
| CSDL | Cơ sở dữ liệu |
| E-R | Entity–Relationship — Thực thể – liên kết |
| JWT | JSON Web Token |
| ORM | Object–Relational Mapping |
| RBAC | Role-Based Access Control — Kiểm soát truy cập theo vai trò |
| REST | Representational State Transfer |
| RPA | Robotic Process Automation — Tự động hóa quy trình robot |
| SPA | Single Page Application — Ứng dụng một trang |
| UIA | UI Automation — Tự động hóa giao diện Windows |
| UML | Unified Modeling Language — Ngôn ngữ mô hình hóa thống nhất |
| WS | WebSocket |

## Danh mục thuật ngữ

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| Agent | Phần mềm cài trên máy trạm, nhận lệnh từ server và thực thi task tại chỗ |
| Fleet agent | Tập hợp nhiều agent do một tổ chức quản lý tập trung |
| Task | Đơn vị công việc được giao cho agent (chạy lệnh, mở ứng dụng, gọi HTTP, …) |
| Task template | Mẫu task tái sử dụng, lưu cấu hình sẵn để tạo task nhanh |
| Workflow | Quy trình tự động gồm nhiều bước liên kết theo đồ thị |
| Trigger | Cơ chế kích hoạt workflow theo sự kiện (thủ công, lịch, Telegram) |
| Hàng đợi (queue) | Cơ chế xếp hàng và xử lý task bất đồng bộ qua Redis/BullMQ |
| Heartbeat | Tín hiệu định kỳ agent gửi lên server để báo còn online |
| Namespace WebSocket | Không gian kênh Socket.IO riêng (`/ws/agent`, `/ws/client`) |

---

# Chương 1. Giới thiệu đề tài

## 1.1. Đặt vấn đề

Trong doanh nghiệp, phòng IT và các bộ phận vận hành thường phải thực hiện hàng loạt thao tác lặp lại trên nhiều máy trạm Windows: triển khai script, kiểm tra trạng thái hệ thống, mở ứng dụng nội bộ, gọi API localhost hoặc thực thi quy trình tự động hóa desktop. Khi số lượng máy tăng, việc đăng nhập từng máy qua Remote Desktop hoặc phân phối script thủ công trở nên tốn thời gian, khó kiểm soát và dễ sai sót.

Theo xu hướng chung, thị trường tự động hóa quy trình (RPA) và điều phối endpoint đang mở rộng mạnh: doanh nghiệp cần một lớp quản trị tập trung thay vì công cụ rời rạc trên từng máy. Tuy nhiên, nhiều giải pháp thương mại (Microsoft Power Automate, UiPath, …) có chi phí cao, phụ thuộc hạ tầng đám mây riêng hoặc thiếu khả năng tùy biến sâu cho bài toán đồ án. Ngược lại, các script tự viết (PowerShell, batch, Python) dù linh hoạt nhưng thiếu điểm điều phối, không có hàng đợi, không theo dõi trạng thái thời gian thực và khó mở rộng thành quy trình nhiều bước.

Bốn hạn chế nổi bật của mô hình truyền thống có thể tóm lược như sau.

**Thiếu điều phối tập trung.** Kịch bản và lịch chạy thường nằm rải rác trên từng máy. Khi fleet có hàng chục hoặc hàng trăm máy trạm, việc cập nhật script, gán agent cho task và đảm bảo phiên bản đồng nhất trở thành gánh nặng vận hành.

**Thiếu minh bạch trạng thái thực thi.** Người quản trị khó biết task đang chạy, đã hoàn thành hay thất bại trên máy nào, trừ khi kiểm tra thủ công hoặc đọc log cục bộ. Điều này kéo dài thời gian xử lý sự cố và làm giảm độ tin cậy của automation.

**Phân tách công cụ.** Phân phối task, thiết kế workflow nhiều bước, lên lịch cron và kích hoạt qua bot Telegram thường phải dùng nhiều phần mềm khác nhau, gây phức tạp trong triển khai và bảo trì.

**Hạn chế mở rộng và phân quyền.** Giải pháp cục bộ hiếm khi tích hợp sẵn xác thực người dùng, phân quyền admin/user và quản lý fleet theo từng tài khoản trong cùng một nền tảng thống nhất.

Bốn hạn chế trên ảnh hưởng trực tiếp đến hiệu quả vận hành IT, khả năng giám sát và chi phí bảo trì automation. Giải quyết được chúng sẽ góp phần chuẩn hóa quy trình tạo–phân phối–giám sát task trên máy trạm, tạo nền tảng mở rộng sang tự động hóa quy trình phức tạp hơn trong tương lai.

## 1.2. Mục tiêu và phạm vi đề tài

### Mục tiêu

Mục tiêu của đồ án là **xây dựng hệ thống quản lý tập trung fleet agent và thực thi tác vụ tự động trên máy trạm Windows** theo mô hình agent–server, bao gồm:

1. Server điều phối: lưu trữ người dùng, agent, task, workflow; xếp hàng và phân phối task qua hàng đợi; duy trì kết nối thời gian thực với agent.
2. Agent Windows: nhận lệnh từ server, thực thi các loại task tại chỗ và báo cáo kết quả.
3. Console quản trị web: quản lý fleet, thiết kế workflow đồ thị, theo dõi trạng thái task/workflow theo thời gian thực.
4. Mô-đun trigger: kích hoạt workflow theo lịch (cron), webhook và bot Telegram.

Hệ thống hướng tới minh bạch hóa trạng thái thực thi, rút ngắn thời gian vận hành và triển khai vận hành thực tế theo mô hình agent–server.

### Phạm vi

**Phạm vi chức năng:** đăng ký/đăng nhập, quản lý user (RBAC ADMIN/USER), CRUD agent và khóa agent, tạo/chạy/hủy task và task template, thiết kế và thực thi workflow đồ thị, trigger thủ công/lịch/Telegram, dashboard và audit cơ bản.

**Phạm vi kỹ thuật:** backend NestJS + PostgreSQL + Redis/BullMQ; frontend React SPA; agent core Rust + shell Electron (tray, cài đặt Windows); giao tiếp REST và WebSocket (Socket.IO).

**Phạm vi triển khai:** phát triển trên môi trường local (Docker, localhost); **đã triển khai và đang vận hành production** trên cloud — backend NestJS trên Railway, console web trên Firebase Hosting, PostgreSQL và Redis managed; agent Windows production kết nối server qua HTTPS/WSS.

**Ngoài phạm vi (hoặc chỉ hỗ trợ ở mức tối thiểu):** thanh toán/gói dịch vụ thương mại; agent Linux/macOS; remote desktop đầy đủ; OCR/image-based automation nâng cao.

## 1.3. Định hướng giải pháp

Để giải quyết các vấn đề đã nêu, đồ án lựa chọn hướng tiếp cận xây dựng nền tảng quản lý tập trung theo **mô hình agent–server**. Trong đó, server đóng vai trò trung tâm điều phối — lưu trữ người dùng, fleet agent, task và workflow; còn agent cài trên máy trạm Windows thực thi tác vụ tại chỗ và báo cáo kết quả về server. Cách tổ chức này vừa đáp ứng yêu cầu **quản trị tập trung**, vừa tận dụng **thực thi phân tán** trên từng máy trạm, phù hợp với bối cảnh mạng nội bộ, VPN hoặc agent kết nối ra Internet qua kênh bảo mật (HTTPS/WSS) mà không cần mở port inbound trên LAN.

Đối với các chức năng điều phối và giám sát theo thời gian thực, hệ thống kết hợp **WebSocket (Socket.IO)** với **hàng đợi bất đồng bộ BullMQ** trên Redis. WebSocket duy trì kết nối lâu dài với agent, cập nhật trạng thái online/offline qua heartbeat và đẩy kết quả task tới console quản trị ngay khi hoàn tất; BullMQ tách bước tạo task khỏi bước phân phối, hỗ trợ xếp hàng, retry và xử lý song song khi nhiều tác vụ phát sinh đồng thời. Bên cạnh task đơn lẻ, **workflow đồ thị** được hiện thực bởi lớp runtime trên server, cho phép thiết kế quy trình nhiều bước, truyền biến giữa các bước (`steps.*`, `workflow.*`) và kích hoạt tự động qua **trigger** theo lịch cron hoặc bot Telegram.

Về mặt triển khai, hệ thống được xây dựng theo kiến trúc ba tầng: **React (Vite)** ở phía giao diện quản trị web, **NestJS** ở phía máy chủ. **PostgreSQL** kết hợp **Prisma ORM** lưu trữ dữ liệu nghiệp vụ; **Redis** phục vụ hàng đợi BullMQ; gateway WebSocket và worker xử lý task nằm cùng tầng ứng dụng trên server. Phía máy trạm, agent lõi viết bằng **Rust** (tích hợp Win32, thực thi lệnh và tự động hóa desktop) kết hợp shell **Electron** (system tray, cài đặt dịch vụ Windows). Cơ chế **JWT/RBAC** được áp dụng để phân quyền người dùng và cách ly dữ liệu theo tài khoản. Hệ thống đã được **triển khai production** trên cloud: backend trên Railway, console web trên Firebase Hosting, cơ sở dữ liệu và Redis trên dịch vụ managed — tạo môi trường vận hành thực tế ngoài localhost.

Kết quả của đồ án là xây dựng được nền tảng quản lý và thực thi tác vụ tự động trên máy trạm Windows với các chức năng quản lý fleet agent, tạo và phân phối task, thiết kế workflow đồ thị, trigger đa kênh và giám sát trạng thái theo thời gian thực. Hệ thống được thiết kế theo hướng mở rộng — có thể bổ sung loại task mới trên agent, mở rộng worker và tích hợp thêm kênh kích hoạt — tạo cơ sở cho việc phát triển thêm các năng lực tự động hóa và vận hành quy mô lớn trong tương lai.

[chèn Hình 1.1 — Kiến trúc agent–server ba tầng]
[chèn Hình 1.2 — Luồng nghiệp vụ chính]

## 1.4. Bố cục đồ án

Báo cáo đồ án tốt nghiệp được tổ chức thành sáu chương. Chương 1 trình bày tổng quan đề tài, nêu bối cảnh và các hạn chế của mô hình quản lý tác vụ truyền thống trên máy trạm, xác định mục tiêu, phạm vi nghiên cứu, định hướng giải pháp theo mô hình agent–server và bố cục toàn văn.

**Chương 2 — Khảo sát và phân tích yêu cầu** trình bày kết quả khảo sát hiện trạng và phân tích yêu cầu đặt ra đối với hệ thống. Mục 2.1 phân tích nhu cầu thực tế của quản trị viên và người dùng vận hành, đồng thời so sánh các nhóm giải pháp hiện có — script thủ công, công cụ RPA thương mại và stack tự ghép — trên các tiêu chí quản lý fleet tập trung, cập nhật trạng thái thời gian thực, workflow nhiều bước và chi phí triển khai. Mục 2.2 mô tả tổng quan chức năng thông qua biểu đồ use case tổng quan (Hình 2.1); **mỗi use case mức cao trong Hình 2.1 được phân rã riêng tại các mục 2.2.2–2.2.10** (Hình 2.2–2.10), tên đề mục khớp tên use case trên biểu đồ tổng quan; mục 2.2.11 trình bày quy trình nghiệp vụ xuyên suốt từ đăng ký agent đến giám sát kết quả. Mục 2.3 đặc tả chi tiết năm use case trọng yếu (UC001–UC005): quản lý fleet agent, chạy task, thiết kế workflow, chạy workflow và cấu hình trigger — theo mẫu mã use case, sự kiện kích hoạt, luồng sự kiện chính và luồng thay thế. Mục 2.4 tổng hợp các yêu cầu phi chức năng theo chín nhóm: hiệu năng, khả dụng, bảo mật, tin cậy, khả năng mở rộng, tính dễ sử dụng, bảo trì, triển khai và an toàn vận hành trên máy trạm — kèm tiêu chí đo lường và ánh xạ công nghệ.

**Chương 3 — Công nghệ sử dụng** trình bày tổng quan kiến trúc công nghệ (mục 3.0) và lần lượt giới thiệu từng nhóm công nghệ theo định hướng mục 1.3; mỗi mục 3.1–3.8 mở đầu bằng kiến thức nền về công nghệ, sau đó phân tích yêu cầu Chương 2 cần đáp ứng, phương án thay thế và lý do lựa chọn, kèm tham chiếu tài liệu [1]–[18]. Độ dài chương tương đương khoảng mười trang A4 khi chuyển sang Word (font 13, giãn dòng 1,3).

**Chương 4 — Phát triển và triển khai ứng dụng** trình bày quá trình thiết kế, xây dựng, kiểm thử và triển khai hệ thống. Mục 4.1 trình bày lựa chọn kiến trúc phần mềm (mô hình ba tầng kết hợp client–server và xử lý bất đồng bộ), sơ đồ kiến trúc tổng quan và thiết kế phụ thuộc giữa các module backend. Mục 4.2 trình bày thiết kế chi tiết: chuẩn hóa giao diện console quản trị, thiết kế lớp và biểu đồ trình tự cho luồng dispatch task, thiết kế cơ sở dữ liệu (E-R, lược đồ logic nhóm bảng, E-R mở rộng và ảnh schema Prisma/CSDL triển khai). Mục 4.3 mô tả quá trình xây dựng: danh mục thư viện và công cụ, thống kê quy mô mã nguồn, kết quả đóng gói sản phẩm và minh họa các chức năng chính qua giao diện thực tế. Mục 4.4 trình bày phương pháp và kết quả kiểm thử các chức năng trọng yếu. Mục 4.5 mô tả triển khai trên môi trường phát triển cục bộ và **triển khai production trên cloud** (Railway, Firebase Hosting, dịch vụ PostgreSQL/Redis managed), cùng kết quả vận hành thực tế.

**Chương 5 — Các giải pháp và đóng góp nổi bật** đi sâu vào những giải pháp kỹ thuật then chốt phục vụ bài toán quản lý tập trung, thay vì chỉ liệt kê chức năng đã cài đặt. Chương lần lượt phân tích: (5.1) gateway WebSocket và cơ chế quản lý trạng thái fleet realtime qua heartbeat; (5.2) mô hình hàng đợi BullMQ tách enqueue khỏi dispatch, hỗ trợ retry và xử lý song song; (5.3) workflow runtime với đồ thị, truyền biến động giữa các bước; (5.4) phân quyền JWT/RBAC và cách ly dữ liệu theo người dùng; (5.5) trigger đa kênh (lịch cron, Telegram) gắn với workflow. Mỗi mục trình bày theo trình tự vấn đề đặt ra, giải pháp đề xuất và kết quả đạt được.

**Chương 6 — Kết luận và hướng phát triển** tổng kết kết quả đồ án: mức độ hoàn thành mục tiêu, so sánh với giải pháp truyền thống, các hạn chế còn tồn tại và bài học kinh nghiệm trong quá trình thiết kế hệ thống phân tán. Mục 6.2 đề xuất hướng phát triển ngắn hạn (hoàn thiện task type, test E2E, domain và giám sát) và dài hạn (agent đa nền tảng, scale-out worker, high availability, chính sách bảo mật nâng cao).

Cuối báo cáo là **Tài liệu tham khảo** và các **phụ lục** (nếu có): sơ đồ bổ sung, bảng kiểm thử chi tiết, hướng dẫn cài đặt agent.

---

# Chương 2. Khảo sát và phân tích yêu cầu

## 2.1. Khảo sát hiện trạng

Khảo sát trên ba hướng: nhu cầu người dùng, giải pháp RPA/remote execution hiện có, và hạn chế khi vận hành script thủ công.

### Nhu cầu người dùng

Hệ thống phục vụ hai vai trò chính:

- **Quản trị viên (ADMIN):** quản lý toàn bộ user, xem audit, cấu hình hệ thống, hỗ trợ vận hành.
- **Người dùng (USER):** đăng ký agent, tạo task/workflow, giám sát fleet của mình.

Kỳ vọng: một điểm vào duy nhất để giao việc cho nhiều máy; biết agent nào online; theo dõi task đang chạy/thất bại; lên lịch hoặc kích hoạt qua Telegram khi cần.

### Giải pháp hiện có

| Nhóm | Ví dụ | Ưu điểm | Hạn chế |
|------|-------|---------|---------|
| RPA thương mại | Power Automate Desktop, UiPath | Recorder mạnh, UIA/OCR | Chi phí, khó tùy biến server riêng |
| Remote/script | RDP, PsExec, Ansible | Quen thuộc với IT | Thiếu UI quản lý fleet, thiếu workflow graph |
| Orchestrator mã nguồn mở | Stack tự ghép (Cron + SSH) | Linh hoạt | Không thống nhất, thiếu realtime WS |

### Bảng so sánh (Bảng 2.1)

| Tiêu chí | Script thủ công / SSH | RPA thương mại | Hệ thống đề xuất |
|----------|----------------------|----------------|------------------|
| Quản lý fleet tập trung | Thấp | Trung bình–cao | Cao |
| Trạng thái realtime | Thấp | Trung bình | Cao (WebSocket) |
| Workflow nhiều bước | Thấp | Cao | Cao (đồ thị + biến) |
| Trigger lịch / Telegram | Phải tự ghép | Tùy sản phẩm | Có sẵn |
| Chi phí triển khai đồ án | Thấp | Cao | Thấp (mã nguồn mở) |
| Tùy biến server/on-prem | Cao | Hạn chế | Cao |

**Kết luận khảo sát:** cần nền tảng tích hợp quản lý agent, hàng đợi task, workflow và trigger trong một hệ thống, với console web và giao tiếp thời gian thực.

## 2.2. Tổng quan chức năng

Dựa trên kết quả khảo sát hiện trạng và các yêu cầu sơ bộ được xác định, hệ thống được thiết kế nhằm hỗ trợ người dùng **quản lý tập trung fleet agent trên máy trạm Windows**, **tạo và điều phối task cùng workflow tự động**, **giám sát trạng thái thực thi theo thời gian thực** và **kích hoạt quy trình qua lịch hoặc Telegram**. Phần này trình bày tổng quan các nhóm chức năng thông qua biểu đồ use case tổng quan (Hình 2.1); **với mỗi use case mức cao trong Hình 2.1, mục 2.2.2 đến 2.2.10 trình bày biểu đồ phân rã và giải thích ngắn gọn các use case con** — tên đề mục khớp tên use case trên biểu đồ tổng quan. Các đặc tả chi tiết (luồng sự kiện, tiền/hậu điều kiện) được trình bày trong mục 2.3.

### 2.2.1. Biểu đồ use case tổng quan

Hệ thống có hai tác nhân chính, mỗi tác nhân tương ứng với một nhóm vai trò và tập chức năng riêng. Hình 2.1 thể hiện quan hệ giữa hai tác nhân và các trường hợp sử dụng của hệ thống.

[chèn Hình 2.1 — Biểu đồ use case tổng quan]

**Người dùng (USER)** là người vận hành fleet agent thuộc tài khoản của mình trên các máy trạm Windows. Sau khi đăng ký, đăng nhập và được xác thực theo vai trò, người dùng có thể quản lý danh sách agent — tạo mới, đặt tên, tái tạo agent key và theo dõi trạng thái online/offline cùng thông tin máy trạm; tạo và quản lý task template cùng các task cụ thể, bao gồm chạy, hủy, thử lại và xem log thực thi; thiết kế workflow dạng đồ thị và kích hoạt chạy thủ công; cấu hình trigger theo lịch cron hoặc bot Telegram để tự động hóa quy trình; đồng thời xem dashboard thống kê tổng quan về agent và task trong phạm vi quyền sở hữu.

**Quản trị viên (ADMIN)** giữ vai trò quản trị toàn hệ thống. Tác nhân này có toàn bộ quyền của người dùng và bổ sung thêm khả năng quản lý tài khoản người dùng — tạo, khóa, mở khóa, phân quyền ADMIN/USER — cùng xem nhật ký audit ghi nhận các thao tác quan trọng trên hệ thống. Nhờ đó, quản trị viên vừa có thể trực tiếp vận hành fleet và workflow khi cần, vừa đảm bảo kiểm soát truy cập và truy vết hoạt động ở cấp nền tảng.

### 2.2.2. Đăng nhập / đăng ký

Use case **Đăng nhập / đăng ký** là điểm vào bắt buộc của mọi thao tác trên console: người dùng phải có phiên hợp lệ trước khi quản lý agent, task hay workflow. Use case mức cao này được phân rã thành các bước xác thực và duy trì phiên, thể hiện ở Hình 2.2.

[chèn Hình 2.2 — Phân rã use case Đăng nhập / đăng ký]  
*PlantUML:* `docs/diagrams/hinh-2-2-dang-nhap-dang-ky.puml`

**Người dùng (USER)** thực hiện **Đăng ký tài khoản** khi lần đầu sử dụng hệ thống — cung cấp email và mật khẩu để tạo bản ghi user mới. Sau đó, **Đăng nhập** xác thực thông tin, hệ thống cấp cặp access token và refresh token (JWT). Trong phiên làm việc, **Làm mới access token** được gọi khi access token hết hạn nhưng refresh token còn hiệu lực, tránh bắt người dùng đăng nhập lại liên tục. Khi kết thúc, **Đăng xuất** huỷ phiên hiện tại và vô hiệu hoá token.

**Quản trị viên (ADMIN)** sử dụng cùng các use case **Đăng nhập**, **Làm mới access token** và **Đăng xuất**; sau khi xác thực thành công, hệ thống gán role ADMIN và mở thêm các chức năng quản trị. Các use case con trên hợp thành cơ chế xác thực và duy trì phiên an toàn cho toàn bộ console.

### 2.2.3. Quản lý fleet agent

Use case **Quản lý fleet agent** bao trùm vòng đời của mỗi agent Windows thuộc tài khoản — từ lúc đăng ký trên server đến khi giám sát trạng thái và thu hồi. Hình 2.3 trình bày phân rã use case này.

[chèn Hình 2.3 — Phân rã use case Quản lý fleet agent]  
*PlantUML:* `docs/diagrams/hinh-2-3-quan-ly-fleet-agent.puml`

**Người dùng (USER)** bắt đầu bằng **Tạo agent** trên console: hệ thống sinh bản ghi agent và agent key dùng để xác thực kết nối WebSocket. Tiếp theo, **Cấu hình agent key trên máy trạm** — người vận hành cài phần mềm agent trên Windows và nhập key qua giao diện tray hoặc file cấu hình. Khi agent đã kết nối, **Xem trạng thái và metadata** cho phép theo dõi ONLINE/OFFLINE, hệ điều hành, hostname và thời điểm heartbeat gần nhất. Nếu key bị lộ, **Tái tạo agent key** sinh key mới và vô hiệu key cũ. Khi không còn sử dụng máy trạm đó, **Xóa agent** gỡ bản ghi khỏi fleet. Các use case con này hợp thành quy trình đăng ký và giám sát tập trung toàn bộ agent thuộc tài khoản.

### 2.2.4. Quản lý task và template

Use case **Quản lý task và template** tách phần *định nghĩa* công việc (template) khỏi phần *thực thi* (task cụ thể), giúp tái sử dụng cấu hình và theo dõi từng lần chạy. Hình 2.4 mô tả phân rã.

[chèn Hình 2.4 — Phân rã use case Quản lý task và template]  
*PlantUML:* `docs/diagrams/hinh-2-4-quan-ly-task-template.puml`

**Người dùng (USER)** dùng **Tạo task template** để lưu sẵn loại task, payload mẫu và agent đích; **Sửa / xóa template** cập nhật hoặc loại bỏ mẫu không còn phù hợp. Khi cần chạy thực tế, **Tạo task** khởi tạo bản ghi task — có thể chọn từ template hoặc nhập trực tiếp loại task và payload. Trong và sau quá trình thực thi, **Xem log và trạng thái task** hiển thị tiến độ (PENDING, RUNNING, COMPLETED, FAILED…) cùng log chi tiết. Nếu task bị kẹt hoặc thất bại, **Hủy hoặc thử lại task** cho phép dừng job đang chạy hoặc enqueue lại. Nhóm use case con này bao quát toàn bộ vòng đời định nghĩa và vận hành task trên console.

### 2.2.5. Thiết kế workflow

Use case **Thiết kế workflow** phục vụ xây dựng quy trình tự động nhiều bước dưới dạng đồ thị, thay vì tạo từng task rời rạc. Hình 2.5 trình bày phân rã.

[chèn Hình 2.5 — Phân rã use case Thiết kế workflow]  
*PlantUML:* `docs/diagrams/hinh-2-5-thiet-ke-workflow.puml`

**Người dùng (USER)** khởi tạo bằng **Tạo workflow mới**, sau đó **Thiết kế đồ thị bước** — kéo thả node (mỗi node tương ứng một task) và nối edge xác định thứ tự thực thi trên canvas. **Cấu hình biến workflow** khai báo giá trị dùng chung hoặc truyền giữa các bước; **Lưu workflow** ghi đồ thị và cấu hình xuống cơ sở dữ liệu. Trước khi cho phép chạy hoặc gắn trigger, **Bật / tắt workflow** (`isActive`) kiểm soát workflow có được kích hoạt hay không. Các bước trên hợp thành quy trình thiết kế workflow trực quan trên console.

### 2.2.6. Chạy task / workflow

Trong các use case ở Hình 2.1, **Chạy task / workflow** là use case phức tạp nhất vì liên quan đồng thời đến console, server điều phối, hàng đợi Redis và agent trên máy trạm. Use case này được phân rã theo pipeline xử lý, thể hiện ở Hình 2.6.

[chèn Hình 2.6 — Phân rã use case Chạy task / workflow]  
*PlantUML:* `docs/diagrams/hinh-2-6-chay-task-workflow.puml`

**Người dùng (USER)** hoặc **Hệ thống (Trigger)** thực hiện **Gửi yêu cầu chạy** — tạo task đơn lẻ hoặc khởi chạy một workflow run. Server tiếp nhận và **Xếp hàng (BullMQ)** đưa job vào hàng đợi Redis, tách bước ghi nhận yêu cầu khỏi bước phân phối. Worker **Phân phối (WebSocket)** gửi sự kiện `task:execute` tới agent đích đang online. **Agent** (bên ngoài khung use case) thực hiện **Thực thi tại agent** — gọi handler tương ứng trên Windows. Kết quả trả về được **Cập nhật kết quả và trạng thái** trong PostgreSQL, rồi **Thông báo realtime** đẩy sự kiện hoàn thành hoặc thất bại tới console. Với workflow, runtime lặp chuỗi trên cho từng bước trong đồ thị. Các use case con này hợp thành toàn bộ quy trình điều phối thực thi phân tán từ server tới máy trạm.

### 2.2.7. Cấu hình trigger (Cron · Telegram)

Use case **Cấu hình trigger (Cron · Telegram)** cho phép kích hoạt workflow tự động mà không cần thao tác thủ công trên console. Hình 2.7 trình bày phân rã.

[chèn Hình 2.7 — Phân rã use case Cấu hình trigger]  
*PlantUML:* `docs/diagrams/hinh-2-7-cau-hinh-trigger.puml`

**Người dùng (USER)** thiết lập **Tạo trigger theo lịch** với biểu thức cron, interval hoặc lịch daily để workflow chạy đúng thời điểm. Với kênh chat, **Đăng ký bot Telegram và webhook** kết nối bot tới server qua HTTPS public, nhận lệnh hoặc sự kiện từ người dùng Telegram. **Gắn trigger với workflow** xác định workflow nào được khởi chạy khi trigger kích hoạt. **Bật / tắt trigger** tạm dừng hoặc khôi phục kích hoạt tự động mà không xóa cấu hình. Các use case con này hợp thành cơ chế tự động hoá theo thời gian và theo sự kiện bên ngoài.

### 2.2.8. Xem dashboard

Use case **Xem dashboard** tổng hợp dữ liệu fleet và task thành cái nhìn nhanh, hỗ trợ giám sát hàng ngày. Hình 2.8 mô tả phân rã.

[chèn Hình 2.8 — Phân rã use case Xem dashboard]  
*PlantUML:* `docs/diagrams/hinh-2-8-xem-dashboard.puml`

**Người dùng (USER)** sử dụng **Xem thống kê số lượng agent** để nắm tổng số agent và tỷ lệ online/offline trong phạm vi quyền sở hữu. **Xem thống kê task theo trạng thái** hiển thị phân bố task theo PENDING, RUNNING, COMPLETED, FAILED… qua biểu đồ hoặc bảng tổng hợp. **Xem hoạt động gần đây** liệt kê các sự kiện mới — task hoàn thành, agent mất kết nối, workflow được kích hoạt — giúp phát hiện bất thường sớm. Ba use case con này cùng cung cấp màn hình tổng quan cho người vận hành.

### 2.2.9. Quản lý người dùng

Use case **Quản lý người dùng** dành riêng cho quản trị viên, bảo đảm kiểm soát truy cập ở cấp nền tảng. Hình 2.9 trình bày phân rã.

[chèn Hình 2.9 — Phân rã use case Quản lý người dùng]  
*PlantUML:* `docs/diagrams/hinh-2-9-quan-ly-nguoi-dung.puml`

**Quản trị viên (ADMIN)** thực hiện **Xem danh sách người dùng** để tra cứu tài khoản đang hoạt động trên hệ thống. **Khóa / mở khóa tài khoản** vô hiệu hoá hoặc khôi phục quyền truy cập khi cần (ví dụ vi phạm chính sách hoặc nghỉ phép). **Phân quyền ADMIN / USER** gán vai trò phù hợp — chỉ ADMIN mới truy cập được các chức năng quản trị. Các use case con này hợp thành cơ chế quản lý danh tính và phân quyền tập trung.

### 2.2.10. Xem nhật ký audit

Use case **Xem nhật ký audit** hỗ trợ truy vết các thao tác quan trọng trên hệ thống, phục vụ giám sát và kiểm tra tuân thủ. Hình 2.10 thể hiện phân rã.

[chèn Hình 2.10 — Phân rã use case Xem nhật ký audit]  
*PlantUML:* `docs/diagrams/hinh-2-10-xem-nhat-ky-audit.puml`

**Quản trị viên (ADMIN)** dùng **Xem danh sách sự kiện audit** để tra cứu ai thực hiện hành động gì, trên đối tượng nào và vào thời điểm nào — ví dụ tạo agent, xóa workflow, thay đổi quyền user. **Lọc theo thời gian / loại hành động** thu hẹp phạm vi khi số lượng bản ghi lớn, hỗ trợ điều tra sự cố hoặc đối soát định kỳ. Hai use case con này hợp thành chức năng giám sát và truy vết hoạt động ở cấp hệ thống.

### 2.2.11. Quy trình nghiệp vụ

Hệ thống có một quy trình nghiệp vụ xuyên suốt, kết hợp nhiều use case mức cao ở Hình 2.1 của các tác nhân khác nhau, đó là **vòng đời đưa máy trạm vào fleet và thực thi tác vụ tự động có giám sát kết quả**. Đây không phải luồng sự kiện chi tiết của từng use case (đã trình bày ở mục 2.2.2–2.2.10), mà là luồng nghiệp vụ end-to-end ghép các use case **Quản lý fleet agent**, **Quản lý task và template** hoặc **Thiết kế workflow** cùng **Chạy task / workflow**, **Cấu hình trigger (Cron · Telegram)** (khi chạy tự động) và **Xem dashboard**. Hình 2.11 minh họa quy trình này.

[chèn Hình 2.11 — Biểu đồ hoạt động quy trình nghiệp vụ vận hành agent và thực thi tác vụ]

Quy trình bắt đầu khi **người dùng (USER)** đã **đăng nhập** và thực hiện **Quản lý fleet agent**: tạo bản ghi agent trên console, cài phần mềm agent trên máy Windows và cấu hình agent key. Agent kết nối tới server; hệ thống cập nhật trạng thái **ONLINE**, cho phép giao việc tới máy trạm đó. Tiếp theo, người dùng chuẩn bị công việc theo một trong hai hướng: tạo **task đơn** (use case **Quản lý task và template**) hoặc thiết kế và bật **workflow** (use case **Thiết kế workflow**). Việc kích hoạt có thể **thủ công** (use case **Chạy task / workflow**) hoặc **tự động** khi trigger theo lịch hoặc Telegram được cấu hình (use case **Cấu hình trigger**). Server điều phối yêu cầu tới agent; agent thực thi trên máy trạm và phản hồi kết quả. Cuối cùng, người dùng **Xem dashboard** và tra cứu log để biết task/workflow **COMPLETED** hay **FAILED**, hoàn tất một vòng vận hành. Toàn bộ các bước được ghi nhận trên hệ thống, hỗ trợ theo dõi và xử lý khi agent offline hoặc thực thi lỗi.

## 2.3. Đặc tả chức năng

Sinh viên lựa chọn các use case quan trọng nhất của đồ án để đặc tả chi tiết. Mỗi đặc tả gồm mã use case, tác nhân, mô tả, sự kiện kích hoạt, tiền/hậu điều kiện, luồng sự kiện chính và luồng sự kiện thay thế. Phần dưới trình bày năm đặc tả tương ứng các use case mức cao ở Hình 2.1.

### 2.3.1. Đặc tả use case UC001 “Quản lý fleet agent”

| Mã Use case | UC001 | Tên Use case | Quản lý fleet agent |
|-------------|-------|--------------|---------------------|
| **Tác nhân** | Người dùng (USER), Quản trị viên (ADMIN) |
| **Mô tả** | Cho phép người dùng đăng ký agent Windows vào fleet, cấu hình agent key trên máy trạm và theo dõi trạng thái kết nối cùng metadata |
| **Sự kiện kích hoạt** | Sau khi người dùng mở trang Agents hoặc nhấn nút **Tạo agent** |
| **Tiền điều kiện** | Người dùng đã đăng nhập vào hệ thống |
| **Hậu điều kiện** | Bản ghi agent được lưu trong cơ sở dữ liệu; nếu agent kết nối thành công, trạng thái hiển thị **ONLINE** trên console |

**Luồng sự kiện chính (Thành công)**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng | Người dùng chọn chức năng **Agents** trên console. |
| 2. | Người dùng | Người dùng nhấn **Tạo agent**, nhập tên (và mô tả nếu có) cho máy trạm cần quản lý. |
| 3. | Hệ thống | Hệ thống sinh bản ghi agent gắn với tài khoản người dùng và trả về **agent key** (chỉ hiển thị một lần). |
| 4. | Người dùng | Người dùng cài phần mềm agent trên máy Windows và nhập agent key qua giao diện tray hoặc file cấu hình. |
| 5. | Agent | Agent khởi động, kết nối WebSocket tới server bằng agent key. |
| 6. | Hệ thống | Hệ thống xác thực agent key, cập nhật trạng thái **ONLINE**, ghi nhận metadata (OS, hostname, phiên bản agent) và thời điểm **lastSeen**. |
| 7. | Hệ thống | Hệ thống hiển thị danh sách agent với trạng thái realtime trên console. |

**Luồng sự kiện thay thế**

**A. Agent key không hợp lệ hoặc đã bị thu hồi.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 5a. | Hệ thống | Hệ thống từ chối kết nối WebSocket và ghi log lỗi xác thực. |
| 5a. | Agent | Agent hiển thị thông báo lỗi cấu hình; người vận hành cần nhập lại key hoặc tái tạo key trên console. |

**B. Agent mất kết nối sau khi đã online.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 6b. | Hệ thống | Hệ thống cập nhật trạng thái **OFFLINE** khi hết thời gian chờ heartbeat. |
| 6b. | Agent | Agent tự thử kết nối lại theo cơ chế reconnect; khi thành công, trạng thái chuyển lại **ONLINE**. |

**C. Người dùng tái tạo agent key.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| — | Người dùng | Người dùng chọn **Tái tạo agent key** trên console khi nghi key bị lộ. |
| — | Hệ thống | Hệ thống vô hiệu key cũ, sinh key mới; agent phải cấu hình lại key mới trước khi kết nối. |

---

### 2.3.2. Đặc tả use case UC002 “Chạy task”

| Mã Use case | UC002 | Tên Use case | Chạy task |
|-------------|-------|--------------|-----------|
| **Tác nhân** | Người dùng (USER), Quản trị viên (ADMIN) |
| **Mô tả** | Cho phép người dùng giao một task cho agent cụ thể; server điều phối thực thi và trả kết quả về console |
| **Sự kiện kích hoạt** | Sau khi người dùng nhấn nút **Chạy task** hoặc **Tạo và chạy** trên trang Tasks |
| **Tiền điều kiện** | Người dùng đã đăng nhập; đã chọn agent thuộc tài khoản; agent ở trạng thái **ONLINE** (hoặc task được phép xếp hàng chờ agent online) |
| **Hậu điều kiện** | Task và log thực thi được lưu trong cơ sở dữ liệu với trạng thái **COMPLETED**, **FAILED** hoặc **TIMEOUT**; console cập nhật kết quả theo thời gian thực |

**Luồng sự kiện chính (Thành công)**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng | Người dùng mở trang **Tasks**, chọn agent đích, loại task (ví dụ COMMAND, HTTP_REQUEST) và nhập payload. |
| 2. | Người dùng | Người dùng nhấn **Chạy task** để gửi yêu cầu. |
| 3. | Hệ thống | Hệ thống kiểm tra quyền sở hữu agent và lưu task với trạng thái **PENDING** / **QUEUED**. |
| 4. | Hệ thống | Hệ thống đưa job vào hàng đợi BullMQ để xử lý bất đồng bộ. |
| 5. | Hệ thống | Worker lấy job, gửi sự kiện `task:execute` qua WebSocket tới agent đang **ONLINE**. |
| 6. | Agent | Agent nhận lệnh, gọi handler tương ứng và thực thi trên máy trạm Windows. |
| 7. | Agent | Agent gửi `task:result` (kết quả hoặc lỗi) về server. |
| 8. | Hệ thống | Hệ thống cập nhật trạng thái task, ghi **TaskLog** và đẩy sự kiện realtime tới console. |
| 9. | Hệ thống | Console hiển thị trạng thái **COMPLETED** và nội dung log cho người dùng. |

**Luồng sự kiện thay thế**

**A. Agent không online tại thời điểm dispatch.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 5a. | Hệ thống | Hệ thống giữ task ở trạng thái chờ hoặc đánh dấu **FAILED** tùy cấu hình; thông báo agent offline trên console. |
| 5a. | Người dùng | Người dùng chờ agent online và **Thử lại task**, hoặc hủy task. |

**B. Task thực thi quá thời gian timeout.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 6b. | Hệ thống | Hệ thống đánh dấu task **TIMEOUT**, ghi log và thông báo lên console. |

**C. Dữ liệu task không hợp lệ.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 3c. | Hệ thống | Hệ thống từ chối yêu cầu, trả thông báo lỗi validation (thiếu agent, sai loại task, payload không hợp lệ). |
| 3c. | Người dùng | Người dùng sửa thông tin và gửi lại yêu cầu. |

**D. Người dùng hủy task đang chạy.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| — | Người dùng | Người dùng chọn **Hủy task** trên console. |
| — | Hệ thống | Hệ thống cập nhật trạng thái **CANCELLED** nếu hủy thành công. |

---

### 2.3.3. Đặc tả use case UC003 “Thiết kế workflow”

| Mã Use case | UC003 | Tên Use case | Thiết kế workflow |
|-------------|-------|--------------|-------------------|
| **Tác nhân** | Người dùng (USER), Quản trị viên (ADMIN) |
| **Mô tả** | Cho phép người dùng xây dựng quy trình tự động nhiều bước dưới dạng đồ thị trên console |
| **Sự kiện kích hoạt** | Sau khi người dùng nhấn **Tạo workflow mới** hoặc mở workflow hiện có trên trang Workflows |
| **Tiền điều kiện** | Người dùng đã đăng nhập vào hệ thống |
| **Hậu điều kiện** | Workflow (đồ thị bước và biến cấu hình) được lưu trong cơ sở dữ liệu; workflow có thể được bật (`isActive`) để chạy hoặc gắn trigger |

**Luồng sự kiện chính (Thành công)**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng | Người dùng chọn **Workflows** → **Tạo workflow mới**, nhập tên và mô tả. |
| 2. | Hệ thống | Hệ thống tạo bản ghi workflow rỗng và mở trình soạn thảo đồ thị (canvas). |
| 3. | Người dùng | Người dùng kéo thả node (bước task, delay, condition…) và nối các cạnh xác định thứ tự thực thi. |
| 4. | Người dùng | Người dùng cấu hình payload từng bước, agent đích và biến workflow dùng chung. |
| 5. | Người dùng | Người dùng nhấn **Lưu workflow**. |
| 6. | Hệ thống | Hệ thống kiểm tra đồ thị hợp lệ (có điểm bắt đầu, không có chu trình cấm nếu quy tắc yêu cầu). |
| 7. | Hệ thống | Hệ thống lưu graph, danh sách bước và biến vào cơ sở dữ liệu, hiển thị thông báo lưu thành công. |
| 8. | Người dùng | Người dùng bật trạng thái **Active** nếu muốn cho phép chạy workflow hoặc gắn trigger. |

**Luồng sự kiện thay thế**

**A. Đồ thị workflow không hợp lệ.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 6a. | Hệ thống | Hệ thống báo lỗi (thiếu node bắt đầu, bước chưa cấu hình agent, cạnh không hợp lệ…) và không lưu. |
| 6a. | Người dùng | Người dùng chỉnh sửa đồ thị và thực hiện lưu lại. |

**B. Người dùng tắt workflow đang được trigger sử dụng.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 8b. | Người dùng | Người dùng chuyển **isActive** sang tắt. |
| 8b. | Hệ thống | Hệ thống không cho phép kích hoạt chạy mới; các trigger gắn workflow vẫn tồn tại nhưng không khởi chạy workflow cho đến khi bật lại. |

---

### 2.3.4. Đặc tả use case UC004 “Chạy workflow”

| Mã Use case | UC004 | Tên Use case | Chạy workflow |
|-------------|-------|--------------|---------------|
| **Tác nhân** | Người dùng (USER), Hệ thống (Trigger) |
| **Mô tả** | Thực thi tuần tự các bước trong workflow đã thiết kế, tạo task con cho từng bước và ghi lịch sử run |
| **Sự kiện kích hoạt** | Sau khi người dùng nhấn **Chạy workflow**, hoặc trigger (lịch/Telegram) kích hoạt workflow đang **Active** |
| **Tiền điều kiện** | Workflow đã lưu, đồ thị hợp lệ, trạng thái **Active**; có ít nhất một agent **ONLINE** cho các bước cần thực thi |
| **Hậu điều kiện** | **WorkflowRun** và **WorkflowStepRun** được lưu với trạng thái **COMPLETED** hoặc **FAILED**; biến `steps.*` phản ánh kết quả từng bước |

**Luồng sự kiện chính (Thành công)**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng / Hệ thống | Người dùng chọn **Chạy workflow** hoặc trigger đến hạn gửi tín hiệu kích hoạt. |
| 2. | Hệ thống | Hệ thống tạo bản ghi **WorkflowRun** với trạng thái **RUNNING**. |
| 3. | Hệ thống | **Workflow runtime** duyệt đồ thị từ node bắt đầu, xác định bước tiếp theo. |
| 4. | Hệ thống | Với mỗi bước task, hệ thống resolve biến (`{{steps.xxx}}`, biến workflow), tạo task con và kích hoạt use case **Chạy task** (UC002). |
| 5. | Hệ thống | Hệ thống chờ kết quả bước, ghi **WorkflowStepRun**, cập nhật biến `steps.*`. |
| 6. | Hệ thống | Nếu bước là **CONDITION**, runtime rẽ nhánh theo kết quả; nếu **DELAY**, tạm dừng theo cấu hình. |
| 7. | Hệ thống | Khi duyệt hết đồ thị, hệ thống đánh dấu **WorkflowRun** là **COMPLETED** và thông báo lên console. |

**Luồng sự kiện thay thế**

**A. Một bước task thất bại và cấu hình dừng khi lỗi.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 5a. | Hệ thống | Hệ thống đánh dấu bước và **WorkflowRun** là **FAILED**, dừng các bước sau. |
| 5a. | Người dùng | Người dùng xem log trên console, sửa workflow hoặc task rồi chạy lại. |

**B. Workflow chưa bật Active.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1b. | Hệ thống | Hệ thống từ chối chạy, thông báo workflow đang tắt. |

**C. Trigger kích hoạt nhưng không có agent online.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 4c. | Hệ thống | Hệ thống ghi **TriggerExecution** / run ở trạng thái lỗi hoặc chờ; thông báo trên console khi người dùng tra cứu. |

---

### 2.3.5. Đặc tả use case UC005 “Cấu hình trigger (Cron · Telegram)”

| Mã Use case | UC005 | Tên Use case | Cấu hình trigger (Cron · Telegram) |
|-------------|-------|--------------|-------------------------------------|
| **Tác nhân** | Người dùng (USER), Quản trị viên (ADMIN) |
| **Mô tả** | Cho phép người dùng cấu hình kích hoạt workflow tự động theo lịch hoặc qua bot Telegram |
| **Sự kiện kích hoạt** | Sau khi người dùng nhấn **Tạo trigger** trên trang Triggers hoặc **Đăng ký bot Telegram** |
| **Tiền điều kiện** | Người dùng đã đăng nhập; đã có workflow **Active** cần gắn trigger; với Telegram: server có URL HTTPS public |
| **Hậu điều kiện** | Trigger được lưu và có thể bật/tắt; khi bật, hệ thống lên lịch cron hoặc nhận webhook Telegram và có thể kích hoạt use case **Chạy workflow** (UC004) |

**Luồng sự kiện chính (Thành công) — Trigger theo lịch**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng | Người dùng chọn **Triggers** → **Tạo trigger theo lịch**. |
| 2. | Người dùng | Người dùng nhập biểu thức cron (hoặc interval/daily), chọn workflow đích và bật trigger. |
| 3. | Hệ thống | Hệ thống lưu cấu hình trigger, đăng ký job lên scheduler nội bộ. |
| 4. | Hệ thống | Đến thời điểm đã cấu hình, hệ thống kích hoạt use case **Chạy workflow** (UC004) với workflow tương ứng. |

**Luồng sự kiện chính (Thành công) — Trigger Telegram**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 1. | Người dùng | Người dùng nhập bot token, đăng ký webhook Telegram trỏ về endpoint HTTPS của server. |
| 2. | Hệ thống | Hệ thống xác minh token, lưu **TelegramBot** và map lệnh/chat tới trigger — workflow. |
| 3. | Người dùng (Telegram) | Người dùng gửi lệnh hoặc tin nhắn khớp rule trên Telegram. |
| 4. | Hệ thống | Telegram gọi webhook; hệ thống verify secret, khớp trigger và gọi **Chạy workflow** (UC004) kèm biến `telegram.*`. |
| 5. | Hệ thống | Hệ thống ghi **TriggerExecution** (STARTED → COMPLETED/FAILED) và phản hồi Telegram nếu cấu hình. |

**Luồng sự kiện thay thế**

**A. Biểu thức cron không hợp lệ.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 3a. | Hệ thống | Hệ thống báo lỗi cú pháp cron, không lưu trigger. |
| 3a. | Người dùng | Người dùng sửa biểu thức và lưu lại. |

**B. Webhook Telegram không xác thực được.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| 4b. | Hệ thống | Hệ thống từ chối request webhook (sai secret/token), ghi log bảo mật. |

**C. Người dùng tắt trigger.**

| STT | Thực hiện bởi | Hành động |
|-----|---------------|-----------|
| — | Người dùng | Người dùng chuyển trigger sang trạng thái **Tắt**. |
| — | Hệ thống | Hệ thống ngừng lên lịch cron hoặc bỏ qua webhook tương ứng; cấu hình vẫn được giữ để bật lại sau. |

## 2.4. Yêu cầu phi chức năng

Ngoài các yêu cầu chức năng đã đặc tả ở mục 2.3, hệ thống cần đáp ứng các yêu cầu phi chức năng (Non-Functional Requirements — NFR) nhằm bảo đảm chất lượng vận hành thực tế: phản hồi nhanh trên console, duy trì kết nối agent ổn định, bảo vệ dữ liệu và phân quyền, chịu lỗi khi mạng hoặc máy trạm gián đoạn, đồng thời thuận tiện triển khai và mở rộng. Các yêu cầu dưới đây được rút ra từ kết quả khảo sát (mục 2.1), đặc tả use case (mục 2.3) và ràng buộc kỹ thuật của kiến trúc agent–server đã chọn.

### 2.4.1. Hiệu năng

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-P01 | Thời gian phản hồi API truy vấn | Endpoint kiểm tra sức khỏe (`/api/health`) và các API đọc danh sách (agent, task) phản hồi trong **≤ 2 giây** ở điều kiện tải bình thường trên production | Đo trên Railway khi DB/Redis managed sẵn sàng |
| NFR-P02 | Thời gian dispatch task | Sau khi user gửi yêu cầu chạy task, job được đưa vào hàng đợi và worker bắt đầu dispatch trong **≤ 5 giây** khi agent **ONLINE** | BullMQ tách enqueue khỏi WebSocket |
| NFR-P03 | Cập nhật trạng thái realtime | Khi agent trả kết quả, console nhận sự kiện **COMPLETED/FAILED** qua WebSocket trong **≤ 3 giây** sau khi server ghi DB | Socket.IO namespace `/ws/client` |
| NFR-P04 | Xử lý song song task | Worker server xử lý đồng thời tối thiểu **10** job dispatch (cấu hình `TASK_WORKER_CONCURRENCY`); mỗi agent chạy song song **1–32** task (`TASK_MAX_CONCURRENCY`) | Tránh nghẽn khi nhiều workflow nhánh |
| NFR-P05 | Giới hạn output task | Một task shell không trả về quá **1 MB** stdout/stderr (`MAX_OUTPUT_BYTES`) | Bảo vệ bộ nhớ server và agent |
| NFR-P06 | Timeout thực thi | Mặc định **300 giây** (5 phút) cho task; có thể cấu hình theo từng task (`timeout` trong CSDL) | Agent `COMMAND_TIMEOUT_MS` đồng bộ |

### 2.4.2. Khả dụng và tính sẵn sàng

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-A01 | Heartbeat agent | Agent gửi heartbeat định kỳ **~30 giây**; server cập nhật `lastSeenAt` tối đa mỗi 30 giây | `HEARTBEAT_INTERVAL_MS` mặc định 30 000 |
| NFR-A02 | Phát hiện offline | Agent không heartbeat trong **~2 phút** được đánh dấu **OFFLINE** (cron kiểm tra mỗi phút) | Tránh hiển thị sai trạng thái online |
| NFR-A03 | Tự kết nối lại | Agent tự **reconnect** WebSocket sau mất mạng hoặc server khởi động lại, không cần cài đặt lại | Rust client + backoff |
| NFR-A04 | Hàng đợi khi agent offline | Task tạo khi agent offline được giữ **PENDING/QUEUED**; dispatch lại khi agent online (hoặc báo lỗi rõ ràng nếu không gửi được) | Luồng TC-04 kiểm thử |
| NFR-A05 | Thời gian hoạt động production | API và WebSocket triển khai trên nền tảng cloud (Railway) với health check; console tĩnh trên Firebase Hosting | Tách tầng trình bày và ứng dụng |

### 2.4.3. Bảo mật

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-S01 | Xác thực người dùng | Console dùng **JWT**: access token (~15 phút), refresh token (~7 ngày); mật khẩu băm **bcrypt** (cost 10) | Passport JWT + refresh flow |
| NFR-S02 | Phân quyền RBAC | Hai vai trò **USER** và **ADMIN**; API quản trị (user, audit) chỉ ADMIN; mọi API nghiệp vụ kiểm tra `userId` sở hữu agent/task/workflow | Guard `@Roles()` |
| NFR-S03 | Xác thực agent | Agent kết nối WebSocket bằng **agent key** duy nhất; key sai bị từ chối; hỗ trợ **tái tạo key** khi lộ | Không dùng JWT cho agent |
| NFR-S04 | Cách ly dữ liệu | User chỉ truy cập agent, task, workflow thuộc tài khoản mình (truy vấn Prisma có `where userId`) | Multi-tenant theo user |
| NFR-S05 | CORS và origin | Chỉ cho phép origin console đã cấu hình (`CORS_ORIGINS`) | Production: domain Firebase Hosting |
| NFR-S06 | Giới hạn tần suất API | Rate limit toàn cục: **100 request / 60 giây** / IP (`THROTTLE_TTL`, `THROTTLE_LIMIT`) | `@nestjs/throttler` |
| NFR-S07 | Webhook Telegram | Verify secret token trên webhook HTTPS; từ chối request không hợp lệ | `PUBLIC_API_BASE_URL` bắt buộc HTTPS |
| NFR-S08 | Nhật ký audit | Ghi audit các thao tác nhạy cảm: đăng nhập, đăng ký, thay đổi quyền, thao tác quản trị | Bảng `AuditLog`, ADMIN tra cứu |
| NFR-S09 | Bảo mật agent key | Agent key chỉ hiển thị **một lần** khi tạo/tái tạo trên console; lưu trên máy trạm tại `%ProgramData%\...\agent.env` | Không ghi key vào log công khai |

### 2.4.4. Tin cậy và xử lý lỗi

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-R01 | Retry task | Task thất bại có thể retry tối đa **3 lần** mặc định (`maxRetries`); tăng `retryCount` mỗi lần thử | Cấu hình per-task |
| NFR-R02 | Trạng thái task rõ ràng | Mọi task đi qua vòng đời: **PENDING → QUEUED → RUNNING → COMPLETED / FAILED / TIMEOUT / CANCELLED** | Enum `TaskStatus` |
| NFR-R03 | Ghi log thực thi | Mỗi task lưu **TaskLog** (INFO/WARN/ERROR) để truy vết stdout, lỗi agent, lỗi dispatch | Phục vụ debug và báo cáo |
| NFR-R04 | Workflow khi lỗi bước | Nếu bước task trong workflow **FAILED** và cấu hình dừng, **WorkflowRun** chuyển **FAILED**, không chạy bước sau | Runtime `onFailure` |
| NFR-R05 | Trigger execution | Mỗi lần trigger kích hoạt ghi **TriggerExecution** (STARTED → COMPLETED/FAILED) | Tra cứu lịch sử tự động hóa |
| NFR-R06 | Toàn vẹn dữ liệu | Quan hệ User–Agent–Task–Workflow có **foreign key** và `onDelete: Cascade` hợp lý; migration qua Prisma | PostgreSQL ACID |

### 2.4.5. Khả năng mở rộng

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-SC01 | Kiến trúc module | Backend NestJS tách module (`auth`, `agents`, `tasks`, `automation`, `triggers`…); thêm chức năng không ảnh hưởng module khác | Dependency injection |
| NFR-SC02 | Hàng đợi tách biệt | BullMQ trên Redis cho phép scale worker hoặc tách process worker sau này | Hiện chạy trong cùng Nest process |
| NFR-SC03 | Fleet agent | Hỗ trợ **N agent** Windows độc lập; mỗi user quản lý fleet riêng | Gateway room `agent:{id}` |
| NFR-SC04 | Mở rộng loại task | Agent Rust dùng **TaskRegistry** — thêm handler mới không sửa core dispatch | COMMAND, HTTP_REQUEST, OPEN_APP, … |
| NFR-SC05 | Index CSDL | Index trên `status`, `userId`, `agentId`, `nextRunAt` (trigger) để truy vấn dashboard và scheduler | Prisma schema |

### 2.4.6. Tính dễ sử dụng

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-U01 | Giao diện thống nhất | Console SPA: sidebar, bảng có lọc/phân trang, toast lỗi/thành công, hỗ trợ **tiếng Việt** | React + i18n `vi.ts` |
| NFR-U02 | Dashboard tổng quan | Một màn hình thể hiện số agent online/offline, thống kê task theo trạng thái, hoạt động gần đây | Use case *Xem dashboard* |
| NFR-U03 | Workflow trực quan | Editor đồ thị kéo thả (React Flow), không bắt user viết JSON graph thủ công | Canvas + form cấu hình bước |
| NFR-U04 | Agent tray Windows | Cài đặt agent key, xem trạng thái kết nối qua **system tray** Electron; không bắt sửa file thủ công | `agent/desktop` |
| NFR-U05 | Phản hồi realtime | Không bắt user reload trang để biết task hoàn thành | Push qua Socket.IO |

### 2.4.7. Khả năng bảo trì và quan sát

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-M01 | Migration CSDL | Thay đổi schema qua **Prisma migrate**; không sửa DB tay trên production | Version-controlled SQL |
| NFR-M02 | Tài liệu API | Swagger mở tại **`/api/docs`** mô tả REST endpoint, DTO, mã lỗi | NestJS `@nestjs/swagger` |
| NFR-M03 | Ngôn ngữ thống nhất | Server và console admin dùng **TypeScript**; agent core **Rust** — ranh giới rõ qua WebSocket protocol | Giảm lỗi tích hợp |
| NFR-M04 | Logging | Server log cấu trúc (Pino); mức log cấu hình qua biến môi trường | Hỗ trợ debug production |
| NFR-M05 | Kiểm thử | Unit test (Jest) cho module auth và luồng nghiệp vụ trọng yếu; checklist E2E mục 4.4 | CI có thể mở rộng |

### 2.4.8. Triển khai và môi trường

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-D01 | Dev local | **Docker Compose** chạy PostgreSQL 16 + Redis 7; server + admin chạy npm script | README hướng dẫn |
| NFR-D02 | Production cloud | API/WebSocket trên **Railway**; PostgreSQL và Redis managed; console **Firebase Hosting** (HTTPS) | WSS cho agent |
| NFR-D03 | Agent Windows | Build `agent-native.exe` + Electron tray; cấu hình qua file env hoặc UI | NSIS installer tùy chọn |
| NFR-D04 | Biến môi trường | Cấu hình tập trung qua `.env` / biến Railway; không hardcode secret trong mã nguồn | `.env.example` làm mẫu |
| NFR-D05 | Health check | Endpoint health cho load balancer / Railway probe | `/api/health` |

### 2.4.9. An toàn vận hành trên máy trạm

| ID | Yêu cầu | Tiêu chí / mức mong đợi | Ghi chú triển khai |
|----|---------|-------------------------|-------------------|
| NFR-AG01 | Desktop automation | Tính năng điều khiển desktop (chuột/phím) **tắt mặc định**; chỉ bật trên máy tin cậy | `DESKTOP_AUTOMATION_ENABLED=false` |
| NFR-AG02 | Giới hạn automation | Số bước automation tối đa **200**; delay tối đa **60 s**/bước; số ký tự gõ tối đa **8000** | Tránh vòng lặp vô hạn |
| NFR-AG03 | Chỉ Windows | Agent production nhắm **Windows 10/11**; task shell mặc định **PowerShell** | Phạm vi đồ án |

### 2.4.10. Tóm tắt ánh xạ yêu cầu — giải pháp

Các yêu cầu phi chức năng trên được hiện thực chủ yếu bởi: **NestJS + PostgreSQL/Prisma** (bảo mật, toàn vẹn dữ liệu), **Redis/BullMQ** (hiệu năng dispatch, retry), **Socket.IO** (realtime, heartbeat), **React SPA** (dễ dùng), **Rust agent + Electron** (thực thi tại chỗ, giới hạn an toàn). Chi tiết triển khai và kết quả kiểm thử tương ứng được trình bày lại ở Chương 3 (công nghệ), mục 4.4 (kiểm thử) và mục 4.5 (triển khai production).

---

# Chương 3. Công nghệ sử dụng

Chương này trình bày các công nghệ và nền tảng được sử dụng để hiện thực hệ thống theo định hướng giải pháp ở mục 1.3, nhằm đáp ứng yêu cầu chức năng và phi chức năng đã phân tích ở Chương 2. Khác với Chương 4 — nơi tập trung vào thiết kế chi tiết, sơ đồ kiến trúc và minh họa triển khai — Chương 3 đặt trọng tâm vào *lý do chọn* từng công nghệ: bản chất kỹ thuật, vai trò trong hệ sinh thái phần mềm hiện đại, mối liên hệ trực tiếp với use case và tiêu chí phi chức năng đã nêu, cùng so sánh có hệ thống với các phương án thay thế khả thi. Cách trình bày theo từng lớp kiến trúc (backend, dữ liệu, hàng đợi, realtime, frontend, agent, bảo mật, vận hành) giúp người đọc vừa nắm bức tranh tổng thể vừa hiểu vì sao stack agent–server của đồ án không phải là ghép ngẫu nhiên mà là kết quả của ánh xạ có chủ đích từ yêu cầu nghiệp vụ sang quyết định kỹ thuật.

Với từng nhóm công nghệ, báo cáo mở đầu bằng phần giới thiệu về bản chất và vai trò phổ biến của công nghệ đó trong các hệ thống tương tự; tiếp theo phân tích yêu cầu cụ thể mà đồ án cần giải quyết (tham chiếu mã use case UC001–UC005 và các nhóm NFR ở mục 2.4), các phương án thay thế có thể cân nhắc và lý do lựa chọn cuối cùng, kèm trích dẫn tài liệu gốc [1]–[18]. Nội dung mang tính tổng hợp có chiều sâu — đủ dài để độc lập đọc như một chương công nghệ trong báo cáo tốt nghiệp (~10 trang A4 Word) — trong khi chi tiết triển khai mã nguồn, biểu đồ sequence và kết quả kiểm thử trình bày ở Chương 4 và Chương 5.

Bảng 3.1 tổng hợp ánh xạ giữa nhóm yêu cầu Chương 2 và công nghệ tương ứng, làm khung tra cứu nhanh trước khi đi vào từng mục chi tiết.

**Bảng 3.1 — Ánh xạ yêu cầu Chương 2 và công nghệ lựa chọn**

| Yêu cầu (Ch. 2) | Công nghệ | Mục |
|-----------------|-----------|-----|
| UC001 Quản lý fleet agent; NFR-A01–A03 (heartbeat, reconnect) | NestJS, Socket.IO, PostgreSQL | 3.1, 3.2, 3.4 |
| UC002–UC004 Chạy task/workflow; NFR-P02, P04, R01 (hàng đợi, retry) | NestJS, BullMQ, Redis | 3.1, 3.3 |
| UC003 Thiết kế workflow; NFR-U03 | React, React Flow | 3.5 |
| UC005 Trigger cron/Telegram | NestJS Schedule, webhook HTTPS | 3.1, 3.8 |
| NFR-S01–S04 (JWT, RBAC, cách ly dữ liệu) | Passport JWT, Prisma, bcrypt | 3.1, 3.2, 3.7 |
| NFR-U01, U05 (console, realtime) | React SPA, socket.io-client | 3.5, 3.4 |
| Thực thi tại máy Windows; NFR-AG01–AG03 | Rust, Electron | 3.6 |
| NFR-D01–D05 (dev local, production cloud) | Docker Compose, Railway, Firebase Hosting | 3.8 |

## 3.0. Tổng quan kiến trúc công nghệ

Hệ thống đồ án được tổ chức theo mô hình **agent–server** ba tầng đã giới thiệu ở mục 1.3: tầng **presentation** (console quản trị web), tầng **application** (server NestJS điều phối nghiệp vụ, worker hàng đợi, gateway WebSocket, scheduler trigger) và tầng **execution** (agent Windows trên máy trạm). Ba tầng giao tiếp qua REST/HTTPS cho thao tác quản trị có cấu trúc (CRUD agent, task, workflow, trigger), qua WebSocket/WSS cho luồng lệnh thực thi và cập nhật trạng thái thời gian thực, và qua hàng đợi nội bộ (BullMQ trên Redis) để tách bước “ghi nhận yêu cầu” khỏi bước “phân phối tới agent” — mô hình then chốt đáp ứng NFR-P02 và NFR-R01. Dữ liệu nghiệp vụ bền vững nằm trên PostgreSQL; Redis chỉ giữ trạng thái hàng đợi và job tạm thời, không thay thế CSDL quan hệ.

Phân tách trách nhiệm giữa các công nghệ có thể hình dung theo luồng nghiệp vụ điển hình (mục 2.2.11): người vận hành tương tác React SPA → NestJS xác thực JWT, ghi Task/WorkflowRun vào PostgreSQL qua Prisma → enqueue job BullMQ → worker gọi Socket.IO namespace `/ws/agent` gửi `task:execute` → agent Rust thực thi và trả `task:result` → server cập nhật trạng thái, push sự kiện qua `/ws/client` tới console. Mỗi công nghệ trong chuỗi đảm nhiệm một “điểm nghẽn” được thiết kế có chủ đích: NestJS gom REST + WS + worker trong một process deployable (NFR-SC01); PostgreSQL đảm bảo toàn vẹn quan hệ User–Agent–Task–Workflow; BullMQ chịu tải burst khi nhiều task phát sinh đồng thời; Socket.IO duy trì kết nối lâu dài với cơ chế reconnect; Rust/Electron thực thi tại chỗ trên Windows với footprint phù hợp máy trạm. Các mục 3.1–3.8 lần lượt làm rõ từng lớp; Bảng 3.1 là bản đồ tra cứu nhanh giữa yêu cầu Chương 2 và mục tương ứng.

Về triển khai, môi trường phát triển dùng Docker Compose khởi tạo PostgreSQL và Redis cục bộ (NFR-D01); production tách frontend tĩnh (Firebase Hosting) và backend động (Railway) kèm PostgreSQL/Redis managed — kiến trúc phù hợp quy mô đồ án, chi phí thấp và vẫn đáp ứng HTTPS/WSS (NFR-D02, S07). Agent Windows cài qua installer Electron, kết nối server production qua agent key riêng, không phụ thuộc cùng cơ chế JWT với console — phản ánh yêu cầu bảo mật dual-auth ở NFR-S03. Toàn bộ stack dùng TypeScript ở phía server và console (NestJS, React, Prisma client) ngoại trừ lõi agent Rust, tạo sự thống nhất ngôn ngữ giúp giảm chi phí bảo trì so với stack đa ngôn ngữ rời rạc (Java backend + Python agent + PHP admin chẳng hạn).

## 3.1. Nền tảng backend — NestJS

**NestJS** là framework mã nguồn mở xây dựng ứng dụng server-side bằng TypeScript, lấy cảm hứng từ kiến trúc Angular: tổ chức code theo **module**, **controller**, **service** và sử dụng **dependency injection** (DI) để quản lý phụ thuộc giữa các thành phần [1]. NestJS chạy trên nền Node.js, tận dụng mô hình I/O không chặn (non-blocking) của event loop — phù hợp API phục vụ nhiều kết nối đồng thời, WebSocket dài hạn và enqueue job mà không block luồng chính. Framework cung cấp hệ sinh thái package chính thức (`@nestjs/passport`, `@nestjs/bullmq`, `@nestjs/schedule`, `@nestjs/websockets`, `@nestjs/throttler`…) giúp tích hợp nhanh xác thực, hàng đợi, lập lịch, WebSocket và rate limiting trong cùng một cấu trúc dự án nhất quán, thay vì phải tự ghép hàng chục middleware rời như trên Express thuần.

Trong bối cảnh đồ án, server đóng vai trò trung tâm điều phối toàn bộ nghiệp vụ đã mô tả ở Chương 2: cung cấp API REST cho các use case từ đăng nhập, quản lý agent, task, workflow, trigger, dashboard và audit; đồng thời chạy worker xử lý hàng đợi (`TasksProcessor`), gateway WebSocket (`AgentsGateway`) và scheduler cron/Telegram (`TriggersModule`) trong cùng một ứng dụng deployable (NFR-SC01, NFR-M03). Kiến trúc module hóa cho phép ánh xạ trực tiếp: `AuthModule` phục vụ đăng nhập/đăng ký; `AgentsModule` quản lý fleet và heartbeat; `TasksModule` + queue BullMQ phục vụ chạy task; `AutomationModule` thực thi workflow runtime; `TriggersModule` cấu hình kích hoạt; `AdminModule` tổng hợp dashboard và audit. Ranh giới module giúp giới hạn phạm vi thay đổi khi mở rộng — ví dụ thêm loại trigger mới chủ yếu chạm `TriggersModule` mà không lan sang toàn bộ codebase.

Các phương án thay thế thường gặp gồm **Express.js** — tối giản, linh hoạt nhưng thiếu khung module/DI khi số lượng chức năng và gateway tăng; **Spring Boot** — mạnh ở hệ sinh thái doanh nghiệp Java, hỗ trợ sẵn JPA và security nhưng tách biệt ngôn ngữ với frontend React/TypeScript; **FastAPI** — hiệu năng tốt cho Python, phù hợp ML/API nhẹ nhưng lệch stack so với console React và yêu cầu tích hợp BullMQ/Socket.IO qua wrapper không chính thống; **Go (Gin/Fiber)** — concurrency mạnh nhưng thiếu hệ sinh thái ORM/workflow tương đương Prisma trong cùng ngôn ngữ với frontend. Với đồ án cần vừa REST vừa WS vừa worker vừa cron trong một repo TypeScript, NestJS nằm ở điểm cân bằng giữa cấu trúc và tốc độ phát triển.

Đồ án lựa chọn **NestJS 11** [1]. So với Express thuần, NestJS chuẩn hóa ranh giới controller/service, giảm rủi ro “spaghetti code” khi dự án mở rộng sang workflow graph và trigger đa kênh. So với Spring Boot, stack Node **chia sẻ ngôn ngữ TypeScript với console React**, thuận tiện bảo trì, chia sẻ kiểu dữ liệu (DTO) và phù hợp workload I/O nhiều (WebSocket, enqueue task, gọi Prisma) hơn CPU-bound nặng. NestJS tích hợp sẵn **Swagger** qua decorator (`@ApiTags`, `@ApiBearerAuth`) — đáp ứng NFR-M02 tài liệu hóa API tại `/api/docs`; **Jest** là runner test mặc định (NFR-M05). Module `ThrottlerModule` giới hạn tần suất request đăng nhập và API nhạy cảm (100 request/60 giây trên một số endpoint admin), góp phần chống brute-force bổ sung cho bcrypt và JWT.

Trên production **Railway** [16], ứng dụng NestJS chạy dưới dạng container với biến môi trường tập trung (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `TASK_WORKER_CONCURRENCY`…), health check HTTP và TLS termination do nền tảng cung cấp — phù hợp NFR-D02 triển khai cloud mà không tự quản reverse proxy. Quyết định gom worker BullMQ trong cùng process với API (thay vì tách microservice worker riêng) phản ánh quy mô đồ án và NFR-SC01: một artifact deploy, dễ debug; hướng mở rộng dài hạn (scale-out worker) được ghi nhận ở Chương 6 mà không làm phức tạp hóa kiến trúc ban đầu. NestJS, vì vậy, không chỉ là “framework web” mà là lớp điều phối nghiệp vụ gắn kết toàn bộ stack backend mà mục 1.3 đã định hướng.

## 3.2. Cơ sở dữ liệu — PostgreSQL và Prisma ORM

**PostgreSQL** là hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) mã nguồn mở, hỗ trợ SQL chuẩn, giao dịch ACID và ràng buộc toàn vẹn (primary key, foreign key, unique, check, index) [9]. PostgreSQL được dùng rộng rãi cho ứng dụng web và hệ thống doanh nghiệp nhờ khả năng biểu diễn dữ liệu có cấu trúc phức tạp, truy vấn join hiệu quả, hỗ trợ JSONB cho metadata linh hoạt và hệ sinh thái công cụ mature (backup, replication, extension). **Prisma** là ORM thế hệ mới cho TypeScript/Node.js: developer khai báo schema trong file `schema.prisma`, Prisma sinh migration SQL và **Prisma Client** type-safe — mỗi truy vấn gắn kiểu dữ liệu tại thời điểm biên dịch, giảm lỗi runtime do sai tên cột hoặc kiểu [2].

Dữ liệu nghiệp vụ của hệ thống mang tính quan hệ chặt và có lịch sử: `User` sở hữu `Agent`; `Agent` nhận `Task`; `User` thiết kế `Workflow` gồm nhiều `WorkflowStep` nối qua `WorkflowEdge`; `Trigger` gắn `Workflow` và sinh `WorkflowRun` cùng chuỗi `StepRun` ghi trạng thái từng bước (UC001–UC005). Yêu cầu phi chức năng đòi hỏi toàn vẹn dữ liệu qua foreign key (NFR-R06): không thể xóa agent đang có task pending mà không xử lý cascade có kiểm soát; dashboard và audit đọc aggregate theo `userId` (NFR-S04) — mọi service Prisma lọc theo chủ sở hữu, tránh lộ dữ liệu chéo tenant. Trường `metadata` kiểu JSON trên Agent lưu snapshot telemetry từ heartbeat (CPU, RAM, hostname…) phục vụ giám sát khi agent offline — PostgreSQL JSONB index hỗ trợ truy vấn mở rộng sau này mà không phá vỡ mô hình quan hệ cốt lõi.

**MongoDB** linh hoạt schema document, phù hợp log hoặc event stream nhưng kém thuận tiện khi cần join và ràng buộc giữa workflow steps, run history và trigger execution — các truy vấn “workflow X bước Y thuộc user Z” trở nên cồng kềnh và dễ mất toàn vẹn nếu không tự implement transaction ứng dụng. **MySQL/MariaDB** vẫn là lựa chọn quan hệ phổ biến, tương đương PostgreSQL cho CRUD cơ bản; PostgreSQL được ưu tiên nhờ JSONB, enum type native (`AgentStatus`, `TaskStatus`…) và hỗ trợ tốt trên các dịch vụ managed cloud mà đồ án dùng. **TypeORM** hoặc **Knex** + SQL thuần là cách truy cập dữ liệu thay thế trên Node; TypeORM decorator-based dễ lệch schema khi team nhỏ; SQL thuần type-safe kém hơn Prisma.

Đồ án dùng **PostgreSQL 16** [9] kết hợp **Prisma 6** [2]. PostgreSQL đảm bảo giao dịch tin cậy khi cập nhật trạng thái task (`PENDING` → `RUNNING` → `COMPLETED`/`FAILED`), ghi `AuditLog` và lịch sử workflow đồng thời — rollback transaction nếu bất kỳ bước ghi nào thất bại. Prisma migration (`prisma migrate dev` / `deploy`) version hóa thay đổi schema (bảng Trigger, WorkflowRun, StepRun…) và đồng bộ giữa môi trường dev Docker và production managed — giảm lỗi “schema lệch môi trường” (NFR-M04). Entity Task mang `maxRetries` mặc định 3 và `timeout` mặc định 300000 ms (5 phút), phản ánh trực tiếp NFR-R01/R02 trong schema, không chỉ trong code ứng dụng.

So với TypeORM, Prisma gọn, tài liệu rõ, CLI mạnh (`prisma studio` hỗ trợ debug dữ liệu dev) và tích hợp tốt với TypeScript trong NestJS qua `PrismaService` inject toàn cục — phù hợp quy mô và nhịp phát triển đồ án. Prisma không thay thế việc thiết kế index: các trường `userId`, `agentId`, `status`, `createdAt` được index để dashboard và danh sách task phân trang đáp ứng NFR-P01. Chi tiết sơ đồ E-R và danh sách bảng trình bày ở mục 4.2; Chương 3 khẳng định lựa chọn PostgreSQL/Prisma là nền tảng lưu trữ bền vững, có ràng buộc, ánh xạ trực tiếp mô hình nghiệp vụ agent–server đã phân tích ở Chương 2.

## 3.3. Hàng đợi — Redis và BullMQ

**Redis** (Remote Dictionary Server) là kho lưu trữ key-value in-memory, hỗ trợ cấu trúc dữ liệu như string, list, set, sorted set, hash và cơ chế pub/sub với độ trễ microsecond–millisecond [10]. Redis thường được dùng làm cache session, rate limiter, distributed lock hoặc **backend cho hàng đợi message** — vai trò cuối quan trọng với đồ án vì task dispatch không đồng bộ với HTTP request. **BullMQ** là thư viện hàng đợi job cho Node.js xây trên Redis, cung cấp khái niệm queue, worker, job lifecycle (waiting → active → completed/failed), retry với backoff, delayed job, concurrency limit và event hook — phù hợp xử lý tác vụ bất đồng bộ tách khỏi luồng request HTTP [3].

Pipeline chạy task/workflow của đồ án gồm hai pha tách biệt: (1) **ghi nhận** — API REST nhận yêu cầu chạy task, validate quyền, ghi bản ghi Task/`WorkflowRun` vào PostgreSQL, trả response nhanh cho console; (2) **phân phối** — worker BullMQ lấy job, gọi gateway Socket.IO gửi `task:execute` tới agent đích, chờ `task:result` hoặc timeout. Use case UC002, UC004 và các yêu cầu NFR-P02 (xử lý song song), P04 (enqueue không block UI), R01 (retry khi lỗi mạng/agent bận) được thiết kế xoay quanh tách hai pha này. Xử lý đồng bộ trong request HTTP — giữ connection mở đến khi agent trả kết quả — dễ làm treo API, vượt timeout reverse proxy (Railway/nginx) và không scale khi fleet có hàng chục agent cùng nhận lệnh.

Các phương án thay thế gồm **RabbitMQ** (AMQP, routing phức tạp, phù hợp enterprise messaging); **Apache Kafka** (event log phân vùng, throughput cực cao, nhưng vận hành và consumer group phức tạp cho quy mô đồ án); **Redis List + LPOP tự viết** (tối giản nhưng thiếu retry, dead-letter, monitoring sẵn); **PostgreSQL SKIP LOCKED** làm queue (không cần Redis nhưng tải write/read CSDL tăng, kém phù hợp burst). Với throughput vài chục đến vài trăm task/phút, một queue BullMQ trên Redis managed là đủ và chi phí vận hành thấp.

**Redis 7** [10] làm backend cho **BullMQ** [3]. Worker NestJS (`TasksProcessor`, decorator `@Processor`) lấy job từ queue `tasks`, gọi service dispatch qua gateway; **concurrency** cấu hình qua biến môi trường `TASK_WORKER_CONCURRENCY` (mặc định 10) — nghĩa là tối đa mười job dispatch song song trong một process worker, cân bằng giữa NFR-P02 và tài nguyên Railway. Cơ chế retry BullMQ khớp trường `maxRetries` trên entity Task (mặc định 3): job thất bại re-enqueue theo policy, tránh mất task khi agent tạm offline (NFR-A03 reconnect). Timeout thực thi task (300 giây) được enforce ở tầng automation/agent, đồng bộ với cột `timeout` trong schema.

Trên production, **Redis Cloud** [18] cung cấp Redis managed (TLS, backup, monitoring cơ bản), giảm gánh nặng tự cài trên VPS — vẫn tương thích BullMQ qua connection string `REDIS_URL`. Dev local dùng container Redis trong Docker Compose cùng PostgreSQL (NFR-D01). Lựa chọn Redis+BullMQ trực tiếp hiện thực mô hình “enqueue → dispatch” đã nêu ở mục 1.3 và quy trình nghiệp vụ 2.2.11; chi tiết sequence diagram dispatch trình bày ở Chương 4, còn thuật toán tách enqueue khỏi dispatch và xử lý agent offline tại worker được phân tích ở **mục 5.2**.

## 3.4. Giao tiếp thời gian thực — Socket.IO

**WebSocket** là giao thức truyền thông full-duplex trên một kết nối TCP dài hạn (RFC 6455), cho phép server và client chủ động gửi message mà không cần client polling HTTP liên tục — giảm overhead header và độ trễ so với mô hình request–response lặp lại. **Socket.IO** là thư viện realtime trên nền WebSocket (kèm fallback long-polling khi proxy/firewall chặn upgrade WS), bổ sung **room**, **namespace**, reconnect tự động, acknowledgment và tương thích trình duyệt/agent đa dạng [4]. Socket.IO được dùng rộng rãi cho dashboard live, chat, game multiplayer và **điều phối thiết bị/edge agent** — các bài toán cần duy trì trạng thái kết nối lâu dài và push sự kiện hai chiều.

Hệ thống đồ án có hai luồng realtime tách biệt về mặt bảo mật và giao thức ứng dụng: (1) **agent Windows** duy trì kết nối với server để nhận lệnh thực thi, gửi heartbeat và trả kết quả task; (2) **console web** nhận cập nhật trạng thái task/workflow và trạng thái online/offline agent ngay khi có sự kiện, không cần reload trang. Yêu cầu NFR-A01, A02 (heartbeat định kỳ, phát hiện offline sau khoảng thời gian không có tín hiệu), NFR-P03 (push kết quả task) và U05 (phản hồi giao diện realtime) đặt ra ở tầng giao tiếp này. Agent gửi heartbeat; server cập nhật `lastSeenAt` tối đa mỗi 30 giây vào PostgreSQL; cron nội bộ đánh dấu `OFFLINE` nếu `lastSeenAt` cũ hơn khoảng 120 giây — số liệu triển khai khớp NFR-A01/A02. Khi socket reconnect sau mất mạng, gateway đồng bộ lại trạng thái `ONLINE` và có thể push tới console qua namespace client.

Polling HTTP định kỳ (mỗi 5 giây gọi GET `/agents`) tốn băng thông, tăng tải server và vẫn có độ trễ phát hiện offline; **WebSocket thuần** (`ws`) nhẹ hơn Socket.IO nhưng thiếu fallback và room abstraction; **gRPC streaming** mạnh cho microservice nội bộ nhưng kém thuận tiện cho trình duyệt và agent Electron/Rust client; **MQTT** phổ biến IoT nhưng không phải mặc định trên web admin. Với yêu cầu vừa agent desktop vừa SPA browser, Socket.IO là điểm cân bằng.

Đồ án chọn **Socket.IO** [4] qua `@nestjs/platform-socket.io`, tổ chức **hai namespace** tách biệt: `/ws/agent` — agent xác thực bằng **agent key** trong handshake, join room `agent:{id}`, nhận event `task:execute`, gửi `task:result`, `agent:heartbeat` và telemetry; `/ws/client` — console xác thực JWT, join room theo `user:{userId}`, nhận `task:completed`, `task:failed`, `agent:status`… Mô hình room theo agent id thuận tiện dispatch đúng máy trạm mà không broadcast toàn fleet. Gateway xử lý race reconnect (socket cũ disconnect sau socket mới) để tránh ghi `OFFLINE` nhầm khi agent flapping mạng — chi tiết thuật toán trình bày Chương 5.

So với WebSocket thuần, Socket.IO hỗ trợ **fallback transport** khi môi trường doanh nghiệp chặn upgrade WS, và **reconnect** với backoff — quan trọng khi agent chạy trên mạng Wi-Fi không ổn định. Client phía console dùng `socket.io-client` kết hợp TanStack Query: REST nạp dữ liệu ban đầu, socket merge delta trạng thái (NFR-U05). Production triển khai **WSS** (TLS) trên cùng domain Railway với REST — đáp ứng NFR-S07. Socket.IO là công nghệ then chốt hiện thực mô hình agent–server realtime ở mục 1.3; không thay thế PostgreSQL (trạng thái bền) hay BullMQ (hàng đợi), mà bổ sung kênh low-latency cho lệnh và thông báo.

## 3.5. Giao diện quản trị — React SPA

**React** là thư viện JavaScript (mã nguồn mở, do Meta phát triển) để xây giao diện người dùng theo mô hình **component** — giao diện chia thành cây component tái sử dụng, state quản lý qua hooks (`useState`, `useEffect`, `useContext`…), cập nhật DOM hiệu quả qua Virtual DOM và reconciliation [5]. **Single Page Application (SPA)** tải một lần shell HTML/JS, điều hướng route phía client bằng React Router, tránh reload toàn trang khi chuyển màn hình. **Vite** là công cụ build frontend thế hệ mới (ESM-native dev server, Rollup bundle production), khởi động nhanh hơn Webpack truyền thống — phù hợp vòng lặp dev ngắn của đồ án.

Trong hệ sinh thái React của đồ án, **TanStack Query** (React Query) quản lý cache, stale time, refetch và trạng thái loading/error cho dữ liệu REST [12] — giảm boilerplate so với tự viết `fetch` + `useEffect` rải rác. **React Flow** (`@xyflow/react`) cung cấp canvas kéo thả node/edge, zoom, minimap và API programmatic cho **editor đồ thị workflow** [11] — trực tiếp phục vụ UC003 và NFR-U03. **Tailwind CSS** utility-first giúp thống nhất spacing, màu sắc và responsive mà không phải duy trì file CSS monolithic. **socket.io-client** bổ sung lớp realtime song song REST, merge event push vào state UI.

Console quản trị là điểm vào duy nhất cho người vận hành: dashboard thống kê, quản lý fleet agent, CRUD task/template, workflow editor, cấu hình trigger cron/Telegram, quản lý user (ADMIN) và xem audit — tương ứng các use case Hình 2.1 (mục 2.2.2–2.2.10). Use case thiết kế workflow (UC003) đòi hỏi giao diện đồ thị trực quan: node loại task, delay, condition, nối edge có hướng; lưu JSON graph lên server. Yêu cầu NFR-U01 (giao diện tiếng Việt, bố cục rõ), U02 (phản hồi thao tác trong vài giây) và U05 (cập nhật trạng thái task/agent không reload) đặt ra ở tầng presentation. Console là **ứng dụng nội bộ** (internal admin), không cần SEO công khai — ảnh hưởng trực tiếp tới lựa chọn SPA thuần thay vì SSR.

**Angular** và **Vue.js** là framework thay thế đầy đủ tính năng (routing, DI, form); Angular verbose hơn cho dự án quy mô vừa; Vue ecosystem React Flow tương đương nhưng team đã quen React/TS. **Next.js** SSR/SSG phù hợp site marketing hoặc SEO nhưng dư thừa cho console behind login — thêm complexity deploy so với file tĩnh. Ứng dụng desktop **WPF/WinUI** hoặc **Electron full UI** thay web thuận tiện trên một máy nhưng kém linh hoạt khi admin truy cập từ nhiều nơi hoặc thiết bị (NFR-U04 chỉ yêu cầu Electron cho agent, không phải console).

Đồ án xây dựng **React 19 + Vite 6** [5] với TypeScript end-to-end (shared types với API response). React Flow [11] phục vụ canvas thiết kế workflow — node tùy chỉnh hiển thị loại bước, validation trước khi lưu graph. TanStack Query [12] cache endpoint `/agents`, `/tasks`, `/workflows`…; mutation invalidate cache sau POST/PATCH. Kết hợp socket.io-client: khi nhận `task:completed`, UI cập nhật badge trạng thái tức thì thay vì chờ poll. SPA build tĩnh (`npm run build` → thư mục `dist/`) deploy lên **Firebase Hosting** [17] — CDN global, HTTPS miễn phí, rewrite fallback `index.html` cho client-side routing (NFR-D02). Biến `VITE_API_URL` và `VITE_WS_URL` trỏ tới Railway production, tách hoàn toàn tầng presentation khỏi API — kiến trúc ba tầng mục 1.3. Lựa chọn React SPA là phù hợp nhất cho console quản trị workflow-centric, realtime và đa màn hình mà đồ án yêu cầu.

## 3.6. Agent máy trạm — Rust và Electron

**Rust** là ngôn ngữ lập trình systems, nhấn mạnh an toàn bộ nhớ và concurrency không data race nhờ ownership/borrow checker, biên dịch ra **native binary** hiệu năng cao, khởi động nhanh và footprint RAM thấp [6]. Rust phù hợp viết runtime chạy nền lâu dài, gọi API hệ điều hành (Win32 trên Windows), xử lý subprocess và I/O song song mà không garbage collector pause như Node/Java. **Electron** là framework ứng dụng desktop (Chromium + Node.js), cung cấp **system tray**, cửa sổ cấu hình, auto-update pattern và quen thuộc với người dùng Windows [15] — thường dùng khi cần UI nhẹ bọc quanh engine native. Trên Windows, **UI Automation (UIA)** là nền tảng Microsoft cho phép chương trình tương tác với cây UI ứng dụng (button, textbox, menu) — cơ sở cho tự động hóa desktop thay thế macro pixel-based [7].

Task và workflow của đồ án chỉ có giá trị khi **thực thi tại chỗ** trên máy Windows (UC002, UC004): chạy lệnh shell/PowerShell, gửi HTTP tới localhost, mở/đóng ứng dụng, chụp màn hình, thao tác desktop qua UIA, gửi Telegram… Yêu cầu NFR-AG01–AG03 giới hạn automation mặc định tắt, giới hạn số bước workflow và delay tối đa để tránh agent bị lạm dụng chạy script nguy hiểm; NFR-U04 yêu cầu cấu hình agent key và URL server qua giao diện tray thay vì sửa file cấu hình tay. Agent phải chạy được như **Windows Service** (khởi động cùng máy, không phụ thuộc user đăng nhập desktop) — Electron shell hỗ trợ cài service spawn process Rust.

Các phương án thay thế: **Node.js/Electron monolith** — nhanh prototype nhưng footprint RAM cao (Chromium), khó gọi Win32/UIA an toàn; **Python** (pywinauto, pyautogui) — ecosystem automation phong phú nhưng đóng gói exe, dependency và chạy dài hạn trên workstation kém gọn hơn binary Rust; **C#/.NET** — tích hợp UIA native nhất trên Windows nhưng tách ngôn ngữ khỏi stack TypeScript server/console; **Go** — binary gọn nhưng ecosystem UIA/desktop mỏng hơn Rust+winapi crate trong phạm vi đồ án. **PowerShell remoting** từ server — không đáp ứng mô hình agent pull command qua WebSocket và firewall outbound phức tạp.

Đồ án tách **Rust** (`agent/core`) làm **engine thực thi**: `TaskRegistry` map loại task (`command`, `http_request`, `open_app`, `desktop`, …) tới handler; module `connection` duy trì Socket.IO client tới `/ws/agent`; module `platform/windows` gọi Win32, UIA, pipe IPC với tiện ích phụ. **Electron** (`agent/desktop`) là lớp vỏ mỏng: icon tray, form nhập agent key và URL server, log viewer lọc heartbeat, cài/gỡ Windows Service spawn binary Rust. Tách engine/UI giữ phần nặng (I/O, automation) ổn định, dễ nâng cấp độc lập; Electron chỉ cần update khi đổi UX cấu hình. Rust [6] đáp ứng NFR-AG02 (agent không làm treo UI máy trạm) và an toàn bộ nhớ khi chạy service 24/7.

Phạm vi đồ án **chỉ Windows** (mục 1.2); agent Linux/macOS không triển khai — quyết định có chủ đích tập trung depth UIA/Win32 thay vì breadth đa nền tảng. Installer NSIS và ký code signing là hướng mở rộng (Chương 6). Chi tiết handler từng loại task và sơ đồ IPC trình bày Chương 4–5; Chương 3 khẳng định cặp Rust+Electron là lựa chọn cân bằng giữa hiệu năng thực thi, an toàn và trải nghiệm cài đặt trên máy trạm doanh nghiệp.

## 3.7. Xác thực và phân quyền — JWT và RBAC

**JSON Web Token (JWT)** là chuẩn mở (RFC 7519) biểu diễn claims (sub, exp, roles…) dưới dạng JSON, ký bằng HMAC hoặc RSA để đảm bảo toàn vẹn; client gửi token trong header `Authorization: Bearer` và server xác minh **stateless** — không bắt buộc lưu session server-side cho mỗi request [13]. **RBAC** (Role-Based Access Control) gán quyền theo **vai trò** (`USER`, `ADMIN`) thay vì liệt kê permission từng API cho từng user — phù hợp hệ thống có ít vai trò cố định và ma trận quyền rõ ràng. **bcrypt** là hàm băm mật khẩu adaptive (Blowfish-based), chống brute-force nhờ **cost factor** có thể tăng theo sức mạnh phần cứng — mật khẩu không lưu plaintext trong PostgreSQL.

Use case đăng nhập/đăng ký (Hình 2.2) và nhóm NFR-S01–S04 yêu cầu: xác thực người dùng console; phân quyền ADMIN (quản lý user, xem audit toàn hệ thống) vs USER (chỉ dữ liệu sở hữu); **cách ly multi-tenant** theo `userId` trên mọi truy vấn nghiệp vụ; bảo vệ API và WebSocket client bằng TLS trên production. **Agent** trên máy trạm cần cơ chế riêng — **agent key** dài, ngẫu nhiên, gắn một Agent record — không dùng chung JWT user (NFR-S03): agent chạy service lâu dài, credential lưu file/registry máy client; mô hình rủi ro khác trình duyệt (XSS đánh cắp token session ngắn hạn). Đây là kiến trúc **dual-auth**: cùng server, hai không gian tin cậy (user JWT vs agent key).

Phương án thay thế: **Session cookie server-side** (Redis/PostgreSQL session store) — thuận tiện revoke tức thì nhưng SPA trên Firebase Hosting + API Railway cần CORS/cookie `SameSite` phức tạp và sticky session nếu scale ngang; **OAuth2/OIDC** (Google, Microsoft) — giảm quản lý mật khẩu nhưng vượt phạm vi đồ án khi chưa yêu cầu SSO doanh nghiệp; **một API key cho cả user và agent** — đơn giản nhưng không phân tách quyền và rotation khó; **mTLS agent** — bảo mật cao, chi phí phát hành/chứng chỉ client lớn cho fleet agent quy mô đồ án.

Hệ thống dùng **JWT** qua **Passport** (`JwtStrategy`) trong NestJS: access token hết hạn khoảng **15 phút**, refresh token khoảng **7 ngày** — cân bằng NFR-S02 (giảm cửa sổ lộ token) và trải nghiệm không đăng nhập lại liên tục. Mật khẩu băm **bcrypt** cost 10; endpoint đăng ký/đăng nhập có **throttle** chống spam. Guard `@Roles('ADMIN')` bảo vệ module admin; guard JWT áp dụng REST và handshake Socket.IO namespace `/ws/client`. Thực hành bảo mật token (không log plaintext, HTTPS only, validate `exp`) tham chiếu OWASP [13].

Mọi service Prisma lọc theo `userId` sở hữu bản ghi — agent, task, workflow, trigger thuộc user tạo ra; ADMIN bypass có kiểm soát qua module riêng ghi audit. Agent kết nối `/ws/agent` validate agent key trong `AgentsGateway`; từ chối handshake nếu key không khớp hoặc agent bị vô hiệu. JWT stateless phù hợp SPA + API trên Railway [16] không cần session store tập trung — giảm thành phần hạ tầng. Kết hợp RBAC + row-level ownership hiện thực NFR-S04 mà không cần PostgreSQL Row Level Security (RLS) — RLS là hướng cứng hóa thêm ở mở rộng dài hạn (Chương 6). Chi tiết mô hình dual-auth, guard stack và quy ước filter `userId` xem **mục 5.4**.

## 3.8. Công cụ triển khai và vận hành

Ngoài stack ứng dụng, đồ án cần chuỗi công cụ hỗ trợ **vòng đời phần mềm** (SDLC): môi trường dev tái lập cho mọi thành viên (NFR-D01), tài liệu hóa API cho tích hợp và bảo trì (NFR-M02), kiểm thử tự động cơ bản (NFR-M05), quan sát lỗi (logging NestJS) và triển khai production **HTTPS/WSS** (NFR-D02, S07). Các công nghệ mục 3.1–3.7 giải quyết “chạy được”; mục 3.8 giải quyết “phát triển và vận hành được bền vững”.

**Docker Compose** [14] định nghĩa multi-container (PostgreSQL, Redis, có thể kèm pgAdmin tùy chọn) bằng file YAML declarative — một lệnh `docker compose up` khởi tạo stack local, thay cho cài PostgreSQL/Redis native trên từng máy dev (lệch phiên bản, khó reset). Dev vẫn chạy NestJS và React bằng `npm run start:dev` / `npm run dev` trên host để hot reload nhanh; chỉ infrastructure stateful container hóa — pattern phổ biến “app on host, DB in Docker”. **Swagger (OpenAPI 3)** mô tả REST API dưới dạng chuẩn machine-readable; NestJS sinh spec từ decorator (`@ApiOperation`, `@ApiResponse`) tại `/api/docs`, hỗ trợ thử API có Bearer token — đáp ứng NFR-M02 và onboarding developer mới. **Jest** là framework test JavaScript tích hợp sẵn NestJS (`@nestjs/testing`) cho unit test service (ví dụ `AuthService` validate token expiration) và controller — NFR-M05; e2e test Playwright/Cypress ghi nhận hướng mở rộng Chương 6.

Trên **production**, **Railway** [16] là nền tảng PaaS deploy ứng dụng từ Git repository: build Docker hoặc Nixpacks, inject biến môi trường (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS` trỏ Firebase domain…), health check HTTP `/`, TLS termination — host NestJS + WebSocket trên một public URL. **Firebase Hosting** [17] phục vụ file tĩnh SPA qua CDN global, HTTPS miễn phí, header bảo mật cơ bản; rewrite SPA fallback. Tách frontend/backend domain giảm blast radius (compromise static site không đồng nghĩa access DB) và scale độc lập. **Redis Cloud** [18] và PostgreSQL managed (Railway plugin hoặc provider tương đương) loại bỏ patch OS, backup manual — phù hợp NFR-D03 vận hành ít nhân sự infra.

Phương án thay thế: **Heroku** (tương tự PaaS, pricing thay đổi); **Fly.io/Render** (deploy container linh hoạt); **VPS tự quản** (DigitalOcean + nginx + certbot) — kiểm soát tối đa nhưng tốn thời gian hardening, monitoring, backup (vượt phạm vi đồ án tốt nghiệp). **AWS ECS/EKS** — enterprise scale, overkill. Đồ án chọn Railway + Firebase + managed DB/Redis vì time-to-production ngắn, chi phí học tập thấp, vẫn đủ chứng minh NFR-D02 “chạy production thật” như Tóm tắt báo cáo.

Quy trình release điển hình: merge main → Railway auto-deploy backend; `npm run build` console → `firebase deploy` hosting; agent Windows build pipeline Rust `cargo build --release` + Electron packager → artifact installer (phạm vi 4.3). Biến môi trường `.env.example` document contract cấu hình without secret. Phạm vi đồ án không triển khai agent Linux/macOS; CI GitHub Actions có thể bổ sung lint/test — NFR-M01. Mục 3.8 khép vòng Chương 3: công nghệ không chỉ là thư viện code mà gồm **nền tảng và quy trình** đưa hệ thống agent–server từ máy dev tới vận hành cloud an toàn.

### Kết chương 3

Chương này đã trình bày các công nghệ được sử dụng trong đồ án theo bốn nhóm tương ứng với kiến trúc hệ thống agent–server. **NestJS** cùng **PostgreSQL**, **Prisma ORM**, **Redis** và **BullMQ** hình thành tầng server điều phối — lưu trữ nghiệp vụ, hàng đợi task và worker xử lý bất đồng bộ; **Socket.IO** đảm nhận giao tiếp thời gian thực giữa server với agent và console quản trị, gồm heartbeat, dispatch lệnh và push trạng thái; **React**, **Vite**, **React Flow** và **TanStack Query** tạo nên console quản trị web, trong đó editor đồ thị workflow phục vụ trực tiếp thiết kế quy trình tự động; còn **Rust**, **Electron**, **JWT/RBAC** cùng các công cụ **Docker Compose**, **Swagger**, **Jest**, **Railway** và **Firebase Hosting** lần lượt hiện thực thực thi tại máy trạm Windows, bảo mật phân quyền và chuỗi phát triển–triển khai. Với mỗi công nghệ, chương đã làm rõ vai trò trong việc đáp ứng yêu cầu ở Chương 2 và lý do lựa chọn so với chuỗi các phương án thay thế.

Các công nghệ này đều là mã nguồn mở hoặc có gói sử dụng miễn phí ở quy mô đồ án, phù hợp với định hướng triển khai chi phí thấp trên Railway, Firebase Hosting và dịch vụ PostgreSQL/Redis managed, đồng thời nhất quán với định hướng giải pháp đã nêu ở mục 1.3. Trên cơ sở các công nghệ đã lựa chọn, **Chương 4** trình bày quá trình thiết kế, xây dựng, kiểm thử và triển khai hệ thống.

---

# Chương 4. Phát triển và triển khai ứng dụng

## 4.1. Thiết kế kiến trúc

### 4.1.1. Lựa chọn kiến trúc phần mềm

Kiến trúc phần mềm quyết định cách phân tách trách nhiệm giữa giao diện, logic nghiệp vụ và lưu trữ dữ liệu — từ đó ảnh hưởng trực tiếp tới khả năng mở rộng, bảo trì và triển khai hệ thống. Với bài toán quản lý fleet agent, điều phối task/workflow và thực thi tại chỗ trên máy trạm Windows (Chương 2), đồ án xem xét một số mô hình phổ biến: **kiến trúc ba lớp (Three-tier)**, **MVC (Model–View–Controller)**, **SOA (Service-Oriented Architecture)** và **Microservices**. SOA và Microservices phù hợp khi cần scale độc lập từng dịch vụ ở quy mô lớn, nhưng tăng chi phí vận hành (nhiều artifact deploy, service discovery, distributed tracing) — vượt nhu cầu đồ án tốt nghiệp và mục tiêu triển khai production gọn trên Railway (NFR-SC01, NFR-D02). Kiến trúc **MVC đơn lẻ** thường gắn với một ứng dụng monolith (ví dụ web server render HTML); hệ thống của đồ án lại tách **console SPA**, **server NestJS** và **agent desktop** thành ba runtime khác nhau, nên MVC được áp dụng **theo từng thành phần**, không phải một khối MVC toàn cục.

Đồ án lựa chọn **kiến trúc ba lớp** kết hợp **mô hình client–server** và **xử lý bất đồng bộ qua hàng đợi**. Ở dạng lý thuyết, kiến trúc ba lớp chia hệ thống thành: (1) **lớp trình bày (Presentation)** — giao diện tương tác với người dùng; (2) **lớp nghiệp vụ (Business / Application)** — xử lý quy tắc, điều phối luồng; (3) **lớp dữ liệu (Data)** — lưu trữ bền vững. Các lớp giao tiếp theo hướng **một chiều xuống**: presentation gọi business, business gọi data; lớp dưới không phụ thuộc lớp trên, giúp thay đổi UI hoặc CSDL mà không lan rộng toàn hệ thống. Mô hình **client–server** bổ sung khía cạnh phân tán: console và agent là **client** (mỏng hoặc fat), server NestJS là **trung tâm điều phối** — phù hợp mô hình agent–server mục 1.3.

So với lý thuyết thuần túy, kiến trúc cụ thể của đồ án có **ba điểm bổ sung/cải tiến**. Thứ nhất, thêm **lớp thực thi (Execution tier)** — agent Rust trên máy trạm — vì task bắt buộc chạy tại chỗ (Win32, shell, UIA), không thể gói vào lớp nghiệp vụ trên cloud. Thứ hai, trong cùng process NestJS có **tầng xử lý bất đồng bộ** (worker BullMQ) tách bước ghi nhận yêu cầu REST khỏi bước dispatch WebSocket — không phải lớp thứ tư độc lập deploy, nhưng là mở rộng logic của lớp nghiệp vụ. Thứ ba, giao tiếp realtime dùng **hai namespace Socket.IO** (`/ws/agent`, `/ws/client`) song song REST, thay cho polling HTTP — vẫn nằm trong lớp trình bày/giao tiếp nhưng tách kênh theo đối tượng (agent key vs JWT). Như vậy, kiến trúc thực tế là **ba lớp cổ điển + client fat + hàng đợi nội bộ**, không phải microservice.

**Ánh xạ kiến trúc ba lớp vào hệ thống cụ thể**

*Lớp trình bày* gồm console quản trị web (React SPA build bởi Vite) và phần shell agent (Electron: system tray, form cấu hình). Console cung cấp các view chính: `Dashboard`, `Agents`, `Tasks`, `Automations` (workflow + trigger), `Settings`, `AuditLog` (admin) — người vận hành thao tác CRUD, thiết kế workflow trên canvas React Flow, xem trạng thái fleet. Agent Electron không phải UI quản trị fleet mà là **presentation tối thiểu** để nhập agent key và URL server (NFR-U04). Dữ liệu hiển thị lấy qua REST (`lib/api.ts`, TanStack Query) và cập nhật realtime qua `socket.io-client` (`lib/ws.ts`, `WsProvider`).

*Lớp nghiệp vụ* tập trung trên server NestJS, tổ chức theo module: `AuthModule`, `UsersModule` (đăng nhập, JWT, RBAC); `AgentsModule` (quản lý fleet, `AgentsGateway` heartbeat và dispatch); `TasksModule` (`TasksService`, `TasksProcessor` BullMQ); `AutomationModule` (`WorkflowRuntimeService` duyệt đồ thị workflow); `TriggersModule` (cron, webhook Telegram); `AdminModule` (`AdminService`, `ClientGateway` push sự kiện tới console). Controller (`TasksController`, `AgentsController`, `AutomationController`…) đóng vai **cổng HTTP**: nhận request, validate DTO, gọi service — tương ứng phần **Controller** trong MVC ở tầng API. Service (`TasksService`, `AgentsService`, `WorkflowRuntimeService`, `AuthService`…) chứa **quy tắc nghiệp vụ**: kiểm tra quyền theo `userId`, enqueue task, cập nhật trạng thái, resolve biến workflow — tương ứng **Model + Controller** logic trong MVC server-side. Trên agent Rust, lớp nghiệp vụ thực thi là `TaskRegistry` cùng các handler (`handlers/command`, `handlers/desktop`, `handlers/http_request`…): map loại task tới thao tác OS; module `connection/runner` nhận lệnh từ Socket.IO client và điều phối handler — vai trò tương tự service layer nhưng chạy **phía client fat**.

*Lớp dữ liệu* gồm **PostgreSQL** (dữ liệu bền: User, Agent, Task, Workflow, Trigger, AuditLog…) truy cập qua **Prisma ORM** (`PrismaService`, schema `prisma/schema.prisma`); và **Redis** phục vụ hàng đợi BullMQ (job tạm, không thay CSDL quan hệ). Agent lưu cấu hình cục bộ (agent key, URL) qua file/env do Electron/Rust quản lý — lớp dữ liệu phân tán nhẹ ở biên, không đồng bộ ngược lên server ngoài metadata telemetry heartbeat.

**MVC trong từng thành phần (ánh xạ lý thuyết → cụ thể)**

Mặc dù toàn hệ thống không dùng một MVC monolith, từng phần vẫn theo mô hình MVC (hoặc biến thể MVVM nhẹ ở React):

Trên **console React**, **View (V)** là cây component và page (`views/Dashboard.tsx`, `components/workflow/WfFlowNode.tsx`, bảng agent/task…). **Model (M)** — theo nghĩa MVC frontend — là dữ liệu và hợp đồng API: type trong `types/api.ts`, hàm map DTO ↔ UI trong `lib/mappers.ts`, cache server state qua TanStack Query. **Controller (C)** là lớp điều phối: hook và context (`AuthContext`, mutation/refetch Query), router (`App.tsx`, `ProtectedRoute`), xử lý sự kiện socket trong `WsProvider` — nhận thao tác người dùng, gọi API hoặc cập nhật state, không nhúng SQL hay quy tắc enqueue task (thuộc server).

Trên **server NestJS**, **View** tương ứng **Controller** REST/Webhook (`AuthController`, `TasksController`, `TriggersController`…) và gateway (`AgentsGateway`, `ClientGateway`) — expose giao thức, không chứa SQL trực tiếp. **Model** tương ứng **entity Prisma** (`User`, `Agent`, `Task`, `Workflow`…) cùng **service** mang quy tắc (`TasksService.create` kiểm tra agent thuộc user và reachable; `WorkflowRuntimeService` duyệt graph). **Controller** (MVC) trùng vai trò với service khi service điều phối nhiều bước — NestJS thường gom “controller logic” vào service; đây là **cải tiến thực tế** so với sách giáo khoa MVC tách cứng, nhưng vẫn giữ controller mỏng (delegate xuống service). `TasksProcessor` (worker) là controller bất đồng bộ: lấy job từ queue, gọi `AgentsGateway` — mở rộng MVC cho luồng message-driven.

Trên **agent Rust**, **View** là log/tray Electron; **Model** là `TaskExecute`, `TaskWire`, `AgentConfig`; **Controller** là `connection/runner` và `TaskRegistry::dispatch`.

**Luồng điển hình:** người vận hành chọn chạy task trên `Tasks.tsx` → POST `/tasks` → `TasksService` ghi PostgreSQL và enqueue BullMQ → `TasksProcessor` → `AgentsGateway` gửi `task:execute` → agent thực thi → cập nhật DB → `ClientGateway` push → UI đổi trạng thái. Presentation không gọi thẳng Prisma; agent không ghi DB server; server không chạy lệnh shell trên máy trạm — ranh giới lớp được giữ.

**Kết luận lựa chọn**

Kiến trúc ba lớp kết hợp client–server và hàng đợi bất đồng bộ là phù hợp nhất cho đồ án: đủ cấu trúc module hóa (NestJS, React, Rust tách repo con), đáp ứng realtime và fleet agent, triển khai production đơn giản (một backend deployable + SPA tĩnh + agent installer), đồng thời tránh over-engineering microservice. Các mục 4.1.2 và 4.1.3 trình bày sơ đồ tổng quan và phụ thuộc gói chi tiết trên nền kiến trúc đã chọn. Phân tích sâu các giải pháp then chốt xây dựng trên nền kiến trúc này — gateway realtime, hàng đợi, workflow runtime, phân quyền và trigger — được trình bày lần lượt tại mục 5.1–5.5.

### 4.1.2. Thiết kế tổng quan

Mục này trình bày **biểu đồ gói UML (UML package diagram)** mô tả cấu trúc phần mềm ở mức tổng quan và **hướng phụ thuộc** giữa các gói, bám kiến trúc ba lớp đã chọn ở mục 4.1.1. Các gói được **xếp theo tầng từ trên xuống dưới** (trình bày → nghiệp vụ → hạ tầng → dữ liệu/thực thi), không trộn lẫn package giữa các tầng trong hình vẽ — tương tự nguyên tắc sắp xếp minh họa trong mẫu Hình 1 của quy chế báo cáo.

**Quy tắc phụ thuộc áp dụng**

Thứ nhất, **gói tầng trên chỉ phụ thuộc gói tầng dưới** (hoặc gói cùng tầng theo hướng nghiệp vụ đã thiết kế): lớp trình bày gọi API/WebSocket tới lớp nghiệp vụ; module nghiệp vụ dùng `common`, `prisma`, hàng đợi; `prisma` và worker BullMQ truy cập PostgreSQL/Redis. Thứ hai, **không phụ thuộc bỏ qua tầng**: console React không import Prisma hay truy cập DB; agent Rust không ghi trực tiếp PostgreSQL. Thứ ba, **gói hạ tầng không phụ thuộc ngược module nghiệp vụ** — `common` và `prisma` không import `TasksModule`, `AgentsModule`… Thứ tư, **hạn chế phụ thuộc ngang giữa các gói cùng tầng**: `auth.users`, `agents`, `tasks`… độc lập tương đối; khi cần phối hợp thì thiết kế **một chiều** (ví dụ `tasks` → `agents` để dispatch qua `AgentsGateway`, không ngược). Ngoại lệ duy nhất: cặp `automation` ↔ `triggers` dùng `forwardRef` của NestJS vì trigger dispatch gọi workflow runtime và workflow cần đăng ký trigger — vòng phụ thuộc được **kiểm soát tại runtime**, không lan sang tầng hạ tầng.

[chèn Hình 4.1 — Biểu đồ gói UML phân tầng; nguồn: `docs/diagrams/hinh-4-1-bieu-do-goi-uml.puml`]

**Bảng 4.1 — Sự phụ thuộc giữa các gói (dưới Hình 4.1)**

Các quan hệ phụ thuộc (`<<dependency>>`, mũi tên **nét đứt** trên biểu đồ) giữa **gói cha** các tầng được tóm tắt như sau. Gói nguồn *sử dụng* gói đích; gói đích **không** phụ thuộc ngược lại gói nguồn.

| STT | Gói nguồn (tầng trên) | Gói đích (tầng dưới) | Giao tiếp / nội dung phụ thuộc |
|-----|------------------------|----------------------|--------------------------------|
| 1 | `console.web` | `server.quan-tri` | REST/HTTPS + JWT: đăng nhập, quản lý user, admin, audit, billing |
| 2 | `agent.shell` | `server.dieu-phoi` | Cấu hình URL server, agent key; agent native kết nối WSS tới gateway trong gói này |
| 3 | `server.quan-tri` | `infrastructure` | Dùng guard JWT/RBAC, filter HTTP, DTO, `PrismaService`, hằng số dùng chung |
| 4 | `server.dieu-phoi` | `datastore` | Ghi/đọc PostgreSQL (task, agent, workflow…); enqueue/consume job qua Redis/BullMQ |
| 5 | `server.dieu-phoi` | `agent.core` | Dispatch lệnh thực thi (`task:execute`) và nhận kết quả (`task:result`) qua WSS |

Ngoài năm phụ thuộc trên sơ đồ tổng quan, **`console.web`** còn phụ thuộc **`server.dieu-phoi`** qua REST/WebSocket client (quản lý agent, task, workflow, trigger) — cùng kiểu giao tiếp mạng, không import mã trực tiếp; không vẽ thêm mũi tên trên Hình 4.1 để giữ cấu trúc hai nhánh song song theo mẫu quy chế (nhánh trình bày web → quản trị; nhánh agent → điều phối).

**Phụ thuộc bên trong gói cha (gói con — không vẽ mũi tên riêng trên Hình 4.1)**

| Gói cha | Gói con | Phụ thuộc nội bộ / ghi chú |
|---------|---------|----------------------------|
| `server.quan-tri` | `auth.users` | Xác thực, JWT, RBAC; dùng `infrastructure` qua gói cha (STT 3) |
| `server.quan-tri` | `admin.audit` | API admin, audit log; dùng `infrastructure` qua gói cha (STT 3) |
| `server.dieu-phoi` | `agents` | Fleet, heartbeat, `AgentsGateway` `/ws/agent`; phụ thuộc `datastore` và `agent.core` qua gói cha (STT 4, 5) |
| `server.dieu-phoi` | `tasks.workflow` | Task, template, BullMQ worker, workflow runtime, trigger; gọi `agents` khi dispatch; phụ thuộc `datastore` qua gói cha (STT 4) |
| `datastore` | `postgresql` | Lưu trữ bền (User, Agent, Task, Workflow…) — truy cập qua Prisma trong `infrastructure` |
| `datastore` | `redis` | Hàng đợi BullMQ; `infrastructure` kết nối Redis, `tasks.workflow` enqueue job |

**Quy tắc đọc sơ đồ:** chỉ có phụ thuộc **từ trên xuống** giữa các tầng; không bỏ qua tầng (ví dụ `console.web` không nối thẳng `datastore`); `infrastructure` và `datastore` không phụ thuộc ngược `server.quan-tri` hay `server.dieu-phoi`. Chi tiết phụ thuộc giữa từng module NestJS (ví dụ `tasks` → `agents`) trình bày ở mục 4.1.3.

**Mục đích các gói (Hình 4.1)**

Biểu đồ gói UML được vẽ **đúng cấu trúc mẫu quy chế (Hình 1)**: ba tầng xếp từ trên xuống; tầng 1 gồm hai gói độc lập; tầng 2 gồm hai **gói cha**, mỗi gói chứa hai **gói con**; tầng 3 gồm một gói đơn, một gói cha chứa hai gói con và một gói đơn. Quan hệ giữa các gói cha ở các tầng khác nhau biểu diễn bằng **mũi tên phụ thuộc nét đứt** (`..>`), không vẽ phụ thuộc chéo lộn xộn giữa các tầng.

*Tầng 1:* **`console.web`** — console quản trị React SPA. **`agent.shell`** — lớp Electron (tray, cấu hình agent).

*Tầng 2:* Gói cha **`server.quan-tri`** gồm **`auth.users`** (đăng nhập, JWT, RBAC) và **`admin.audit`** (quản trị user, audit, billing). Gói cha **`server.dieu-phoi`** gồm **`agents`** (fleet, gateway `/ws/agent`) và **`tasks.workflow`** (task, template, BullMQ, workflow runtime, trigger).

*Tầng 3:* **`infrastructure`** — `common`, Prisma, cấu hình BullMQ. Gói cha **`datastore`** gồm **`postgresql`** và **`redis`**. **`agent.core`** — engine Rust thực thi task trên Windows.

Luồng nghiệp vụ: người dùng thao tác **`console.web`** → server (các gói tầng 2–3 theo Bảng 4.1) → **`agent.core`** thực thi → kết quả trả ngược console. Chi tiết module NestJS trong từng gói con trình bày mục 4.1.3.

### 4.1.3. Thiết kế chi tiết gói

Mục này phân rã các gói tầng 2–3 trong Hình 4.1 thành **biểu đồ lớp (class diagram)** theo từng nhóm nghiệp vụ liên quan. Quy ước vẽ giống mẫu quy chế (Hình 2): **chỉ ghi tên lớp**, không liệt kê thuộc tính và phương thức; thể hiện đủ các quan hệ UML — **phụ thuộc** (dependency, nét đứt), **kết hợp** (association, nét liền), **kết tập** (aggregation, thoi rỗng), **hợp thành** (composition, thoi đặc), **kế thừa** (inheritance, tam giác rỗng), **thực thi** (implementation, nét đứt + tam giác rỗng với interface).

Đồ án vẽ **ba biểu đồ** tương ứng ba gói giải quyết ba vấn đề: (1) xác thực và quản trị; (2) điều phối fleet, task và workflow; (3) thực thi task trên máy trạm. Gói `infrastructure` (`PrismaService`, guard, worker base…) xuất hiện ở Hình 4.2–4.3 như gói phụ thuộc bên dưới, thống nhất mục 4.1.2.

#### 4.1.3.1. Gói `server.quan-tri`

Gói cha **`server.quan-tri`** (Hình 4.1) gồm hai gói con **`auth.users`** và **`admin.audit`**. Hình 4.2 mô tả lớp và quan hệ bên trong.

[chèn Hình 4.2 — Thiết kế chi tiết gói `server.quan-tri`; nguồn: `docs/diagrams/hinh-4-2-goi-server-quan-tri.puml`]

**Giải thích thiết kế.** Lớp **Controller** (`AuthController`, `UsersController`, `AdminController`) đóng vai trò cổng HTTP: nhận request, validate DTO, **phụ thuộc** (`..>`) vào **Service** tương ứng — không chứa SQL. `AuthService` **kết tập** (`o--`) hai strategy JWT (`JwtStrategy`, `JwtRefreshStrategy`); mỗi strategy **kế thừa** (`--|>`) `PassportStrategy` của Passport. `AuthService`, `UsersService`, `AdminService`, `AuditService` **kết hợp** (`-->`) `PrismaService` để đọc/ghi User, AuditLog… `ClientGateway` (WebSocket console) **phụ thuộc** `JwtAuthGuard` và `AdminService` để push sự kiện realtime sau khi nghiệp vụ cập nhật. Thiết kế tách rõ auth/user và admin/audit trong cùng gói cha nhưng hai package con độc lập, dễ bảo trì RBAC.

#### 4.1.3.2. Gói `server.dieu-phoi`

Gói **`server.dieu-phoi`** gom **`agents`** (fleet, gateway agent) và **`tasks.workflow`** (task, workflow runtime, trigger). Đây là nhóm xử lý điều phối tác vụ — liên quan UC001, UC002, UC004, UC005.

[chèn Hình 4.3 — Thiết kế chi tiết gói `server.dieu-phoi`; nguồn: `docs/diagrams/hinh-4-3-goi-server-dieu-phoi.puml`]

**Giải thích thiết kế.** `AgentsGateway` **hợp thành** (`*--`) với `AgentsService`: gateway duy trì socket map và gọi service cập nhật trạng thái — vòng đời gắn chặt. `AgentTelemetryStore` được **hợp thành** bởi `AgentsService` để cache telemetry heartbeat. Nhánh task: `TasksController` → `TasksService` (dependency); `TasksService` **phụ thuộc** `AgentsService`/`AgentsGateway` khi dispatch và **kết tập** `TaskQueue` (BullMQ). `TasksProcessor` **kế thừa** `WorkerHost` (NestJS BullMQ), **phụ thuộc** gateway để gửi `task:execute`. Nhánh workflow/trigger: `AutomationService` **hợp thành** `WorkflowRuntimeService`; `TriggerDispatcherService` **phụ thuộc** runtime để khởi chạy workflow khi cron/Telegram kích hoạt; `ScheduleTriggerService` **phụ thuộc** dispatcher. Quan hệ `WorkflowRuntimeService` ..> `AutomationService` biểu diễn phụ thuộc hai chiều có kiểm soát (`forwardRef` trong code). Mọi service nghiệp vụ **kết hợp** `PrismaService` ở tầng infrastructure.

#### 4.1.3.3. Gói `agent.core`

Gói **`agent.core`** (Rust, `agent/core/`) thực thi task tại máy Windows — bổ sung cho Hình 4.1 tầng Execution.

[chèn Hình 4.4 — Thiết kế chi tiết gói `agent.core`; nguồn: `docs/diagrams/hinh-4-4-goi-agent-core.puml`]

**Giải thích thiết kế.** `ConnectionRunner` **hợp thành** `AgentConfig` (cấu hình agent key, URL), **phụ thuộc** `TaskRegistry` để dispatch job nhận từ Socket.IO; **kết tập** `TelemetrySampler` gửi heartbeat. `TaskRegistry` **kết tập** các handler implement **`TaskHandler`** (interface): `CommandHandler`, `HttpRequestHandler`, `DesktopHandler`, `OpenAppHandler` — mỗi lớp **thực thi** (`..|>`) interface, mở rộng loại task mà không sửa registry. `TaskRegistry` **phụ thuộc** `Platform` (Win32/UIA) và **kết tập** `TaskCancelRegistry` hủy task đang chạy. `Platform` **hợp thành** `AgentConfig` khi gọi API OS theo cấu hình. Mô hình registry + handler map trực tiếp pattern Strategy, phù hợp mở rộng task type trên agent.

**Bảng 4.2 — Ký hiệu quan hệ UML (Hình 4.2–4.4)**

| Quan hệ | Ký hiệu | Ý nghĩa trong đồ án |
|---------|---------|---------------------|
| Phụ thuộc | `..>` | Controller → Service; Dispatcher → Runtime; Runner → Registry |
| Kết hợp | `-->` | Service truy cập PrismaService |
| Kết tập | `o--` | Service giữ Strategy, Queue, Handler (có thể thay) |
| Hợp thành | `*--` | Gateway–Service; Automation–Runtime; Runner–Config |
| Kế thừa | `--\|>` | JwtStrategy → PassportStrategy; TasksProcessor → WorkerHost |
| Thực thi | `..\|>` | CommandHandler → TaskHandler (interface) |

## 4.2. Thiết kế chi tiết

Mục 4.2 bổ sung cho thiết kế kiến trúc ở mục 4.1 theo ba hướng: giao diện người dùng, lớp nghiệp vụ chủ đạo và cơ sở dữ liệu. Phần giao diện trình bày **thiết kế** (wireframe, quy chuẩn hiển thị); ảnh chụp sản phẩm thực tế được đặt ở mục 4.3.3 để phân biệt rõ hai giai đoạn thiết kế và triển khai.

### 4.2.1. Thiết kế giao diện

#### Mục tiêu và môi trường hiển thị

Console quản trị là ứng dụng web một trang, hướng tới người dùng làm việc trên máy tính để bàn hoặc laptop. Giao diện ưu tiên màn hình rộng: laptop tiêu chuẩn trở lên là đủ dùng; màn hình lớn hơn giúp thoải mái khi soạn workflow và xem bảng agent. Trên tablet hoặc cửa sổ hẹp, sidebar thu gọn thành menu trượt, nội dung cuộn theo trang thay vì cố nhét layout desktop. Hệ thống không nhắm tới điện thoại dọc và không yêu cầu in ấn.

Màu hiển thị theo chuẩn True Color của trình duyệt hiện đại. Toàn bộ giao diện console dùng tiếng Việt; cấu trúc mã nguồn vẫn chuẩn bị sẵn khóa dịch để mở rộng sang ngôn ngữ khác nếu cần.

Agent trên máy trạm có giao diện tối giản qua biểu tượng khay hệ thống: hiển thị trạng thái kết nối, cho phép cấu hình địa chỉ server và khóa agent. Phạm vi mô tả chi tiết trong báo cáo tập trung vào console web vì đây là nơi thực hiện các use case quản lý fleet, task, workflow và trigger.

#### Cấu trúc layout và điều hướng

Thiết kế theo khung shell cố định gồm ba vùng chính. Thanh điều hướng bên trái liệt kê các module: tổng quan, quản lý agent, task, workflow, tự động hóa, bot Telegram, thanh toán và tài liệu; riêng quản trị viên còn thấy thêm mục người dùng và nhật ký audit. Mục đang chọn được làm nổi bật bằng màu nhấn và icon đậm hơn.

Thanh trên cùng chứa ô tìm kiếm toàn cục, nút thông báo, menu tài khoản và chỉ báo kết nối thời gian thực với server. Vùng nội dung chính bắt đầu bằng tiêu đề trang kèm mô tả ngắn; các khối dữ liệu đặt trong thẻ bo góc, nền mờ nhẹ, tạo cảm giác phân tầng rõ ràng trên nền tối.

Các trang soạn thảo chuyên sâu — workflow, mẫu task, kịch bản trình duyệt, bản ghi desktop — chuyển sang chế độ gần toàn màn hình: ẩn sidebar, để lại thanh công cụ trên cùng (lưu, chạy thử, hoàn tác) và vùng canvas chiếm phần lớn diện tích, tránh cuộn dọc khi kéo thả node.

#### Quy chuẩn thành phần giao diện

Hệ thống dùng **giao diện tối** xuyên suốt: nền xanh đen đậm, các lớp surface sáng dần theo chiều sâu, chữ sáng dễ đọc. Màu nhấn xanh lam dùng cho hành động chính; xanh lá cho trạng thái thành công; đỏ nhạt cho lỗi và thao tác nguy hiểm. Không thiết kế chế độ sáng ban đầu nhằm giảm mỏi mắt khi xem log và bảng dữ liệu lâu.

Nút bấm chia bốn nhóm thống nhất. Nút **chính** dùng cho hành động quan trọng như tạo task hay chạy workflow. Nút **phụ** chỉ viền, dùng cho hủy hoặc quay lại. Nút **phá hủy** dùng tông cảnh báo cho xóa agent hoặc hủy task đang chạy. Nút **icon** chỉ hiện biểu tượng, dùng cho làm mới hoặc lọc. Kích thước và bo góc đồng nhất trên toàn ứng dụng; trạng thái vô hiệu hóa làm mờ nút để người dùng nhận biết ngay.

Form nhập liệu và bảng dữ liệu dùng chung kiểu chữ, khoảng cách và hiệu ứng focus. Bảng agent, task và audit có tiêu đề cột cố định, hỗ trợ sắp xếp, lọc và phân trang ở cuối trang. Trạng thái agent và task hiển thị bằng nhãn màu: online, offline, đang bận, thất bại — mỗi trạng thái một màu riêng để quét nhanh bằng mắt.

Phản hồi người dùng được chuẩn hóa: thông báo toast xuất hiện góc trên bên phải, tự biến mất sau vài giây hoặc đóng tay; bảng hiển thị khung xương khi đang tải; thao tác xóa hoặc hủy quan trọng yêu cầu xác nhận qua hộp thoại; lỗi form hiển thị ngay dưới trường nhập. Trang tổng quan gom các thẻ thống kê hàng trên (số agent online, task trong ngày, workflow đang chạy, lỗi gần đây) và biểu đồ xu hướng task cùng danh sách agent cần chú ý ở hàng dưới.

Chữ nội dung dùng font sans-serif hiện đại; log, mã định danh và biểu thức lịch dùng font monospace để dễ đối chiếu.

#### Wireframe các màn hình quan trọng

Các hình minh họa dưới đây là **wireframe hoặc mockup thiết kế** — thể hiện bố cục và luồng thao tác, không phải giao diện sản phẩm hoàn chỉnh.

**Dashboard (xem tổng quan):** hàng trên là các thẻ số liệu; hàng dưới bên trái là biểu đồ task theo thời gian, bên phải là danh sách agent offline gần đây và lối tắt tạo task mới.

[chèn Hình 4.5 — Wireframe thiết kế Dashboard; mockup/wireframe, không phải screenshot sản phẩm]

**Trình soạn workflow (thiết kế workflow):** canvas đồ thị ở giữa; cột trái là danh sách loại bước; cột phải là thuộc tính bước đang chọn; thanh trên có lưu, chạy thử và điều khiển thu phóng.

[chèn Hình 4.6 — Wireframe thiết kế trình soạn workflow]

**Quản lý agent (quản lý fleet):** bảng liệt kê tên máy, địa chỉ, trạng thái kết nối, thời điểm hoạt động cuối và các thao tác; có bộ lọc theo trạng thái; nút thêm agent mở hộp thoại hiển thị khóa kết nối một lần duy nhất.

[chèn Hình 4.7 — Wireframe thiết kế trang quản lý agent]

**Trang task:** chia tab danh sách task và mẫu task; form tạo task gồm chọn agent, loại tác vụ, nội dung lệnh hoặc payload, thời gian chờ tối đa; khu vực kết quả tách riêng phía dưới để hiển thị log và mã thoát.

**Trang tự động hóa và trigger:** form cấu hình lịch chạy hoặc liên kết bot Telegram, xem trước lần chạy kế tiếp, bảng lịch sử các lần kích hoạt.

Giao diện agent trên khay hệ thống gồm menu kết nối hoặc ngắt, mở log và thoát; hộp cấu hình nhỏ gọn, đủ các trường cần thiết khi cài đặt lần đầu.

### 4.2.2. Thiết kế lớp

Mục 4.1.3 đã trình bày quan hệ giữa các lớp ở mức gói. Mục này mô tả chi tiết bốn lớp trung tâm của hệ thống — ba phía server NestJS và một phía agent Rust — kèm biểu đồ trình tự cho ba luồng nghiệp vụ: chạy task thủ công, chạy workflow và kích hoạt workflow qua Telegram.

#### Lớp điều phối task trên server

Lớp **TasksService** đảm nhiệm vòng đời task từ khi người dùng yêu cầu đến khi có kết quả cuối cùng. Lớp này phụ thuộc vào dịch vụ truy cập cơ sở dữ liệu để ghi và đọc bản ghi task, dịch vụ agent để kiểm tra máy trạm còn kết nối hay không, gateway realtime để đẩy trạng thái và gửi lệnh hủy, dịch vụ gói đăng ký để chặn tạo task khi hết hạn, và hàng đợi nền để xếp job thực thi.

Thuộc tính nghiệp vụ chính gắn với từng task gồm loại tác vụ, lệnh hoặc payload, trạng thái, kết quả, mã thoát, số lần thử lại và thời gian chờ tối đa. Phương thức **tạo task** kiểm tra quyền sở hữu agent; nếu agent không sẵn sàng thì ghi task thất bại ngay và thông báo console, ngược lại ghi trạng thái chờ và đưa vào hàng đợi. Phương thức **tra cứu** hỗ trợ lọc theo trạng thái, loại, agent và từ khóa. Phương thức **hủy** chuyển task sang trạng thái kết thúc; nếu task đang chạy trên agent thì gửi thêm tín hiệu hủy qua WebSocket. Phương thức **chạy lại** reset kết quả cũ và xếp hàng lần nữa. Phương thức **chạy từ mẫu** tái sử dụng cấu hình đã lưu. Các phương thức nội bộ cập nhật trạng thái, ghi log từng bước và đưa job vào hàng đợi BullMQ. Thiết kế đặt thời gian chờ ở mức vài phút, giới hạn số lần thử lại và ưu tiên task khẩn trong hàng đợi. Chi tiết mô hình hai pha enqueue/dispatch và chính sách worker khi agent không sẵn sàng xem **mục 5.2**.

#### Lớp gateway giao tiếp agent

Lớp **AgentsGateway** quản lý kênh WebSocket riêng cho agent, tách biệt với kênh console. Khi agent kết nối, gateway xác thực khóa agent qua handshake bảo mật, kiểm tra gói đăng ký và giới hạn số agent, rồi gán socket vào phòng theo định danh agent và cập nhật trạng thái online trên cơ sở dữ liệu. Khi ngắt kết nối, trạng thái chuyển offline nếu không còn phiên nào.

Gateway định kỳ nhận heartbeat từ agent để cập nhật thời điểm hoạt động cuối và lưu telemetry gần nhất. Cơ chế xử lý race reconnect, heartbeat và mô hình outbound-only được phân tích đầy đủ tại **mục 5.1**. Khi agent trả kết quả task, gateway chuyển tiếp cho TasksService cập nhật cơ sở dữ liệu, báo cho runtime workflow nếu task thuộc một lần chạy workflow, và push sự kiện lên console. Khi cần thực thi, gateway gửi lệnh tới đúng agent đang online; khi cần hủy, gửi tín hiệu cancel tương ứng. Khóa agent không được truyền trên query string; kết quả quá dài được rút gọn trên kênh realtime nhưng bản đầy đủ vẫn lưu ở cơ sở dữ liệu.

#### Lớp runtime workflow trên server

Lớp **WorkflowRuntimeService** điều phối việc chạy workflow theo đồ thị đã soạn trên giao diện. Lớp phụ thuộc dịch vụ automation để nạp định nghĩa workflow và thực thi từng nhánh đồ thị, dịch vụ cơ sở dữ liệu để ghi lần chạy và tiến trình từng bước, dịch vụ gói đăng ký, và dịch vụ tiến độ Telegram khi workflow được kích hoạt từ bot.

Phương thức **bắt đầu lần chạy** tạo bản ghi lần chạy workflow, khởi tạo các nhánh song song nếu đồ thị có nhiều điểm bắt đầu, rồi duyệt từng bước: thay thế biến tham chiếu bước trước, tạo task con qua TasksService, chờ kết quả, ghi trạng thái từng bước. Có thể chạy đồng bộ hoặc bất đồng bộ tùy yêu cầu API. Phương thức **bắt đầu từ trigger** inject thêm biến ngữ cảnh từ cron hoặc Telegram rồi tái sử dụng cùng luồng thực thi. Phương thức **lưu biến runtime** ghi snapshot biến workflow sau các bước đọc Excel hoặc gán biến. Phương thức **tra cứu lịch sử** phục vụ giao diện theo dõi. Workflow chỉ được phép chạy khi đồ thị đã có liên kết hợp lệ; mỗi bước có cấu hình xử lý khi lỗi: dừng hẳn, bỏ qua, hoặc thử lại. Thuật toán lập lịch đồ thị event-driven và cơ chế resolve biến `{{steps.*}}` được trình bày chi tiết tại **mục 5.3**.

#### Module thực thi task trên agent

Phía agent, module **TaskRegistry** cùng trait **TaskHandler** áp dụng mẫu Strategy: mỗi loại task có một handler riêng, đăng ký trong danh sách tĩnh. Cấu trúc task nhận từ server mang định danh, loại, lệnh, payload tùy chọn và thời gian chờ. Ngữ cảnh thực thi cung cấp cấu hình agent, lớp truy cập nền tảng Windows và cơ chế hủy task giữa chừng.

Mỗi handler khai báo loại task phụ trách và triển khai phương thức thực thi bất đồng bộ, kiểm tra cờ hủy trong quá trình chạy. Hàm điều phối tra cứu handler phù hợp, gọi thực thi, chuyển kết quả sang định dạng gửi lại server; nếu không tìm thấy handler hoặc nền tảng không hỗ trợ loại đó thì trả lỗi rõ ràng kèm danh sách loại được hỗ trợ. Các handler hiện có bao gồm chạy lệnh, script, thao tác file, mở hoặc đóng ứng dụng, tự động hóa desktop, mở rộng Chrome, chụp màn hình, gọi HTTP, gửi Telegram — một số loại chỉ bật trên Windows hoặc khi cấu hình agent cho phép.

Thiết kế chi tiết các lớp Controller, DTO và handler phụ có thể bổ sung ở Phụ lục nếu cần.

#### Biểu đồ trình tự

**Hình 4.8 — Chạy task thủ công:** Người dùng gửi yêu cầu tạo task qua console; TasksService ghi task và xếp hàng; worker lấy job và nhờ AgentsGateway gửi lệnh thực thi tới agent; agent chạy handler tương ứng rồi trả kết quả; server cập nhật cơ sở dữ liệu và đẩy sự kiện lên giao diện.

[chèn Hình 4.8 — Biểu đồ trình tự dispatch task; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.8]

**Hình 4.8b — Chạy workflow:** Người dùng yêu cầu thực thi workflow; WorkflowRuntime tạo bản ghi lần chạy, lặp từng bước trên đồ thị — mỗi bước sinh task, chờ agent hoàn thành, ghi tiến trình — rồi kết thúc trạng thái thành công hoặc thất bại.

[chèn Hình 4.8b — Biểu đồ trình tự chạy workflow; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.8b]

**Hình 4.8c — Trigger Telegram:** Telegram gửi webhook tới server; module trigger khớp cấu hình bot và lệnh; WorkflowRuntime khởi chạy workflow với biến ngữ cảnh từ Telegram, sau đó tiếp tục cùng luồng như Hình 4.8b.

[chèn Hình 4.8c — Biểu đồ trình tự trigger Telegram; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.8c]

Ba biểu đồ mô tả luồng truyền thông điệp giữa các đối tượng đã thiết kế ở trên, phù hợp với cách triển khai thực tế qua REST API, hàng đợi Redis, WebSocket hai chiều và agent native trên Windows.

### 4.2.3. Thiết kế cơ sở dữ liệu

Hệ thống chọn PostgreSQL làm kho dữ liệu quan hệ chính, quản lý schema qua Prisma với migration có phiên bản. Redis chỉ phục vụ hàng đợi job tạm thời, không thay thế lưu trữ nghiệp vụ lâu dài. Thiết kế ưu tiên toàn vẹn dữ liệu giữa các thực thể, tách rõ dữ liệu **định nghĩa** (workflow, mẫu task) và dữ liệu **lịch sử** (lần chạy workflow, log task). Mục này trình bày ba lớp minh họa: biểu đồ thực thể–liên kết (khái niệm), lược đồ logic nhóm bảng (thiết kế), và ảnh chụp cơ sở dữ liệu thực tế sau triển khai.

#### Biểu đồ thực thể–liên kết (mức khái niệm)

Hình 4.9 thể hiện các thực thể nghiệp vụ cốt lõi và quan hệ giữa chúng ở mức khái niệm, phục vụ đối chiếu với use case Chương 2. Một người dùng sở hữu nhiều agent, task, workflow, mẫu task, bot Telegram và trigger. Mỗi agent thực thi nhiều task; mỗi workflow gồm nhiều bước định nghĩa, nhiều lần chạy và nhiều trigger. Mỗi lần chạy workflow ghi nhiều bước thực thi và có thể sinh ra nhiều task con. Task có thể độc lập hoặc gắn với một lần chạy workflow; mỗi task có nhiều dòng log. Trigger loại Telegram có thể liên kết tùy chọn với một bot.

[chèn Hình 4.9 — Biểu đồ thực thể–liên kết (E-R) nghiệp vụ cốt lõi; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.9]

Mô hình mang tính **đa tenant theo người dùng**: mọi tài nguyên vận hành gắn với một tài khoản; quản trị viên truy cập cross-user qua API riêng. Workflow vừa lưu đồ thị dạng JSON phục vụ editor, vừa chuẩn hóa bước trong bảng riêng để runtime truy vấn hiệu quả.

#### Lược đồ logic cơ sở dữ liệu (mức thiết kế)

Hình 4.9b mô tả cách phân **nhóm bảng** theo miền nghiệp vụ và luồng phụ thuộc giữa các nhóm — bước trung gian từ E-R khái niệm sang schema PostgreSQL cụ thể. Bốn nhóm chính:

- **Tài khoản và gói cước:** bảng người dùng, gói đăng ký, thanh toán — nền tảng xác thực, phân quyền và giới hạn số agent.
- **Fleet và task:** bảng agent, task, log task, mẫu task — lõi điều phối máy trạm và lịch sử thực thi.
- **Workflow và trigger:** bảng workflow, bước workflow, lần chạy, bước chạy, nhánh chạy, trigger, lịch sử kích hoạt — tự động hóa nhiều bước và lập lịch.
- **Quản trị và mở rộng:** nhật ký audit, bot Telegram, kịch bản Chrome, bản ghi desktop, phiên điều khiển từ xa — bổ trợ vận hành và tính năng nâng cao.

Mũi tên trên sơ đồ biểu diễn phụ thuộc dữ liệu: nhóm fleet/task và workflow/trigger đều gắn với tài khoản; task sinh từ workflow tham chiếu ngược lại lần chạy workflow; trigger tham chiếu workflow và tùy chọn bot Telegram.

[chèn Hình 4.9b — Lược đồ logic nhóm bảng CSDL; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.9b]

#### Mô hình quan hệ mở rộng (mức vật lý)

Hình 4.9c bổ sung các thực thể và quan hệ không vẽ trên Hình 4.9 để tránh rối: nhật ký audit (độc lập, ghi hành vi admin), lịch sử kích hoạt trigger, nhánh song song workflow_run, liên kết task–workflow_run, và nhóm billing. Sơ đồ thể hiện rõ khóa ngoại bắt buộc (user–agent–task) và khóa ngoại tùy chọn (task thuộc lần chạy workflow, trigger gắn bot Telegram).

[chèn Hình 4.9c — Biểu đồ E-R mở rộng (audit, trigger, billing); nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.9c]

#### Ánh xạ sang PostgreSQL và ràng buộc

Các thực thể E-R ánh xạ trực tiếp sang bảng PostgreSQL với tên snake_case. Bảng người dùng lưu email duy nhất, vai trò, trạng thái gói đăng ký. Bảng agent lưu khóa kết nối duy nhất, trạng thái kết nối, metadata máy và thời điểm heartbeat cuối. Bảng task lưu loại, trạng thái vòng đời, payload linh hoạt, kết quả, liên kết bắt buộc tới agent và người dùng. Bảng log task ghi từng dòng theo mức thông tin, cảnh báo hoặc lỗi. Bảng workflow và workflow_step lưu cấu trúc quy trình; workflow_run và workflow_step_run lưu tiến trình từng lần thực thi. Bảng trigger và trigger_execution phục vụ lịch cron và webhook Telegram. Bảng audit_log phục vụ tra cứu theo thời gian, hành động và loại tài nguyên.

Các trường trạng thái dùng kiểu liệt kê ở tầng cơ sở dữ liệu để ràng buộc giá trị hợp lệ. Các trường cấu hình phức tạp — payload task, đồ thị workflow, cấu hình bước, metadata agent — lưu dạng JSON nhằm tránh migration liên tục khi bổ sung loại task hoặc node mới. Schema đầy đủ được khai báo trong file `prisma/schema.prisma`; mỗi thay đổi được version hóa qua Prisma Migrate và áp dụng tự động khi deploy Railway.

#### Chiến lược lưu trữ và phân vai hệ thống

Chỉ mục đặt trên các cột thường lọc: người dùng kết hợp trạng thái task, agent theo trạng thái, lần chạy workflow theo thời gian, trigger theo thời điểm chạy kế tiếp để job nền quét lịch. Quy tắc xóa cascade: xóa tài khoản sẽ xóa agent, task và workflow thuộc tài khoản đó. Trạng thái online của agent cập nhật qua heartbeat định kỳ; server có logic nền đánh offline khi lâu không nhận tín hiệu. Kết quả task dung lượng lớn lưu đầy đủ trong PostgreSQL dù kênh WebSocket có thể rút gọn payload khi push realtime.

PostgreSQL giữ toàn bộ dữ liệu bền; Redis chỉ giữ job dispatch ngắn hạn; Firebase Hosting chỉ phục vụ file tĩnh console. Hệ thống không tách sang document store riêng vì JSON trong PostgreSQL đã đủ linh hoạt mà vẫn nối được dữ liệu khi cần báo cáo.

#### Minh họa cơ sở dữ liệu triển khai *(ảnh thực tế)*

Hai hình dưới đây là **ảnh chụp cơ sở dữ liệu thực tế** (khác với biểu đồ thiết kế 4.9–4.9c), minh chứng schema đã được triển khai và có dữ liệu vận hành.

**Hình 4.14 — Schema Prisma:** chụp file `prisma/schema.prisma` trong IDE hoặc sơ đồ Prisma generate (`npx prisma generate` / extension Prisma), thể hiện các model chính và quan hệ `@relation`.

[chèn Hình 4.14 — Ảnh schema Prisma / mô hình ORM]

**Hình 4.15 — Giao diện quản trị CSDL:** chụp Prisma Studio (`npx prisma studio`) hoặc pgAdmin/Railway Data tab — hiển thị danh sách bảng và vài dòng mẫu ở bảng `agents`, `tasks`, `workflows` (che email/token nhạy cảm nếu cần).

[chèn Hình 4.15 — Ảnh Prisma Studio hoặc pgAdmin — bảng agents, tasks, workflows]

Các bảng phụ — gói cước, thanh toán, kịch bản Chrome, bản ghi desktop — mở rộng nghiệp vụ billing và tự động hóa nâng cao; quan hệ đầy đủ nằm trong schema Prisma, có thể trình bày thêm ở Phụ lục.

## 4.3. Xây dựng ứng dụng

### 4.3.1. Thư viện và công cụ sử dụng

Quá trình phát triển hệ thống sử dụng ngôn ngữ TypeScript (backend và console web), Rust (agent native) và TypeScript/Electron (shell agent). Các phiên bản dưới đây lấy từ file khai báo phụ thuộc của dự án (`package.json`, `Cargo.toml`, `docker-compose.yml`) tại thời điểm hoàn thiện đồ án (tháng 6/2026). Bảng liệt kê theo mẫu quy chế: **mục đích**, **công cụ kèm phiên bản**, **địa chỉ URL** trang chủ hoặc tài liệu chính thức. Do số lượng mục nhiều, khi chèn vào Word nên **xoay ngang trang (Landscape)** hoặc thu nhỏ cỡ chữ bảng để đảm bảo đọc được đủ ba cột.

**Bảng 4.5 — Danh sách thư viện và công cụ sử dụng**

| Mục đích | Công cụ | Địa chỉ URL |
|----------|---------|-------------|
| IDE lập trình | Visual Studio Code 1.9x / Cursor IDE | https://code.visualstudio.com/ |
| Ngôn ngữ backend / script | TypeScript 5.7.3 | https://www.typescriptlang.org/ |
| Runtime backend | Node.js 20 LTS (engines ≥ 20) | https://nodejs.org/ |
| Framework backend | NestJS 11.0.1 | https://nestjs.com/ |
| ORM và migration CSDL | Prisma 6.19.3 | https://www.prisma.io/ |
| Hệ quản trị CSDL | PostgreSQL 16 (Alpine, Docker) | https://www.postgresql.org/ |
| Cache và hàng đợi | Redis 7 (Alpine, Docker) | https://redis.io/ |
| Thư viện hàng đợi job | BullMQ 5.73.5 | https://docs.bullmq.io/ |
| Giao tiếp thời gian thực (server) | Socket.IO 4.x (NestJS WebSocket 11.1.19) | https://socket.io/ |
| Xác thực JWT | @nestjs/jwt 11.0.2, passport-jwt 4.0.1 | https://docs.nestjs.com/security/authentication |
| Mã hóa mật khẩu | bcrypt 6.0.0 | https://github.com/kelektiv/node.bcrypt.js |
| Validate DTO | class-validator 0.15.1 | https://github.com/typestack/class-validator |
| Lập lịch trigger (cron) | @nestjs/schedule 6.1.1 | https://docs.nestjs.com/techniques/task-scheduling |
| Tài liệu API REST | Swagger / OpenAPI (@nestjs/swagger 11.2.7) | https://swagger.io/ |
| Ghi log server | nestjs-pino 4.6.1, pino 9.x | https://getpino.io/ |
| Gửi email (OTP, thông báo) | Nodemailer 8.0.10, Resend 6.12.4 | https://nodemailer.com/ |
| Đăng nhập Google OAuth | google-auth-library 10.7.0 | https://developers.google.com/identity |
| Runtime frontend | React 19.0.1 | https://react.dev/ |
| Bundler frontend | Vite 6.2.3 | https://vite.dev/ |
| Định tuyến SPA | React Router DOM 7.15.1 | https://reactrouter.com/ |
| CSS utility | Tailwind CSS 4.1.14 | https://tailwindcss.com/ |
| Biểu đồ dashboard | Recharts 3.8.1 | https://recharts.org/ |
| Soạn workflow (canvas) | React Flow (@xyflow/react 12.10.2) | https://reactflow.dev/ |
| Client WebSocket (console) | socket.io-client 4.8.1 | https://socket.io/docs/v4/client-api/ |
| Fetch và cache API | TanStack React Query 5.90.5 | https://tanstack.com/query |
| Ngôn ngữ agent native | Rust (edition 2021) | https://www.rust-lang.org/ |
| Async runtime agent | Tokio 1.40.0 | https://tokio.rs/ |
| WebSocket client agent | rust_socketio 0.6.0 | https://docs.rs/rust_socketio |
| HTTP client agent | reqwest 0.12.9 | https://docs.rs/reqwest |
| Shell agent (tray, installer) | Electron 32.0.0, electron-builder 25.1.8 | https://www.electronjs.org/ |
| Container hóa môi trường dev | Docker Compose (postgres:16, redis:7) | https://docs.docker.com/compose/ |
| Unit / integration test backend | Jest 30.0.0, ts-jest 29.2.5, Supertest 7.0.0 | https://jestjs.io/ |
| Kiểm thử E2E (thủ công + UI) | Trình duyệt Chrome/Edge, agent Windows thật | https://www.google.com/chrome/ |
| Quản lý schema / xem dữ liệu | Prisma Studio (npx prisma studio) | https://www.prisma.io/studio |
| Triển khai API production | Railway (Nixpacks, Node 20) | https://railway.com/ |
| Host console web tĩnh | Firebase Hosting | https://firebase.google.com/products/hosting |
| Redis managed production | Redis Cloud | https://redis.io/cloud/ |
| API Telegram Bot (trigger) | Telegram Bot API | https://core.telegram.org/bots/api |
| Hệ điều hành phát triển | Windows 11, Windows 10 (agent) | https://www.microsoft.com/windows |
| Quản lý mã nguồn | Git | https://git-scm.com/ |

*Ngoài các mục trên, dự án còn dùng thư viện phụ trợ (Helmet bảo mật HTTP, cron-parser, uuid, lucide-react icon, motion animation…) với phiên bản cố định trong `package-lock.json` / `Cargo.lock`; chi tiết đầy đủ có thể tra cứu trực tiếp trong repository.*

Công cụ được chọn đồng bộ với stack đã trình bày Chương 3: NestJS + Prisma + PostgreSQL cho tầng nghiệp vụ, BullMQ + Redis cho dispatch bất đồng bộ, React + Vite cho console, Rust + Electron cho agent Windows. Môi trường dev dùng Docker Compose; production tách backend (Railway), CSDL/Redis managed và SPA tĩnh (Firebase) — phù hợp quy mô đồ án, tránh vận hành hạ tầng phức tạp không cần thiết.

### 4.3.2. Kết quả đạt được

Kết quả của đồ án là một **hệ thống agent–server hoàn chỉnh**, đã phát triển, kiểm thử và triển khai production: người dùng quản lý fleet máy trạm, tạo và theo dõi task, soạn workflow nhiều bước, cấu hình trigger (cron, Telegram) qua console web; agent Windows nhận lệnh realtime, thực thi trên OS và trả kết quả về server. Hệ thống đáp ứng các use case UC001–UC005 và các yêu cầu phi chức năng Chương 2 trên môi trường Railway + Firebase + PostgreSQL/Redis managed.

#### Sản phẩm đóng gói

Đồ án đóng gói **ba sản phẩm phần mềm** tách biệt, tương ứng ba tầng kiến trúc (mục 4.1.1). Mỗi sản phẩm có vai trò riêng, triển khai và nâng cấp độc lập.

**Bảng 4.7 — Mô tả sản phẩm đóng gói**

| Sản phẩm | Thành phần chính | Vai trò / ý nghĩa | Cách đóng gói / triển khai |
|----------|------------------|------------------|----------------------------|
| **Server API** | Mã biên dịch NestJS (`dist/`), Prisma Client, worker BullMQ, gateway WebSocket `/ws/agent` và `/ws/client` | Trung tâm điều phối: REST API, xác thực JWT/RBAC, ghi CSDL, xếp hàng task, push realtime | Build `npm run build`; chạy `node dist/main.js` trên Railway hoặc Docker image multi-stage |
| **Console web** | Ứng dụng React SPA (HTML, JS, CSS tĩnh) | Giao diện quản trị cho người dùng và admin: dashboard, agent, task, workflow, trigger, billing | Build Vite → thư mục `admin-stationhub/dist/`; deploy Firebase Hosting |
| **Agent Windows** | `stationhub-agent-native.exe` (Rust) + ứng dụng Electron (tray, cấu hình, cài service) | Thực thi task tại máy trạm: kết nối WSS, heartbeat, handler lệnh/desktop/HTTP… | Build Rust release + `electron-builder` → installer NSIS (`.exe`) hoặc chạy portable |

Ba sản phẩm giao tiếp qua HTTPS/WSS; agent **không** mở port inbound — chỉ kết nối ra server, phù hợp triển khai trong mạng nội bộ hoặc qua NAT.

#### Phạm vi chức năng đã hiện thực

Ngoài ba gói phần mềm, hệ thống cung cấp các nhóm chức năng sau (ánh xạ use case):

- **Xác thực và phân quyền:** đăng ký, đăng nhập, JWT refresh, đăng nhập Google, RBAC USER/ADMIN, giới hạn theo gói đăng ký.
- **Quản lý fleet:** đăng ký agent, trạng thái online/offline/busy, heartbeat, telemetry, remote file, wake-on-LAN (nền tảng hỗ trợ).
- **Task và template:** tạo task nhiều loại (COMMAND, HTTP_REQUEST, desktop automation…), template, hủy/retry, log và kết quả realtime.
- **Workflow và trigger:** editor đồ thị, chạy đồng bộ/bất đồng bộ, biến giữa bước, trigger cron và Telegram.
- **Quản trị:** quản lý user, audit log, gói cước và thanh toán (SePay), dashboard thống kê.

#### Thống kê quy mô mã nguồn

Số liệu thống kê dưới đây đo trên mã nguồn dự án (loại trừ `node_modules`, `dist`, `target`, `.git`), thời điểm **tháng 6/2026**, bằng công cụ đếm dòng và kích thước file hệ thống.

**Bảng 4.8 — Thống kê mã nguồn theo thành phần**

| Thành phần | Số file mã nguồn | Số dòng mã (LOC) | Dung lượng mã nguồn |
|------------|------------------|------------------|---------------------|
| Backend NestJS (`src/`) | 138 | 13.283 | ~420 KB |
| Console web (`admin-stationhub/src/`) | 211 | 30.478 | ~1,15 MB |
| Agent core Rust (`agent/core/src/`) | 37 | 5.324 | ~187 KB |
| Agent desktop Electron (`agent/desktop/src/`) | 18 | 1.270 | ~40 KB |
| Schema CSDL (`prisma/schema.prisma`) | 1 | 492 | ~14 KB |
| **Tổng cộng** | **405** | **50.847** | **~1,8 MB** |

**Bảng 4.9 — Thống kê kiến trúc và dữ liệu**

| Hạng mục | Số lượng | Ghi chú |
|----------|----------|---------|
| Gói phần mềm (tầng kiến trúc, Hình 4.1) | 8 gói (12 gói con) | console.web, agent.shell, server.quan-tri (2), server.dieu-phoi (2), infrastructure, datastore (2), agent.core |
| Module NestJS (`src/modules/`) | 14 module nghiệp vụ | auth, users, agents, tasks, automation, triggers, admin, billing, … |
| Lớp `@Module` NestJS | 15 | Gồm `AppModule`, `PrismaModule` |
| Service / Controller backend | 24 service, 13 controller | Không kể DTO, guard, gateway |
| Gateway / worker realtime | 3 | `AgentsGateway`, `ClientGateway`, `TasksProcessor` |
| Trang / view React (console) | 28 | Dashboard, Agents, Tasks, Workflows, Automations, Admin, … |
| Component React (`.tsx`) | ~130 | Form, workflow editor, bảng dữ liệu, … |
| Model CSDL (Prisma) | 19 bảng | User, Agent, Task, Workflow, Trigger, Payment, AuditLog, … |
| File kiểm thử unit (`.spec.ts`) | 10 | Backend Jest |
| Handler task agent (Rust) | 12+ loại | Command, HTTP, desktop, Chrome, … |

#### Dung lượng sản phẩm build

**Bảng 4.10 — Dung lượng artefact đóng gói (đo local, build release)**

| Sản phẩm | Artefact | Dung lượng (ước lượng) |
|----------|----------|-------------------------|
| Server API | Thư mục `dist/` sau `npm run build` | ~1,4 MB |
| Console web | Thư mục `admin-stationhub/dist/` sau `npm run build` | ~2,0 MB (gzip nhỏ hơn khi host Firebase) |
| Agent native | `agent/bin/stationhub-agent-native.exe` | ~9,3 MB |
| Agent desktop | Installer NSIS (`agent/desktop/release/`) | ~540 MB (gồm Electron runtime, binary native, tài nguyên) |

Dung lượng installer agent lớn do bundled Electron và runtime Windows; binary Rust lõi thực thi chỉ chiếm phần nhỏ. Server và console nhẹ, phù hợp deploy cloud và CDN.

#### Đánh giá ngắn

Quy mô **~51 nghìn dòng** mã trên **405 file** cho thấy đồ án vượt mức demo: có module hóa rõ (14 domain backend, 28 màn console), schema CSDL đầy đủ (19 model), agent native xử lý đa dạng task type. Ba sản phẩm đóng gói tách biệt giúp vận hành thực tế — nâng cấp console không cần build lại agent, scale server độc lập với số lượng máy trạm. Kết quả minh họa ở mục 4.3.3 (screenshot) và mục 4.5 (triển khai production).

### 4.3.3. Minh họa các chức năng chính *(giao diện sản phẩm)*

Phần này minh họa **sản phẩm sau triển khai** (screenshot production/local), khác với wireframe thiết kế ở mục 4.2.1.

1. **Đăng nhập và JWT** — form login, lưu token, gọi API có Bearer.
2. **Fleet agent** — danh sách agent, badge ONLINE/OFFLINE, telemetry heartbeat.
3. **Tạo task COMMAND** — nhập lệnh PowerShell/cmd, chọn agent, xem kết quả stdout/stderr.
4. **Workflow** — kéo thả node, nối edge, chạy workflow nhiều bước.
5. **Trigger Telegram** — đăng ký bot, map lệnh `/run` → workflow.

[chèn Hình 4.10 — Màn hình tạo task và kết quả COMPLETED]
[chèn Hình 4.11 — Màn hình workflow đang RUNNING]

## 4.4. Kiểm thử

Kiểm thử nhằm xác nhận hệ thống đáp ứng use case và yêu cầu phi chức năng đã đặc tả Chương 2. Do bản chất agent–server (WebSocket, hàng đợi, agent Windows thật), đồ án kết hợp **kiểm thử tự động** ở tầng logic thuần và **kiểm thử tích hợp / end-to-end thủ công** cho luồng nghiệp vụ end-to-end. Phạm vi báo cáo tập trung ba chức năng trọng yếu: **kết nối agent**, **tạo và thực thi task**, **chạy workflow**; các trường hợp khác (billing, audit, trigger Telegram…) ghi ở Phụ lục nếu cần.

### 4.4.1. Kỹ thuật kiểm thử sử dụng

| Kỹ thuật | Mục đích | Công cụ / cách thực hiện |
|----------|----------|---------------------------|
| **Kiểm thử đơn vị (Unit test)** | Kiểm tra hàm/lớp cô lập: parse cron, biến workflow, scheduler graph, slug key… | Jest 30, ts-jest; file `*.spec.ts` trong `src/` và `admin-stationhub/src/` |
| **Kiểm thử module NestJS** | Kiểm tra controller/service với dependency mock | `@nestjs/testing`, `TestingModule` |
| **Kiểm thử tích hợp (Integration)** | API REST + PostgreSQL + Redis + BullMQ worker trên local | Docker Compose; gọi API bằng Postman/curl; quan sát CSDL và hàng đợi |
| **Kiểm thử giao diện thủ công** | Luồng console: login, tạo task, xem realtime | Trình duyệt Chrome; DevTools Network/WS |
| **Kiểm thử end-to-end (E2E)** | Luồng đầy đủ: console → server → agent Windows → kết quả ngược | Agent native + Electron trên Windows 10/11; server local hoặc Railway |
| **Kiểm thử hồi quy trên production** | Xác nhận bản deploy Railway + Firebase vẫn đúng luồng chính | Sau mỗi lần deploy; health `/api/health`, smoke test task COMMAND |

Môi trường kiểm thử **local:** PostgreSQL 16 và Redis 7 qua Docker Compose, API port 3000, console Vite port 5173, agent trỏ WebSocket local. Môi trường **production:** Railway (API/WSS), Firebase Hosting (SPA), Redis Cloud, PostgreSQL managed — agent Windows kết nối WSS outbound.

### 4.4.2. Thiết kế trường hợp kiểm thử — ba chức năng trọng yếu

#### Chức năng 1: Kết nối agent và cập nhật trạng thái fleet (UC001)

**Mục tiêu:** xác nhận agent xác thực bằng khóa hợp lệ, duy trì heartbeat, hiển thị ONLINE/OFFLINE trên console.

**Bảng 4.11 — Trường hợp kiểm thử kết nối agent**

| ID | Mô tả | Input / thao tác | Kết quả mong đợi | Kỹ thuật | Thực tế |
|----|-------|------------------|------------------|----------|---------|
| AG-01 | Kết nối thành công | Agent khởi động với `agentKey` đúng | WebSocket accepted; CSDL `status = ONLINE`; console badge xanh | E2E | **Đạt** |
| AG-02 | Khóa sai | `agentKey` không tồn tại | Server disconnect; không ghi ONLINE | E2E | **Đạt** |
| AG-03 | Heartbeat định kỳ | Agent online, chờ vài chu kỳ | `lastSeenAt` cập nhật; telemetry hiển thị | E2E + quan sát CSDL | **Đạt** |
| AG-04 | Mất kết nối đột ngột | Kill process agent | Sau khoảng grace, `status = OFFLINE` | E2E | **Đạt** |
| AG-05 | Tái kết nối | Khởi động lại agent sau AG-04 | ONLINE trở lại; socket map đúng | E2E | **Đạt** |
| AG-06 | Hết hạn gói đăng ký | User hết hạn subscription | Server từ chối kết nối, thông báo lỗi | Integration | **Đạt** |

#### Chức năng 2: Tạo và thực thi task (UC004)

**Mục tiêu:** xác nhận REST tạo task, BullMQ dispatch, agent thực thi và trả kết quả; console cập nhật realtime.

**Bảng 4.12 — Trường hợp kiểm thử task**

| ID | Mô tả | Input / thao tác | Kết quả mong đợi | Kỹ thuật | Thực tế |
|----|-------|------------------|------------------|----------|---------|
| TK-01 | Task COMMAND thành công | POST task `whoami` / `echo hello`, agent ONLINE | Trạng thái QUEUED → RUNNING → COMPLETED; có stdout | E2E | **Đạt** |
| TK-02 | Agent offline khi tạo | Tạo task khi agent OFFLINE | Task FAILED ngay với thông báo agent offline; không enqueue vô hạn | Integration | **Đạt** |
| TK-03 | Hủy task đang chạy | Cancel task RUNNING | CANCELLED; agent nhận cancel (nếu đang chạy) | E2E | **Đạt** |
| TK-04 | Timeout | Task sleep dài hơn timeout cấu hình | TIMEOUT hoặc FAILED theo thiết kế | E2E | **Đạt** |
| TK-05 | Retry thủ công | Retry task FAILED/COMPLETED | Task xếp hàng lại; chạy lần hai | E2E | **Đạt** |
| TK-06 | RBAC | USER A tạo task trên agent của USER B | HTTP 403/404 — không truy cập chéo | Integration | **Đạt** |
| TK-07 | Dispatch production | Cùng TK-01 trên Railway + agent WSS | COMPLETED; latency chấp nhận được qua Internet | E2E production | **Đạt** |

#### Chức năng 3: Chạy workflow nhiều bước (UC005)

**Mục tiêu:** runtime duyệt graph, sinh task con, ghi `WorkflowRun` / `WorkflowStepRun`, kết thúc COMPLETED hoặc FAILED.

**Bảng 4.13 — Trường hợp kiểm thử workflow**

| ID | Mô tả | Input / thao tác | Kết quả mong đợi | Kỹ thuật | Thực tế |
|----|-------|------------------|------------------|----------|---------|
| WF-01 | Workflow hai bước tuần tự | Bước 1 COMMAND → bước 2 COMMAND; chạy thủ công | WorkflowRun COMPLETED; hai StepRun COMPLETED | E2E | **Đạt** |
| WF-02 | Truyền biến giữa bước | Bước 1 gán output; bước 2 dùng `{{steps…}}` | Bước 2 nhận đúng giá trị thay thế | E2E | **Đạt** |
| WF-03 | Một bước FAILED, onFailure STOP | Bước cố ý lệnh sai | WorkflowRun FAILED; dừng không chạy bước sau | E2E | **Đạt** |
| WF-04 | Chạy bất đồng bộ | POST execute không `wait=true` | HTTP 202; runId; UI theo dõi RUNNING → COMPLETED | Integration + UI | **Đạt** |
| WF-05 | Graph chưa lưu edge | Execute workflow thiếu edge | HTTP 400 — báo lỗi graph | Integration | **Đạt** |
| WF-06 | Trigger cron | Trigger mỗi phút gắn workflow | Workflow tự chạy; `TriggerExecution` ghi nhận | E2E + chờ lịch | **Đạt** |

### 4.4.3. Kiểm thử tự động (unit test)

Hệ thống có **10 file** `*.spec.ts` backend (và một file spec phía console cho execution plan workflow). Chạy `npm test` tại thời điểm hoàn thiện báo cáo:

| Chỉ số | Số lượng |
|--------|----------|
| Test suite | 10 (7 đạt, 3 lỗi cấu hình mock) |
| Test case | 29 (26 đạt, 3 không chạy được) |
| Phạm vi đạt | `schedule.util`, `workflow-graph`, `workflow-variables`, `graph-scheduler`, `slug-key`, `trial-email`, `desktop-recordings`, … |

**Ba suite chưa đạt:** `auth.service.spec.ts` (lỗi biên dịch/khởi tạo module), `admin.controller.spec.ts` và `automation.service.spec.ts` (thiếu mock dependency trong `TestingModule`). **Lý do:** test module NestJS chưa khai báo đủ provider (MailService, AuditService, v.v.) — lỗi **hạ tầng test**, không phải lỗi nghiệp vụ runtime; luồng thật đã kiểm chứng bằng E2E. Hướng xử lý: bổ sung mock provider hoặc dùng e2e test Supertest — để hướng phát triển, không chặn triển khai production.

### 4.4.4. Tổng kết kết quả kiểm thử

**Bảng 4.6 — Tổng hợp kết quả kiểm thử**

| Nhóm | Số TC thiết kế | Số TC đạt | Số TC không đạt | Ghi chú |
|------|----------------|-----------|-----------------|---------|
| Kết nối agent (Bảng 4.11) | 6 | 6 | 0 | AG-01 → AG-06 |
| Task (Bảng 4.12) | 7 | 7 | 0 | TK-01 → TK-07 |
| Workflow (Bảng 4.13) | 6 | 6 | 0 | WF-01 → WF-06 |
| Unit test Jest | 29 | 26 | 3 | Lỗi mock module (mục 4.4.3) |
| **Tổng luồng nghiệp vụ (E2E/integration)** | **19** | **19** | **0** | Bao gồm smoke production |
| **Tổng có unit test** | **48** | **45** | **3** | Tỷ lệ đạt ~94% |

**Kết luận:** toàn bộ **19 trường hợp kiểm thử chức năng** thiết kế cho ba luồng trọng yếu **đều đạt** trên local và được xác nhận lại trên production (Railway, Firebase, agent WSS). Ba test case Jest không đạt do **cấu hình test chưa hoàn thiện**, đã phân tích ở mục 4.4.3; không phát hiện lỗi nghiệp vụ tương ứng trên môi trường chạy thật. Các trường hợp biên (timeout khi kill agent, task offline) cho kết quả FAILED/TIMEOUT **đúng thiết kế**, không tính là không đạt.

## 4.5. Triển khai

### 4.5.1. Mô hình triển khai

Hệ thống triển khai theo mô hình **tách tầng trên cloud + agent tại biên**:

- **Tầng trình bày:** console web tĩnh (HTML/JS/CSS) trên Firebase Hosting — CDN, HTTPS, không server render.
- **Tầng ứng dụng:** một service NestJS trên Railway — REST `/api`, WebSocket `/ws/agent` và `/ws/client`, worker BullMQ cùng process.
- **Tầng dữ liệu:** PostgreSQL managed (Railway) và Redis managed (Redis Cloud, TLS).
- **Tầng thực thi:** agent cài trên từng máy trạm Windows; **chỉ kết nối outbound** WSS tới Railway, không mở port inbound.

[chèn Hình 4.12 — Sơ đồ triển khai production; nguồn: `docs/bao-cao-bieu-do.md` § Hình 4.12]

Luồng truy cập: người dùng mở console trên Firebase → gọi API/WSS Railway → agent Windows duy trì kết nối WSS song song. Telegram webhook (nếu bật) gọi HTTPS vào Railway public URL.

### 4.5.2. Môi trường phát triển (triển khai thử nghiệm local)

Môi trường dev mô phỏng production trên máy lập trình viên, dùng Docker Compose cho hạ tầng phụ thuộc.

**Bảng 4.15 — Cấu hình môi trường phát triển**

| Thành phần | Triển khai trên | Cấu hình / ghi chú |
|------------|-----------------|---------------------|
| PostgreSQL | Container Docker `postgres:16-alpine` | Port 5432; DB `stationhub_db`; user/password qua `.env` |
| Redis | Container Docker `redis:7-alpine` | Port 6379; mật khẩu Redis cho BullMQ |
| Server API | Host `localhost:3000` | `npm run start:dev`; hot reload NestJS |
| Console web | Host `localhost:5173` | Vite dev server; proxy API nếu cấu hình |
| Agent | Máy Windows 10/11 (cùng LAN hoặc localhost) | Trỏ `SERVER_WS_URL` local; build Rust + Electron dev |
| Công cụ | Git, Node 20, Rust stable, Docker Desktop | Cùng stack mục 4.3.1 |

Triển khai thử nghiệm local phục vụ phát triển tính năng và chạy bộ TC mục 4.4 trước khi đẩy lên Railway/Firebase.

### 4.5.3. Triển khai thực tế (production)

**Bảng 4.16 — Cấu hình triển khai production**

| Thành phần | Nền tảng / thiết bị | Cấu hình triển khai |
|------------|---------------------|---------------------|
| API + WebSocket | Railway (PaaS) | Nixpacks build; `startCommand`: `node dist/main.js`; `releaseCommand`: `npx prisma migrate deploy`; restart on failure |
| PostgreSQL | Railway PostgreSQL plugin | `DATABASE_URL`; migration tự động mỗi deploy |
| Redis / BullMQ | Redis Cloud (GCP) | `rediss://` TLS; hàng đợi task |
| Console web | Firebase Hosting | `npm run build` → deploy `dist/`; SPA rewrite `index.html` |
| Agent | PC/laptop Windows từng máy trạm | Installer NSIS hoặc portable; `SERVER_WS_URL` = WSS Railway; `agentKey` per machine |
| TLS | Railway + Firebase | HTTPS/WSS terminate tại cloud; agent không cần chứng chỉ riêng |

**Endpoint công khai (tham chiếu):** API `https://tdoanremotedatn-production.up.railway.app` (REST prefix `/api`, WebSocket cùng origin). Console: domain Firebase Hosting của project (`.web.app` / `.firebaseapp.com`).

**Biến môi trường then chốt:** `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` (gồm origin Firebase), `PUBLIC_API_BASE_URL` (Telegram webhook), `VITE_API_BASE_URL` và `VITE_WS_URL` khi build console.

**Quy trình release:**

1. Push Git → Railway auto-build và deploy backend; migration Prisma chạy ở release phase.
2. Kiểm tra `GET /api/health` trả 200.
3. Build và `firebase deploy --only hosting` cho console.
4. Cập nhật agent (nếu đổi URL) hoặc phân phối installer mới.

[chèn Hình 4.13 — Screenshot Railway deploy hoặc health check *(tùy chọn)*]

### 4.5.4. Kết quả triển khai và vận hành

Sau triển khai production, hệ thống vận hành phục vụ **thử nghiệm thực tế** (pilot) — quy mô nhỏ, chưa mở rộng hàng loạt người dùng công cộng.

**Bảng 4.17 — Kết quả triển khai thử nghiệm / pilot**

| Chỉ số | Giá trị quan sát | Ghi chú |
|--------|------------------|---------|
| Số người dùng đăng ký thử | Vài tài khoản (dev + thử nghiệm nội bộ) | USER và ADMIN |
| Số agent đăng ký | 2–5 máy Windows thử nghiệm | LAN + máy cá nhân qua Internet |
| Số task chạy thành công (mẫu) | Hàng chục task COMMAND/HTTP trong giai đoạn test | Không lưu benchmark formal |
| Thời gian phản hồi API REST (p95 ước lượng) | Dưới vài giây cho CRUD thông thường | Phụ thuộc mạng; chưa dùng APM |
| Thời gian dispatch task → agent | Thường dưới 1–3 giây (local); 2–5 giầy qua WSS Railway | Gồm BullMQ + WebSocket |
| Thời gian thực thi task | Phụ thuộc lệnh (vài ms đến hết timeout 5 phút) | NFR-P06 |
| Uptime Railway (giai đoạn thử) | Ổn định sau deploy; restart tự động khi lỗi | Theo log Railway |
| Phản hồi người dùng thử | Console dễ thao tác; workflow editor cần làm quen | Phản hồi định tính nội bộ |
| Kiểm tra tải (load test) | **Chưa thực hiện** benchmark >50 agent đồng thời | Hạn chế đồ án; hướng mở rộng Chương 6 |

**Nhận xét:** mô hình triển khai **đạt mục tiêu đồ án** — chứng minh tính khả thi quản lý tập trung fleet Windows qua cloud, không yêu cầu VPN inbound. Agent outbound-only phù hợp mạng doanh nghiệp/NAT. Điểm cần cải thiện khi mở rộng: load test fleet lớn, giám sát APM, hoàn thiện bộ unit test NestJS (mục 4.4.3), CDN/cache policy cho console.

---

# Chương 5. Các giải pháp và đóng góp nổi bật

Chương 4 đã trình bày hệ thống theo góc nhìn thiết kế và triển khai: kiến trúc, mô hình dữ liệu, luồng xử lý, kiểm thử và vận hành production. Trên nền đó, Chương 5 tập trung vào phần có giá trị đánh giá chuyên môn cao hơn: những quyết định kỹ thuật then chốt giúp hệ thống vượt qua các điểm nghẽn thực tế trong quá trình làm đồ án. Mục tiêu của chương không phải liệt kê chức năng đã có, mà làm rõ vì sao những giải pháp này cần thiết, chúng được xây như thế nào, hiệu quả đạt được ra sao và giới hạn nào còn tồn tại.

Năm nội dung được chọn phản ánh đúng bản chất của bài toán điều phối tác vụ phân tán trên máy trạm Windows. Thứ nhất là bài toán kết nối biên trong môi trường mạng bất định, nơi agent nằm sau NAT và không thể mở cổng inbound. Thứ hai là bài toán xử lý tải bất đồng bộ, khi yêu cầu từ người dùng và trigger có thể tăng đột biến, trong khi thời gian thực thi tại agent không đồng nhất. Thứ ba là bài toán workflow nhiều bước có phụ thuộc dữ liệu, cần một runtime đủ chặt chẽ để tránh chạy sai thứ tự hoặc mất ngữ cảnh trung gian. Thứ tư là bài toán bảo mật đa tenant khi nhiều người dùng cùng dùng một backend, đòi hỏi ranh giới quyền hạn rõ và nhất quán từ xác thực đến truy vấn dữ liệu. Thứ năm là bài toán tự động hóa đa kênh, nơi các nguồn kích hoạt khác nhau phải hội tụ về cùng một ngữ nghĩa vận hành để hệ thống có thể mở rộng.

Về phương pháp, các giải pháp được xây theo hướng problem-driven. Mỗi quyết định đều xuất phát từ một ràng buộc nghiệp vụ hoặc phi chức năng đã nêu ở Chương 2, sau đó được kiểm chứng qua hiện thực mã nguồn và kết quả kiểm thử ở Chương 4. Cách trình bày trong chương này vì vậy đi theo mạch tự nhiên: từ bối cảnh phát sinh vấn đề, sang cơ chế xử lý cụ thể, rồi đến hiệu quả thực nghiệm và khả năng tổng quát hóa. Nhờ đó, chương không lặp mô tả kỹ thuật ở các chương trước nhưng vẫn bảo đảm tính liên kết với toàn bộ báo cáo.

---

## 5.1. Gateway WebSocket, heartbeat và xử lý race reconnect

Bài toán đầu tiên của hệ thống không nằm ở giao diện hay database, mà nằm ở lớp kết nối giữa server và agent. Trong bối cảnh triển khai thực tế, đa số máy trạm nằm sau NAT hoặc chính sách firewall nội bộ, vì vậy mô hình server gọi ngược vào agent là không khả thi. Chỉ có một hướng vận hành phù hợp: agent chủ động tạo kết nối outbound dài hạn tới server. Mô hình này giải được điều kiện hạ tầng, nhưng lại đặt ra một yêu cầu khó hơn: trạng thái online/offline phải chính xác theo thời gian thực để toàn bộ lớp điều phối phía trên hoạt động đúng.

Nếu dùng polling HTTP cho trạng thái agent, hệ thống sẽ đối mặt đồng thời ba vấn đề. Một là độ trễ hiển thị bằng chu kỳ poll, dẫn tới sai lệch nhận thức của người vận hành ở các thao tác cần phản ứng nhanh. Hai là tải backend tăng tuyến tính theo số agent và số người dùng đang mở dashboard. Ba là trạng thái dễ “đẹp giả” trong thời gian ngắn, khi agent vừa mất kết nối nhưng chưa tới chu kỳ poll kế tiếp. Vì vậy, hệ thống chuyển sang giao tiếp push theo WebSocket với hai không gian tách biệt: `/ws/agent` cho agent xác thực bằng `agentKey`, và `/ws/client` cho console xác thực JWT. Cách tách này không chỉ là tổ chức kỹ thuật, mà là cơ chế phân tách trust boundary giữa máy trạm và người dùng web.

Trong thực nghiệm, vấn đề nghiêm trọng nhất không phải mất kết nối, mà là mất kết nối “nửa vời” khi mạng chập chờn: agent reconnect thành công nhưng sự kiện disconnect của phiên cũ tới muộn. Nếu server cập nhật OFFLINE theo mọi sự kiện disconnect thì hệ thống sẽ tạo trạng thái OFFLINE giả, dashboard nhấp nháy và các luồng dispatch có thể ra quyết định sai thời điểm. Đây là một race condition điển hình của hệ thống realtime, thường không lộ ở môi trường phát triển ổn định nhưng xuất hiện rõ khi chạy production.

Để xử lý, hệ thống dùng cơ chế ownership cho socket. Mỗi agent chỉ có một phiên được coi là “phiên sở hữu hiện tại”. Khi có kết nối mới, gateway chủ động thu hồi phiên cũ bằng tín hiệu `SUPERSEDED`; khi xử lý disconnect, chỉ disconnect của phiên sở hữu hiện tại mới có quyền chuyển trạng thái sang OFFLINE. Cùng lúc đó, heartbeat được duy trì để tách biệt hai trạng thái “mất socket tức thời” và “ngừng hoạt động thực sự”. Dữ liệu trạng thái vì vậy được duy trì song song ở hai tầng: in-memory để phản ứng nhanh, và persisted (`status`, `lastSeenAt`) để bảo đảm truy vấn nhất quán.

Hiệu quả của giải pháp thể hiện ở ba điểm. Thứ nhất, trạng thái fleet ổn định hơn rõ rệt trong các tình huống reconnect liên tiếp, giảm hiện tượng OFFLINE giả. Thứ hai, độ tin cậy của thao tác điều phối tăng vì quyết định dispatch dựa trên trạng thái chính xác hơn. Thứ ba, mô hình outbound-only chứng minh tính khả thi khi đưa lên cloud mà không cần can thiệp hạ tầng mạng phía máy trạm. Về mặt tổng quát, đây là đóng góp quan trọng cho lớp bài toán edge orchestration: tính đúng của trạng thái kết nối phải được bảo vệ bằng quy tắc xử lý sự kiện, không thể giao phó cho tầng UI hoặc retry ngẫu nhiên.

Giới hạn hiện tại là cơ chế này mới tối ưu cho kiến trúc gateway đơn. Khi mở rộng nhiều instance gateway, cần bổ sung chiến lược đồng bộ ownership phân tán và xử lý failover để bảo toàn tính nhất quán trạng thái trong cụm realtime.

---

## 5.2. Mô hình hàng đợi BullMQ - tách enqueue khỏi dispatch

Sau lớp kết nối realtime, điểm nghẽn tiếp theo nằm ở cách hệ thống tiếp nhận và phân phối tác vụ. Bản chất của `run task` và `run workflow` là công việc bất đồng bộ có thời gian thực thi biến thiên lớn. Có tác vụ trả kết quả sau vài trăm mili giây, nhưng cũng có tác vụ kéo dài hàng phút. Nếu API giữ kết nối cho tới khi nhận kết quả cuối, backend sẽ sớm gặp timeout và nghẽn tài nguyên trong các đợt burst tải. Vì vậy, vấn đề cần giải không đơn thuần là thêm queue, mà là thiết kế lại vòng đời xử lý theo đúng ngữ nghĩa vận hành.

Giải pháp được chuẩn hóa thành hai pha rõ ràng. Pha thứ nhất là pha giao dịch ngắn: API xác thực quyền, kiểm tra điều kiện nghiệp vụ, ghi bản ghi task/workflow run và enqueue job. Pha thứ hai là pha giao dịch dài: worker lấy job, kiểm tra lại điều kiện thực thi tại thời điểm dispatch, gửi lệnh qua gateway tới agent, chờ tín hiệu hoàn tất hoặc timeout, sau đó cập nhật trạng thái cuối. Nhờ tách pha, API vẫn phản hồi nhanh cho người dùng, còn xử lý dài được chuyển sang worker có thể kiểm soát concurrency.

Trong quá trình làm đồ án, nhóm đã điều chỉnh một quyết định quan trọng: xử lý agent offline theo hướng fail-fast ở worker thay vì giữ trạng thái QUEUED quá lâu. Lý do là QUEUED kéo dài tạo ảo giác “hệ thống đang xử lý” trong khi điều kiện thực thi không tồn tại, khiến người vận hành khó phân biệt lỗi hạ tầng và lỗi nghiệp vụ. Chuyển sang fail-fast giúp trạng thái phản ánh đúng thực tế vận hành và khuyến khích người dùng xử lý nguyên nhân gốc (kết nối agent, quyền hạn, cấu hình) thay vì chờ đợi thụ động.

Một điểm then chốt khác là xác định nguồn sự thật cho kết quả tác vụ. Worker điều phối tiến trình nhưng không phải nơi xác nhận hoàn tất cuối cùng; gateway mới là nơi nhận `task:result` trực tiếp từ agent, vì vậy gateway phải là nguồn xác nhận chính. Cách phân tách này tránh race update giữa nhiều luồng bất đồng bộ, đặc biệt khi có timeout, retry hoặc reconnect xảy ra đồng thời.

Hệ thống cũng tách bạch retry hạ tầng với retry nghiệp vụ. Retry của BullMQ xử lý lỗi tạm thời ở tầng queue/worker/network; retry nghiệp vụ do người dùng chủ động kích hoạt nhằm chạy lại một tác vụ với mục tiêu công việc cụ thể. Nếu hai loại retry bị trộn, hệ thống sẽ khó kiểm soát ngữ nghĩa và dễ tạo vòng lặp không mong muốn.

Kết quả đạt được là API ổn định hơn khi tải tăng, trạng thái task rõ ràng hơn trong các ca lỗi, và hệ thống quan sát vận hành tốt hơn nhờ vòng đời trạng thái được chuẩn hóa. Về mặt học thuật, đóng góp của mục này là chuyển được pipeline xử lý từ mô hình “request-response kéo dài” sang mô hình “event-driven có ranh giới trách nhiệm rõ”, một nguyên tắc có thể áp dụng cho phần lớn hệ thống điều phối tác vụ phân tán.

Giới hạn hiện tại là worker vẫn cùng deployment với API trong cấu hình hiện thời. Khi quy mô tăng, cần tách worker thành service độc lập, bổ sung backpressure theo tenant và áp dụng chiến lược ưu tiên linh hoạt hơn theo loại tác vụ.

---

## 5.3. Workflow runtime - lập lịch đồ thị event-driven và truyền biến động

Nếu task đơn là “đơn vị thực thi”, thì workflow là “đơn vị điều phối”. Trong nghiệp vụ thực tế, yêu cầu tự động hóa hiếm khi dừng ở một lệnh đơn lẻ; thường là chuỗi bước có phụ thuộc dữ liệu, có nhánh điều kiện và có khả năng kích hoạt theo nhiều nguồn. Nếu chỉ ghép script rời rạc, hệ thống sẽ thiếu tính tái sử dụng, khó debug và gần như không thể phân tích nguyên nhân lỗi theo từng bước khi xảy ra sự cố.

Thách thức cốt lõi của workflow runtime nằm ở hai lớp. Lớp thứ nhất là lập lịch đồ thị: làm sao thực thi đúng phụ thuộc mà không buộc người dùng nhập thứ tự tuyến tính thủ công. Lớp thứ hai là truyền ngữ cảnh động: output của bước trước phải được dùng làm input của bước sau theo cách nhất quán, kể cả khi dữ liệu có cấu trúc phức tạp hoặc đến từ trigger bên ngoài. Nếu một trong hai lớp này không ổn định, workflow sẽ trở thành “giao diện đẹp nhưng chạy không đáng tin”.

Giải pháp của đồ án là runtime event-driven trên DAG, nơi bước mới được kích hoạt ngay khi phụ thuộc đã thỏa mãn, thay vì đợi theo “wave” cứng. Cách này giảm thời gian chờ giữa các nhánh không phụ thuộc và phản ánh đúng bản chất dòng dữ liệu của workflow. Đồng thời, ngữ cảnh chạy được chuẩn hóa thành các namespace rõ ràng (`workflow.*`, `steps.*`, `prev.*`, `telegram.*`, `schedule.*`), giúp người thiết kế workflow hiểu chính xác dữ liệu nào có sẵn ở mỗi thời điểm.

Template resolver được thiết kế để xử lý đường dẫn biến theo cả cú pháp dot và index mảng, từ đó hỗ trợ các payload bán cấu trúc thường gặp khi bước trước là HTTP request hoặc thao tác script trả JSON. Điểm quan trọng là cơ chế resolve biến này được dùng nhất quán giữa lúc cấu hình và lúc chạy thực tế, giúp giảm chênh lệch kỳ vọng giữa người dùng và runtime.

Một quyết định có tính thực tiễn cao là workflow runtime không tạo engine thực thi mới, mà tái sử dụng pipeline task chuẩn (`TasksService -> queue -> gateway -> agent`). Nhờ vậy, workflow hưởng toàn bộ cơ chế ổn định đã được xây ở hai mục trước: kiểm soát trạng thái, retry, timeout, telemetry và quan sát realtime. Điều này tránh duplication logic và làm kiến trúc gọn hơn về dài hạn.

Kết quả là workflow trong hệ thống không còn là “sơ đồ trên UI”, mà trở thành thực thể vận hành có thể kiểm chứng bằng lịch sử `WorkflowRun/StepRun`, phù hợp cho debug và hậu kiểm. Ở mức tổng quát, đóng góp của mục này là kết hợp được hai năng lực thường tách rời: lập lịch phụ thuộc và truyền ngữ cảnh động. Đây là nền tảng quan trọng để mở rộng sang các workflow phức tạp hơn trong tương lai.

Giới hạn hiện tại là runtime chưa bao phủ các đặc tính nâng cao của workflow engine enterprise như compensation transaction hoặc SLA policy theo từng bước. Tuy nhiên, trong phạm vi đồ án, mức năng lực hiện tại đã đáp ứng tốt yêu cầu điều phối nhiều bước có quan sát được.

---

## 5.4. Phân quyền JWT/RBAC và cách ly đa tenant trên một server

Khi hệ thống chuyển từ mô hình một người dùng sang nhiều tenant dùng chung một backend, rủi ro bảo mật tăng lên theo cấp số nhân. Một lỗi nhỏ trong điều kiện truy vấn cũng có thể dẫn tới lộ dữ liệu chéo tenant. Đặc biệt với hệ thống này, dữ liệu không chỉ là hồ sơ người dùng mà còn là task, workflow và thông tin tác nghiệp của máy trạm, nên hậu quả của sai sót truy cập là đáng kể.

Bài toán phức tạp hơn vì tồn tại hai loại danh tính với vòng đời rất khác nhau. Người dùng web có phiên ngắn, thay đổi theo đăng nhập/đăng xuất; agent là tiến trình nền có vòng đời dài trên máy trạm. Dùng cùng một cơ chế xác thực cho cả hai phía dễ tạo mâu thuẫn giữa bảo mật và khả dụng. Vì vậy, hệ thống lựa chọn mô hình dual-auth: người dùng web đi qua JWT và role guard; agent đi qua `agentKey` trên namespace riêng.

Trên nhánh người dùng, bảo mật được xây theo nhiều lớp nhất quán. Lớp đầu là xác thực JWT cho danh tính phiên. Lớp thứ hai là RBAC để phân tách phạm vi USER và ADMIN. Lớp thứ ba, cũng là lớp quan trọng nhất về chống rò rỉ dữ liệu, là ownership filtering tại service: mọi truy vấn nghiệp vụ bắt buộc gắn `userId` từ claims đã xác thực, không nhận `userId` tự khai từ client. Cách triển khai này chặn nhóm lỗi IDOR ở nơi dễ phát sinh nhất: truy vấn dữ liệu.

Trên nhánh agent, gateway xác thực bằng `agentKey`, cho phép thu hồi phiên ngay khi regenerate key hoặc khi vi phạm chính sách gói. Việc tách nhánh xác thực giúp tránh tái sử dụng token người dùng cho tiến trình nền, đồng thời giữ biên trust rõ ràng giữa con người thao tác console và phần mềm agent tự động.

Bổ sung cho các lớp kiểm soát truy cập là cơ chế audit thao tác nhạy cảm ở phạm vi quản trị. Audit không ngăn lỗi xảy ra, nhưng đóng vai trò hậu kiểm bắt buộc để truy vết và đánh giá tác động khi có sự cố.

Kết quả thực tế là ranh giới quyền giữa USER và ADMIN rõ hơn, dữ liệu tenant được cô lập tốt hơn trong các luồng chính, và độ tin cậy vận hành tăng khi hệ thống có thêm người dùng. Đóng góp của mục này không nằm ở việc dùng JWT hay RBAC riêng lẻ, mà ở cách kết nối nhất quán giữa xác thực, phân quyền, lọc dữ liệu sở hữu và audit thành một chuỗi bảo mật liền mạch.

Giới hạn hiện tại là lớp cách ly dữ liệu vẫn chủ yếu thực thi ở tầng ứng dụng. Hướng tăng cường tiếp theo là bổ sung RLS ở PostgreSQL để có thêm một lớp bảo vệ ở tầng dữ liệu, giảm phụ thuộc vào kỷ luật lập trình ở service.

---

## 5.5. Trigger đa kênh - dispatcher thống nhất cho cron và Telegram

Một hệ thống tự động hóa chỉ thực sự hữu ích khi workflow có thể được kích hoạt không cần thao tác trực tiếp trên giao diện. Trong phạm vi đồ án, hai nguồn kích hoạt quan trọng là lịch định kỳ và lệnh từ Telegram. Vấn đề nảy sinh ở đây là khác biệt ngữ cảnh đầu vào: cron thiên về thời điểm, còn Telegram thiên về tương tác. Nếu mỗi nguồn tự đi một pipeline riêng, hệ thống sẽ nhanh chóng bị phân mảnh, khó bảo trì và khó đảm bảo tính nhất quán.

Giải pháp được chọn là chuẩn hóa “điểm vào trigger” bằng một dispatcher thống nhất. Bất kể nguồn tín hiệu là cron hay Telegram, luồng xử lý đều đi qua cùng cơ chế: kiểm tra điều kiện hoạt động, xác nhận subscription, ghi nhận lần kích hoạt, chuẩn hóa payload, gọi workflow runtime và lưu kết quả cuối. Cách tiếp cận này làm cho khác biệt giữa các kênh chỉ còn ở adapter đầu vào, không còn ở lõi điều phối.

Lợi ích trực tiếp của mô hình này là đồng nhất semantics thực thi. Người vận hành không còn phải hiểu mỗi kênh trigger chạy theo một luật riêng; cùng một workflow sẽ có hành vi nhất quán miễn là ngữ cảnh đầu vào tương đương. Đồng thời, vì tất cả lần kích hoạt đều tạo bản ghi theo cùng cấu trúc, hệ thống quan sát vận hành trở nên đơn giản và đáng tin hơn.

Một điểm quan trọng khác là khả năng mở rộng theo chiều kênh. Khi đã có dispatcher thống nhất, thêm nguồn trigger mới chỉ cần bổ sung adapter chuyển đổi payload sang chuẩn chung. Điều này giảm đáng kể chi phí phát triển về sau và tránh chạm vào phần lõi vốn nhạy cảm của runtime workflow.

Kết quả thực tế cho thấy hệ thống xử lý được cả trigger định kỳ và trigger theo lệnh chat trong cùng kiến trúc điều phối, đồng thời duy trì được lịch sử thực thi rõ ràng để phục vụ theo dõi và debug. Về mặt đóng góp, giá trị của mục này không nằm ở số lượng kênh tích hợp, mà ở việc chuẩn hóa ngữ nghĩa kích hoạt để bảo toàn tính nhất quán toàn hệ thống.

Giới hạn hiện tại là cơ chế chống duplicate trigger mới ở mức cơ bản; khi mở rộng quy mô lớn và nhiều kênh hơn, cần bổ sung idempotency key xuyên kênh và chính sách de-dup theo cửa sổ thời gian.

---

### Kết chương 5

Năm giải pháp trong chương này tạo thành một vòng vận hành liên tục thay vì năm mảnh kỹ thuật rời rạc. Lớp kết nối realtime bảo đảm trạng thái fleet đáng tin cậy. Lớp queue chuẩn hóa xử lý bất đồng bộ và giảm nghẽn API. Lớp workflow runtime cung cấp điều phối nhiều bước có ngữ cảnh và truy vết. Lớp bảo mật đa tenant giữ biên quyền và dữ liệu nhất quán khi hệ thống có nhiều người dùng. Lớp trigger thống nhất mở rộng tự động hóa mà không phá vỡ lõi điều phối.

Từ góc nhìn tổng quát, đóng góp của đồ án có thể cô đọng thành ba nguyên lý. Một là tách rõ “tiếp nhận yêu cầu” và “thực thi tác vụ” để hệ thống chịu tải tốt hơn. Hai là chuẩn hóa trạng thái và ngữ nghĩa sự kiện trên toàn bộ pipeline để giảm lỗi tích lũy qua nhiều tầng. Ba là thiết kế bảo mật theo nhiều lớp và nhiều biên trust thay vì dựa vào một cơ chế duy nhất. Ba nguyên lý này có khả năng tái sử dụng cho nhiều bài toán điều phối tác vụ phân tán ngoài phạm vi cụ thể của đề tài.

Trên cơ sở các kết quả này, Chương 6 trình bày phần kết luận và hướng phát triển, tập trung vào những thành phần cần mở rộng khi hệ thống tăng quy mô và mức độ phức tạp vận hành.

---

# Chương 6. Kết luận và hướng phát triển

## 6.1. Kết luận

Đồ án đã hoàn thành mục tiêu xây dựng **hệ thống quản lý và thực thi tác vụ tự động trên máy trạm Windows qua mô hình agent–server**, gồm server điều phối NestJS, agent Rust trên Windows và console quản trị web React. Hệ thống số hóa quy trình tạo–phân phối–giám sát task và workflow, hỗ trợ trigger lịch và Telegram, cập nhật trạng thái fleet theo thời gian thực qua WebSocket.

So với script thủ công và RPA rời rạc, giải pháp **tập trung hóa quản trị** trong một nền tảng thống nhất. Hệ thống **không dừng ở nguyên mẫu local** mà đã được **triển khai và vận hành production** trên Railway (API/WS), Firebase Hosting (console), Redis Cloud (queue), với agent Windows kết nối WSS trong môi trường thực tế.

**Hạn chế:** chưa có số liệu benchmark tải quy mô lớn trong báo cáo; phụ thuộc độ trễ mạng agent ↔ server; agent tối ưu cho Windows; task type FILE_OPERATION chưa hoàn thiện; desktop automation phụ thuộc UIA ứng dụng đích.

**Bài học kinh nghiệm:** thiết kế giao thức WS và trạng thái task rõ ràng ngay từ đầu giúp debug agent–server hiệu quả; tách queue khỏi API là cần thiết khi dispatch không đồng bộ; workflow cần quy ước biến `steps.*` thống nhất giữa UI và runtime.

## 6.2. Hướng phát triển

**Ngắn hạn:**

- Hoàn thiện task type còn thiếu; bổ sung test E2E tự động (Playwright + agent mock).
- Gắn domain tùy chỉnh cho Railway/Firebase; tinh chỉnh CORS và cache CDN admin.
- Metrics (Prometheus/Grafana hoặc Railway observability) cho queue depth và số agent online.

**Dài hạn:**

- Agent Linux/macOS; scale-out nhiều worker BullMQ.
- High availability PostgreSQL/Redis; sharding agent theo tenant.
- Policy engine (giới hạn lệnh nguy hiểm); vault lưu secret task.
- Remote view/agent-assisted troubleshooting (đã có hướng remote session trong schema).

---

# Tài liệu tham khảo

[1] NestJS, NestJS Documentation, https://docs.nestjs.com, truy cập lần cuối tháng 6/2026.

[2] Prisma, Prisma Documentation, https://www.prisma.io/docs, truy cập lần cuối tháng 6/2026.

[3] BullMQ, BullMQ Documentation, https://docs.bullmq.io, truy cập lần cuối tháng 6/2026.

[4] Socket.IO, Socket.IO Documentation, https://socket.io/docs/v4, truy cập lần cuối tháng 6/2026.

[5] Meta, React Documentation, https://react.dev, truy cập lần cuối tháng 6/2026.

[6] The Rust Project, The Rust Programming Language, https://doc.rust-lang.org/book, truy cập lần cuối tháng 6/2026.

[7] Microsoft, UI Automation Overview, https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview, truy cập lần cuối tháng 6/2026.

[8] Microsoft, Power Automate Desktop — Record desktop flows, https://learn.microsoft.com/en-us/power-automate/desktop-flows/recording-flow, truy cập lần cuối tháng 6/2026.

[9] PostgreSQL Global Development Group, PostgreSQL 16 Documentation, https://www.postgresql.org/docs/16, truy cập lần cuối tháng 6/2026.

[10] Redis Ltd., Redis Documentation, https://redis.io/docs, truy cập lần cuối tháng 6/2026.

[11] xyflow, React Flow Documentation, https://reactflow.dev, truy cập lần cuối tháng 6/2026.

[12] TanStack, TanStack Query Documentation, https://tanstack.com/query, truy cập lần cuối tháng 6/2026.

[13] OWASP, JSON Web Token Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html, truy cập lần cuối tháng 6/2026.

[14] Docker, Docker Compose Documentation, https://docs.docker.com/compose, truy cập lần cuối tháng 6/2026.

[15] Electron, Electron Documentation, https://www.electronjs.org/docs, truy cập lần cuối tháng 6/2026.

[16] Railway, Railway Documentation, https://docs.railway.com, truy cập lần cuối tháng 6/2026.

[17] Google Firebase, Firebase Hosting Documentation, https://firebase.google.com/docs/hosting, truy cập lần cuối tháng 6/2026.

[18] Redis Ltd., Redis Cloud Documentation, https://redis.io/docs/latest/operate/rc, truy cập lần cuối tháng 6/2026.

---

## Phụ lục — Gợi ý cập nhật Mục lục Word

```
Chương 1  Giới thiệu đề tài
  1.1  Đặt vấn đề
  1.2  Mục tiêu và phạm vi đề tài
  1.3  Định hướng giải pháp
  1.4  Bố cục đồ án
Chương 2  Khảo sát và phân tích yêu cầu
  2.1  Khảo sát hiện trạng
  2.2  Tổng quan chức năng
    2.2.1  Biểu đồ use case tổng quan
    2.2.2  Đăng nhập / đăng ký
    2.2.3  Quản lý fleet agent
    2.2.4  Quản lý task và template
    2.2.5  Thiết kế workflow
    2.2.6  Chạy task / workflow
    2.2.7  Cấu hình trigger (Cron · Telegram)
    2.2.8  Xem dashboard
    2.2.9  Quản lý người dùng
    2.2.10 Xem nhật ký audit
    2.2.11 Quy trình nghiệp vụ
  2.3  Đặc tả chức năng
  2.4  Yêu cầu phi chức năng
    2.4.1  Hiệu năng
    2.4.2  Khả dụng và tính sẵn sàng
    2.4.3  Bảo mật
    2.4.4  Tin cậy và xử lý lỗi
    2.4.5  Khả năng mở rộng
    2.4.6  Tính dễ sử dụng
    2.4.7  Khả năng bảo trì và quan sát
    2.4.8  Triển khai và môi trường
    2.4.9  An toàn vận hành trên máy trạm
Chương 3  Công nghệ sử dụng
  3.0  Tổng quan kiến trúc công nghệ
  3.1  Nền tảng backend — NestJS
  3.2  Cơ sở dữ liệu — PostgreSQL và Prisma ORM
  3.3  Hàng đợi — Redis và BullMQ
  3.4  Giao tiếp thời gian thực — Socket.IO
  3.5  Giao diện quản trị — React SPA
  3.6  Agent máy trạm — Rust và Electron
  3.7  Xác thực và phân quyền — JWT và RBAC
  3.8  Công cụ triển khai và vận hành
Chương 4  Phát triển và triển khai ứng dụng
Chương 5  Các giải pháp và đóng góp nổi bật
  5.1  Gateway WebSocket, heartbeat và race reconnect
  5.2  Hàng đợi BullMQ — tách enqueue khỏi dispatch
  5.3  Workflow runtime — đồ thị event-driven và biến động
  5.4  JWT/RBAC và cách ly đa tenant
  5.5  Trigger đa kênh — dispatcher thống nhất
Chương 6  Kết luận và hướng phát triển
Tài liệu tham khảo
```

## Phụ lục — Checklist hình ảnh cần chụp

| Hình | Nội dung |
|------|----------|
| 2.1 | Use case tổng quan (PlantUML) |
| 2.2 | Phân rã *Đăng nhập / đăng ký* |
| 2.3 | Phân rã *Quản lý fleet agent* |
| 2.4 | Phân rã *Quản lý task và template* |
| 2.5 | Phân rã *Thiết kế workflow* |
| 2.6 | Phân rã *Chạy task / workflow* |
| 2.7 | Phân rã *Cấu hình trigger* |
| 2.8 | Phân rã *Xem dashboard* |
| 2.9 | Phân rã *Quản lý người dùng* |
| 2.10 | Phân rã *Xem nhật ký audit* |
| 2.11 | Activity diagram quy trình nghiệp vụ |
| 4.1 | Biểu đồ gói UML phân tầng (PlantUML `hinh-4-1-bieu-do-goi-uml.puml`) |
| 4.2 | Chi tiết gói `server.quan-tri` (PlantUML `hinh-4-2-goi-server-quan-tri.puml`) |
| 4.3 | Chi tiết gói `server.dieu-phoi` (PlantUML `hinh-4-3-goi-server-dieu-phoi.puml`) |
| 4.4 | Chi tiết gói `agent.core` (PlantUML `hinh-4-4-goi-agent-core.puml`) |
| 4.5–4.7 | Wireframe/mockup thiết kế UI (mục 4.2.1 — không phải screenshot sản phẩm) |
| 4.8–4.8c | Sequence diagram: dispatch task, workflow, Telegram (mục 4.2.2) |
| 4.9 | E-R diagram nghiệp vụ cốt lõi (mục 4.2.3) |
| 4.9b | Lược đồ logic nhóm bảng CSDL (Mermaid) |
| 4.9c | E-R mở rộng audit/trigger/billing (Mermaid) |
| 4.10–4.11 | Screenshot sản phẩm: task COMPLETED, workflow RUNNING (mục 4.3.3) |
| 4.12 | Sơ đồ triển khai production (Railway + Firebase + agent) |
| 4.13 | Screenshot Railway deploy / health `/api/health` (tùy chọn) |
| 4.14 | Ảnh schema Prisma (`prisma/schema.prisma` hoặc ERD Prisma) |
| 4.15 | Ảnh Prisma Studio / pgAdmin — bảng agents, tasks, workflows |
