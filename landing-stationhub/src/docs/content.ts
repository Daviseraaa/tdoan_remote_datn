import {
  BookOpen,
  Bot,
  CircleHelp,
  FolderOpen,
  ListTodo,
  MessageSquare,
  Monitor,
  Rocket,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { DocNavSection, DocPage } from './types';

export const DOC_NAV: DocNavSection[] = [
  {
    id: 'getting-started',
    labelKey: 'docs.nav.gettingStarted',
    icon: BookOpen,
    items: [
      { slug: 'introduction', labelKey: 'docs.nav.introduction', icon: BookOpen },
      { slug: 'quick-start', labelKey: 'docs.nav.quickStart', icon: Rocket },
    ],
  },
  {
    id: 'features',
    labelKey: 'docs.nav.features',
    icon: Monitor,
    items: [
      { slug: 'agents', labelKey: 'docs.nav.agents', icon: Bot },
      { slug: 'workflows', labelKey: 'docs.nav.workflows', icon: Workflow },
      { slug: 'tasks', labelKey: 'docs.nav.tasks', icon: ListTodo },
      { slug: 'telegram', labelKey: 'docs.nav.telegram', icon: MessageSquare },
      { slug: 'file-explorer', labelKey: 'docs.nav.fileExplorer', icon: FolderOpen },
    ],
  },
  {
    id: 'help',
    labelKey: 'docs.nav.help',
    icon: CircleHelp,
    items: [
      { slug: 'troubleshooting', labelKey: 'docs.nav.troubleshooting', icon: Wrench },
      { slug: 'faq', labelKey: 'docs.nav.faq', icon: CircleHelp },
    ],
  },
];

export const DOC_PAGES: DocPage[] = [
  {
    slug: 'introduction',
    title: 'Giới thiệu',
    description:
      'StationHub giúp bạn quản lý và vận hành nhiều máy tính từ một bảng điều khiển tập trung — an toàn, rõ ràng và dễ theo dõi.',
    icon: BookOpen,
    blocks: [
      {
        type: 'p',
        text: 'StationHub là nền tảng điều khiển máy trạm từ xa dành cho đội ngũ vận hành, quản trị hệ thống và doanh nghiệp cần thực hiện cùng một thao tác trên hàng chục hoặc hàng trăm máy. Thay vì đăng nhập từng máy một, bạn mở trình duyệt, chọn máy cần thao tác và gửi lệnh — kết quả hiển thị ngay trên màn hình quản trị.',
      },
      {
        type: 'p',
        text: 'Nền tảng hỗ trợ Windows, macOS và Linux trong cùng một giao diện. Bạn có thể chạy lệnh đơn giản, lập lịch công việc định kỳ, thiết kế quy trình nhiều bước hoặc kích hoạt qua Telegram khi cần phản ứng nhanh.',
      },
      { type: 'h2', id: 'what-it-does', text: 'StationHub giải quyết vấn đề gì' },
      {
        type: 'p',
        text: 'Khi số lượng máy trạm tăng lên, việc bảo trì thủ công trở nên chậm và dễ sai sót: quên máy, nhầm phiên bản, khó truy vết ai đã làm gì. StationHub gom toàn bộ máy vào một nơi, ghi nhận lịch sử thực thi và cho phép lặp lại thao tác đã được kiểm chứng.',
      },
      {
        type: 'ul',
        items: [
          'Theo dõi máy nào đang trực tuyến, máy nào bận hoặc mất kết nối',
          'Gửi lệnh hoặc kịch bản tới một máy, một nhóm máy hoặc toàn bộ hệ thống',
          'Lập lịch chạy tự động (ví dụ sao lưu lúc 2 giờ sáng mỗi ngày)',
          'Nhận yêu cầu từ Telegram và chạy quy trình đã cấu hình sẵn',
        ],
      },
      { type: 'h2', id: 'architecture', text: 'Cách hệ thống hoạt động' },
      {
        type: 'p',
        text: 'StationHub gồm ba thành phần làm việc cùng nhau. Hiểu sơ đồ này giúp bạn triển khai và xử lý sự cố nhanh hơn.',
      },
      { type: 'h3', id: 'on-machine-app', text: 'Ứng dụng trên máy trạm' },
      {
        type: 'p',
        text: 'Một chương trình nhỏ cài trên từng máy cần quản lý. Ứng dụng này duy trì kết nối an toàn tới máy chủ, nhận yêu cầu thực thi và gửi kết quả cùng nhật ký về. Máy chủ luôn biết máy đó có sẵn sàng hay không.',
      },
      { type: 'h3', id: 'server', text: 'Máy chủ điều phối' },
      {
        type: 'p',
        text: 'Trung tâm xử lý: xác thực người dùng, xếp hàng công việc, lưu lịch sử và đẩy thông báo trạng thái theo thời gian thực. Dữ liệu nhạy cảm được truyền qua kết nối mã hóa.',
      },
      { type: 'h3', id: 'console', text: 'Bảng điều khiển web' },
      {
        type: 'p',
        text: 'Giao diện bạn sử dụng hàng ngày — xem danh sách máy, tạo quy trình, theo dõi tiến độ và đọc báo cáo. Không cần cài thêm phần mềm trên máy quản trị; chỉ cần trình duyệt.',
      },
      { type: 'h2', id: 'who-its-for', text: 'Ai nên sử dụng' },
      {
        type: 'ul',
        items: [
          'Đội vận hành hạ tầng cần triển khai bản vá, thu thập log hoặc kiểm tra cấu hình trên nhiều máy',
          'Doanh nghiệp có chuỗi cửa hàng, chi nhánh hoặc phòng lab máy tính',
          'Nhóm phát triển muốn chuẩn hóa bước cài đặt, kiểm thử hoặc sao lưu trước khi phát hành',
          'Quản trị viên cần giám sát tình trạng máy và phản ứng nhanh khi có sự cố',
        ],
      },
      { type: 'h2', id: 'core-concepts', text: 'Khái niệm cần biết' },
      { type: 'h3', id: 'machines', text: 'Máy trạm đã kết nối' },
      {
        type: 'p',
        text: 'Mỗi máy tính được cài ứng dụng StationHub và ghép nối với tài khoản của bạn sẽ xuất hiện trên bảng điều khiển với tên, hệ điều hành, địa chỉ mạng và trạng thái hoạt động.',
      },
      { type: 'h3', id: 'automation', text: 'Quy trình tự động' },
      {
        type: 'p',
        text: 'Chuỗi bước được thiết kế trực quan: chạy lệnh, kiểm tra điều kiện, gửi thông báo, lặp theo danh sách máy. Quy trình có thể tái sử dụng và chia sẻ trong tổ chức.',
      },
      { type: 'h3', id: 'scheduling', text: 'Lịch và kích hoạt' },
      {
        type: 'p',
        text: 'Bạn chọn thời điểm chạy (theo ngày, giờ hoặc chu kỳ), bấm chạy thủ công khi cần, hoặc gửi lệnh qua Telegram để hệ thống thực hiện ngay.',
      },
    ],
  },
  {
    slug: 'quick-start',
    title: 'Bắt đầu nhanh',
    description: 'Hướng dẫn từ đăng ký tài khoản đến lần đầu gửi lệnh thành công — khoảng 15 phút.',
    icon: Rocket,
    blocks: [
      {
        type: 'p',
        text: 'Làm lần lượt các bước dưới đây để có một máy trạm kết nối và một lệnh chạy thử. Sau khi quen thao tác cơ bản, bạn có thể đọc thêm các mục trong phần Tính năng.',
      },
      { type: 'h2', id: 'step-1', text: '1. Tạo tài khoản' },
      {
        type: 'p',
        text: 'Truy cập bảng điều khiển StationHub và đăng ký bằng email hoặc tài khoản Google. Xác nhận mã OTP gửi tới hộp thư để kích hoạt tài khoản.',
      },
      {
        type: 'ul',
        items: [
          'Tài khoản mới được dùng thử đầy đủ tính năng trong 7 ngày',
          'Sau thời gian dùng thử, chọn gói phù hợp tại mục Gói & thanh toán',
          'Mời thêm thành viên (nếu gói cho phép) sau khi đã làm quen hệ thống',
        ],
      },
      { type: 'h2', id: 'step-2', text: '2. Cài ứng dụng lên máy trạm' },
      {
        type: 'p',
        text: 'Trên bảng điều khiển, mở mục quản lý máy trạm và chọn Triển khai ứng dụng. Tải bản cài đúng hệ điều hành (Windows, macOS hoặc Linux).',
      },
      {
        type: 'ul',
        items: [
          'Chạy trình cài đặt hoặc tệp thực thi theo hướng dẫn trên màn hình',
          'Nhập địa chỉ máy chủ và mã ghép nối do hệ thống cấp',
          'Đợi vài giây — máy sẽ hiển thị trạng thái «Trực tuyến» khi kết nối thành công',
        ],
      },
      { type: 'h2', id: 'step-3', text: '3. Gửi lệnh thử nghiệm' },
      {
        type: 'p',
        text: 'Để kiểm tra đường truyền end-to-end, hãy gửi một lệnh đơn giản tới máy vừa kết nối.',
      },
      {
        type: 'ul',
        items: [
          'Mở mục Giao việc, tạo yêu cầu mới và chọn máy đang trực tuyến',
          'Chọn loại «Lệnh một dòng» và nhập lệnh an toàn, ví dụ hiển thị tên máy',
          'Bấm gửi và theo dõi trạng thái: đang chạy → hoàn thành hoặc thất bại',
          'Mở chi tiết để đọc kết quả trả về và nhật ký thực thi',
        ],
      },
      { type: 'h2', id: 'step-4', text: '4. Thiết lập quy trình (khuyến nghị)' },
      {
        type: 'p',
        text: 'Khi đã quen gửi lệnh đơn lẻ, hãy thử tạo quy trình tự động gồm hai hoặc ba bước — ví dụ kiểm tra dung lượng ổ đĩa rồi ghi log. Quy trình giúp bạn không phải lặp lại thao tác và dễ bàn giao cho đồng nghiệp.',
      },
      {
        type: 'p',
        text: 'Trong trình thiết kế quy trình: thêm từng bước, nối các bước theo thứ tự, cấu hình tham số ở panel bên phải, rồi chạy thử và xem nhật ký từng bước.',
      },
      { type: 'h2', id: 'next-steps', text: 'Bước tiếp theo' },
      {
        type: 'ul',
        items: [
          'Đọc mục Kết nối máy trạm để quản lý nhiều máy và nhóm máy',
          'Tìm hiểu Quy trình tự động nếu cần vận hành định kỳ',
          'Cấu hình Telegram nếu muốn kích hoạt từ điện thoại',
        ],
      },
    ],
  },
  {
    slug: 'agents',
    title: 'Kết nối máy trạm',
    description:
      'Cài đặt ứng dụng StationHub trên máy tính, ghép nối an toàn và giám sát trạng thái theo thời gian thực.',
    icon: Bot,
    blocks: [
      {
        type: 'p',
        text: 'Mỗi máy trạm trong hệ thống của bạn cần cài ứng dụng StationHub để nhận lệnh từ bảng điều khiển. Ứng dụng chạy nền, tiêu tốn tài nguyên thấp và tự kết nối lại khi mạng ổn định trở lại.',
      },
      { type: 'h2', id: 'overview', text: 'Thông tin hiển thị trên bảng điều khiển' },
      {
        type: 'p',
        text: 'Với mỗi máy đã ghép nối, bạn thấy tên máy, hệ điều hành, địa chỉ IP, phiên bản ứng dụng và trạng thái hiện tại.',
      },
      {
        type: 'ul',
        items: [
          'Trực tuyến — máy sẵn sàng nhận yêu cầu',
          'Bận — đang thực hiện lệnh hoặc quy trình',
          'Ngoại tuyến — mất kết nối hoặc ứng dụng chưa chạy',
          'Rảnh — kết nối tốt và chưa có việc đang chạy',
        ],
      },
      { type: 'h2', id: 'install', text: 'Hướng dẫn cài đặt' },
      { type: 'h3', id: 'install-windows', text: 'Windows' },
      {
        type: 'p',
        text: 'Tải gói cài đặt từ bảng điều khiển, chạy với quyền quản trị nếu cần ghi vào thư mục hệ thống. Nhập mã ghép nối khi được hỏi. Có thể cấu hình chạy cùng Windows để máy tự kết nối sau khi khởi động.',
      },
      { type: 'h3', id: 'install-mac-linux', text: 'macOS và Linux' },
      {
        type: 'p',
        text: 'Tải bản binary phù hợp, cấp quyền thực thi và đăng ký dịch vụ nền (systemd trên Linux, launchd trên macOS) theo hướng dẫn đi kèm. Giữ mã ghép nối bí mật — coi như mật khẩu truy cập máy.',
      },
      { type: 'h2', id: 'groups', text: 'Nhóm và lọc máy' },
      {
        type: 'p',
        text: 'Khi số máy tăng, dùng bộ lọc theo cụm, trạng thái hoặc tên để tìm nhanh. Bảng tổng quan cập nhật trạng thái gần như ngay lập tức khi máy online hoặc offline.',
      },
      { type: 'h2', id: 'best-practices', text: 'Khuyến nghị vận hành' },
      {
        type: 'ul',
        items: [
          'Đặt tên máy rõ ràng (ví dụ theo vị trí hoặc chức năng) ngay sau khi ghép nối',
          'Cập nhật phiên bản ứng dụng khi bảng điều khiển thông báo bản mới',
          'Giới hạn quyền chạy ứng dụng trên máy — chỉ đủ để thực hiện công việc cần thiết',
          'Theo dõi máy ngoại tuyến kéo dài và xử lý trước khi chạy công việc hàng loạt',
        ],
      },
    ],
  },
  {
    slug: 'workflows',
    title: 'Quy trình tự động',
    description:
      'Thiết kế chuỗi bước thực thi có điều kiện, chia sẻ dữ liệu giữa các bước và chạy lặp trên nhiều máy.',
    icon: Workflow,
    blocks: [
      {
        type: 'p',
        text: 'Quy trình tự động phù hợp khi bạn cần lặp lại cùng một chuỗi thao tác: sao lưu, triển khai bản cập nhật, thu thập báo cáo hoặc xử lý sự cố theo kịch bản đã soạn sẵn.',
      },
      { type: 'h2', id: 'editor', text: 'Trình thiết kế trực quan' },
      {
        type: 'p',
        text: 'Bạn kéo thả từng bước lên sơ đồ, nối chúng bằng đường liên kết và cấu hình chi tiết ở panel bên phải. Sơ đồ giúp đồng nghiệp hiểu luồng xử lý mà không cần đọc mã nguồn.',
      },
      {
        type: 'ul',
        items: [
          'Chạy lệnh hệ thống hoặc script',
          'Thao tác tệp tin (sao chép, xóa, kiểm tra tồn tại)',
          'Gửi yêu cầu HTTP tới dịch vụ nội bộ',
          'Gửi tin nhắn qua Telegram',
          'Rẽ nhánh theo điều kiện (thành công / thất bại / giá trị biến)',
        ],
      },
      { type: 'h2', id: 'variables', text: 'Dữ liệu truyền giữa các bước' },
      {
        type: 'p',
        text: 'Mỗi bước có thể đọc giá trị từ bước trước hoặc từ tham số khi bạn khởi chạy. Ví dụ: bước đầu lấy danh sách thư mục, bước sau dùng đường dẫn đó để nén và tải lên.',
      },
      {
        type: 'ul',
        items: [
          'Khai báo giá trị khởi tạo khi bắt đầu quy trình',
          'Nhận tham số từ lệnh Telegram (nếu kích hoạt qua chat)',
          'Tham chiếu kết quả bước trước bằng cú pháp {{tên_biến}} trong bước sau',
        ],
      },
      { type: 'h2', id: 'triggers', text: 'Cách khởi chạy' },
      {
        type: 'ul',
        items: [
          'Thủ công — bấm chạy từ bảng điều khiển khi cần',
          'Theo lịch — chọn giờ, ngày trong tuần hoặc biểu thức cron',
          'Qua Telegram — gửi lệnh đã đăng ký cho bot của bạn',
        ],
      },
      { type: 'h2', id: 'runs', text: 'Theo dõi lần chạy' },
      {
        type: 'p',
        text: 'Mỗi lần quy trình được kích hoạt tạo một bản ghi lần chạy. Bạn xem tiến độ từng bước, thời gian thực hiện, thông báo lỗi (nếu có) và toàn bộ nhật ký để đối chiếu sau sự cố.',
      },
      {
        type: 'p',
        text: 'Trạng thái cuối cùng thường là hoàn thành, thất bại, hết thời gian chờ hoặc đã hủy — giúp bạn biết có cần chạy lại hay điều tra thêm.',
      },
    ],
  },
  {
    slug: 'tasks',
    title: 'Giao việc và hàng đợi',
    description:
      'Gửi yêu cầu thực thi đơn lẻ tới một hoặc nhiều máy, theo dõi tiến độ và lịch sử trên một màn hình.',
    icon: ListTodo,
    blocks: [
      {
        type: 'p',
        text: 'Khi bạn chỉ cần chạy một lệnh hoặc một script ngắn mà chưa cần thiết kế quy trình đầy đủ, hãy dùng chức năng giao việc. Hệ thống xếp hàng, gửi tới máy đích và lưu kết quả để tra cứu sau.',
      },
      { type: 'h2', id: 'job-types', text: 'Các loại yêu cầu' },
      {
        type: 'ul',
        items: [
          'Lệnh một dòng — phù hợp kiểm tra nhanh (ví dụ xem phiên bản, liệt kê tiến trình)',
          'Script — nhiều dòng lệnh, phù hợp cài đặt hoặc dọn dẹp phức tạp hơn',
          'Thao tác tệp — sao chép, di chuyển hoặc xóa tệp trên máy đích',
          'Thông tin hệ thống — thu thập cấu hình phần cứng, dung lượng đĩa, phiên bản OS',
        ],
      },
      { type: 'h2', id: 'queue', text: 'Hàng đợi và trạng thái' },
      {
        type: 'p',
        text: 'Yêu cầu mới vào hàng đợi trên máy chủ. Máy trạm nhận lần lượt theo khả năng; khi đang xử lý, máy hiển thị trạng thái bận. Bạn có thể lọc lịch sử theo thành công, thất bại hoặc đang chờ.',
      },
      {
        type: 'ul',
        items: [
          'Chờ — đã tạo, chưa gửi tới máy',
          'Đang chạy — máy đang thực hiện',
          'Hoàn thành — có kết quả trả về',
          'Thất bại — lỗi thực thi; xem chi tiết để biết nguyên nhân',
        ],
      },
      { type: 'h2', id: 'templates', text: 'Mẫu sẵn có' },
      {
        type: 'p',
        text: 'Lưu các yêu cầu thường dùng thành mẫu để gửi lại nhanh, tránh gõ nhầm lệnh. Mẫu đặc biệt hữu ích cho thao tác lặp lại hàng tuần trên cùng một nhóm máy.',
      },
    ],
  },
  {
    slug: 'telegram',
    title: 'Điều khiển qua Telegram',
    description:
      'Kích hoạt quy trình hoặc gửi lệnh từ chat Telegram — tiện khi bạn không ở trước máy tính.',
    icon: MessageSquare,
    blocks: [
      {
        type: 'p',
        text: 'Tích hợp Telegram cho phép bạn hoặc đồng nghiệp được ủy quyền gửi lệnh từ điện thoại. Phù hợp cảnh báo đêm, chạy khẩn cấp hoặc xác nhận nhanh mà không cần mở bảng điều khiển.',
      },
      { type: 'h2', id: 'setup', text: 'Tạo và liên kết bot' },
      {
        type: 'ul',
        items: [
          'Tạo bot mới qua @BotFather trên Telegram và lấy mã token',
          'Trên bảng điều khiển StationHub, mở mục Bot và thêm token (token không hiển thị đầy đủ sau khi lưu)',
          'Gắn bot với quy trình cần chạy và đặt tên lệnh, ví dụ /chay_sao_luu',
          'Bật bot và gửi thử lệnh từ chat đã được phép',
        ],
      },
      { type: 'h2', id: 'args', text: 'Tham số kèm theo lệnh' },
      {
        type: 'p',
        text: 'Bạn có thể truyền thêm thông tin sau lệnh, ví dụ /chay_sao_luu may_a production. Hệ thống ánh xạ từng tham số vào biến trong quy trình — bước sau dùng các giá trị đó mà không cần sửa cấu hình cố định.',
      },
      { type: 'h2', id: 'access', text: 'Kiểm soát ai được phép gửi lệnh' },
      {
        type: 'p',
        text: 'Vì bot có thể kích hoạt thao tác trên máy trạm, bạn nên giới hạn người dùng được phép.',
      },
      {
        type: 'ul',
        items: [
          'Thêm mã định danh chat hoặc người dùng Telegram vào danh sách cho phép',
          'Để trống danh sách nghĩa là mọi người đều gửi được — chỉ nên dùng khi thử nghiệm',
          'Rà soát định kỳ danh sách khi có nhân sự thay đổi',
        ],
      },
      { type: 'h2', id: 'tips', text: 'Gợi ý sử dụng' },
      {
        type: 'ul',
        items: [
          'Đặt tên lệnh ngắn, dễ nhớ và tránh trùng',
          'Ghi chú trong quy trình mô tả lệnh Telegram tương ứng cho người mới',
          'Kết hợp với lịch tự động: Telegram cho tình huống khẩn, lịch cho công việc định kỳ',
        ],
      },
    ],
  },
  {
    slug: 'file-explorer',
    title: 'Duyệt và tải tệp',
    description:
      'Xem cây thư mục trên máy trạm từ xa và tải tệp về máy của bạn qua trình duyệt.',
    icon: FolderOpen,
    blocks: [
      {
        type: 'p',
        text: 'Chức năng duyệt tệp giúp bạn lấy log, cấu hình hoặc báo cáo mà không cần cài thêm công cụ truyền tệp riêng. Mọi thao tác đi qua kết nối bảo mật của StationHub.',
      },
      { type: 'h2', id: 'what-it-does', text: 'Cách truy cập' },
      {
        type: 'p',
        text: 'Từ danh sách máy trạm, chọn máy cần xem và mở Duyệt tệp. Giao diện hiển thị đường dẫn hiện tại, danh sách thư mục và tệp kèm kích thước.',
      },
      { type: 'h2', id: 'core-features', text: 'Tính năng chính' },
      { type: 'h3', id: 'file-tree', text: 'Điều hướng thư mục' },
      {
        type: 'p',
        text: 'Bấm vào thư mục để mở sâu hơn; dùng thanh đường dẫn (breadcrumb) để quay lại cấp cha. Hỗ trợ cả đường dẫn Windows và kiểu Unix.',
      },
      { type: 'h3', id: 'download', text: 'Tải tệp về' },
      {
        type: 'p',
        text: 'Chọn tệp và bấm tải xuống — trình duyệt lưu về máy bạn. Nên dùng cho tệp vừa và nhỏ (log, cấu hình). Tệp rất lớn có thể mất thời gian tùy băng thông.',
      },
      { type: 'h3', id: 'permissions', text: 'Quyền truy cập tệp' },
      {
        type: 'p',
        text: 'Ứng dụng trên máy chạy với quyền của tài khoản đã cài đặt. Một số thư mục hệ thống có thể không đọc được nếu thiếu quyền quản trị — đây là hành vi bình thường của hệ điều hành.',
      },
      { type: 'h2', id: 'security-note', text: 'Lưu ý bảo mật' },
      {
        type: 'ul',
        items: [
          'Chỉ tải tệp cần thiết; tránh sao chép dữ liệu nhạy cảm ra ngoài tổ chức',
          'Xóa tệp tạm trên máy quản trị sau khi xử lý xong',
          'Phân quyền tài khoản bảng điều khiển để không phải ai cũng duyệt được mọi máy',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Xử lý sự cố',
    description: 'Hướng dẫn chẩn đoán và khắc phục các tình huống thường gặp khi vận hành.',
    icon: Wrench,
    blocks: [
      {
        type: 'p',
        text: 'Phần lớn sự cố liên quan đến kết nối mạng, mã ghép nối hoặc quyền thực thi trên máy đích. Làm theo từng mục dưới đây trước khi liên hệ hỗ trợ.',
      },
      { type: 'h2', id: 'machine-offline', text: 'Máy trạm hiển thị ngoại tuyến' },
      {
        type: 'ul',
        items: [
          'Kiểm tra máy đang bật và có kết nối internet',
          'Xác nhận ứng dụng StationHub vẫn chạy (dịch vụ nền chưa bị tắt)',
          'Đối chiếu địa chỉ máy chủ và mã ghép nối với cấu hình trên bảng điều khiển',
          'Kiểm tra tường lửa có chặn kết nối ra ngoài cổng HTTPS/WebSocket',
          'Xem nhật ký ứng dụng trên máy đích để biết lỗi chi tiết',
        ],
      },
      { type: 'h2', id: 'job-failed', text: 'Yêu cầu thực thi thất bại' },
      {
        type: 'p',
        text: 'Mở trang chi tiết của yêu cầu và đọc phần kết quả / nhật ký lỗi. Nguyên nhân phổ biến:',
      },
      {
        type: 'ul',
        items: [
          'Lệnh hoặc đường dẫn sai chính tả',
          'Tài khoản chạy ứng dụng không đủ quyền ghi file hoặc chạy lệnh',
          'Hết thời gian chờ — công việc kéo dài hơn giới hạn đã đặt',
          'Máy đích bận chạy việc khác — thử lại sau vài phút',
        ],
      },
      { type: 'h2', id: 'automation-failed', text: 'Quy trình dừng giữa chừng' },
      {
        type: 'p',
        text: 'Xem bước nào đánh dấu thất bại trong nhật ký lần chạy. Sửa cấu hình bước đó, chạy thử trên một máy trước khi áp dụng hàng loạt.',
      },
      { type: 'h2', id: 'telegram-no-response', text: 'Telegram không phản hồi' },
      {
        type: 'ul',
        items: [
          'Bot đã được bật trên bảng điều khiển và quy trình liên kết đang hoạt động',
          'Chat hoặc tài khoản của bạn nằm trong danh sách được phép (nếu đã cấu hình)',
          'Lệnh gửi đúng chính tả và khớp tên đã đăng ký',
          'Máy trạm mục tiêu đang trực tuyến — bot không thể chạy trên máy offline',
        ],
      },
      { type: 'h2', id: 'get-help', text: 'Khi cần hỗ trợ thêm' },
      {
        type: 'p',
        text: 'Chuẩn bị sẵn: thời điểm xảy ra sự cố, tên máy liên quan, ảnh chụp hoặc nội dung nhật ký lỗi. Thông tin này giúp đội hỗ trợ xử lý nhanh hơn.',
      },
    ],
  },
  {
    slug: 'faq',
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp về dùng thử, gói dịch vụ, bảo mật và giới hạn sử dụng.',
    icon: CircleHelp,
    blocks: [
      { type: 'h2', id: 'trial', text: 'Dùng thử 7 ngày gồm những gì?' },
      {
        type: 'p',
        text: 'Tài khoản mới được trải nghiệm đầy đủ chức năng trong 7 ngày: kết nối máy, giao việc, quy trình tự động và tích hợp Telegram (trong giới hạn gói dùng thử). Hết hạn bạn chọn gói trả phí để tiếp tục — dữ liệu cấu hình thường được giữ lại.',
      },
      { type: 'h2', id: 'limits', text: 'Giới hạn theo gói đăng ký' },
      {
        type: 'p',
        text: 'Mỗi gói quy định số máy trạm tối đa, số quy trình đang bật và tần suất chạy. Chi tiết hiển thị tại mục Gói & thanh toán trên bảng điều khiển. Nâng cấp gói khi mở rộng quy mô.',
      },
      { type: 'h2', id: 'security', text: 'Dữ liệu và kết nối có an toàn không?' },
      {
        type: 'p',
        text: 'Kết nối giữa máy trạm và máy chủ dùng mã hóa TLS/WSS. Mã ghép nối và token Telegram cần được bảo mật như mật khẩu — không chia sẻ công khai. Khuyến nghị bật danh sách cho phép Telegram trên môi trường sản xuất.',
      },
      { type: 'h2', id: 'multi-os', text: 'Có quản lý Windows và Mac cùng lúc không?' },
      {
        type: 'p',
        text: 'Có. Một bảng điều khiển hiển thị tất cả máy bất kể hệ điều hành. Khi thiết kế quy trình, lưu ý lệnh có thể khác nhau giữa Windows và Linux — nên tách quy trình hoặc dùng điều kiện rẽ nhánh theo loại máy.',
      },
      { type: 'h2', id: 'offline', text: 'Máy offline có chạy lịch được không?' },
      {
        type: 'p',
        text: 'Không. Lịch và yêu cầu gửi tới máy chỉ thực hiện khi máy trực tuyến. Nếu máy offline tại thời điểm chạy, yêu cầu có thể chờ hoặc báo thất bại tùy cấu hình — kiểm tra lịch sử để xác nhận.',
      },
    ],
  },
];

export const DOC_BY_SLUG = Object.fromEntries(DOC_PAGES.map((p) => [p.slug, p])) as Record<
  string,
  DocPage
>;

export const DEFAULT_DOC_SLUG = 'introduction';

export function getAllDocSearchItems() {
  return DOC_PAGES.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
  }));
}
