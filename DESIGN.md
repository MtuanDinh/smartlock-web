# DESIGN.md — Smart Lock IoT Access Hub

- **Stitch Project:** `projects/7302845698075231897` ("Modern Web UI Redesign")
- **Màn hình tham chiếu:** `SCREEN_2` Đăng nhập · `SCREEN_6` Tổng quan · `SCREEN_8` Thành viên · `SCREEN_4` Nhật ký
- **Prototype đã duyệt:** `.stitch/designs/{login,dashboard,users,logs}.html`
- **Phần cứng thật:** Wemos D1 Mini (ESP8266) + Arduino Uno (keypad analog, RFID RC522 13,56 MHz, LCD 16x2, relay). Giao tiếp duy nhất qua Firebase Realtime Database.

> Nguyên tắc số 1 — **Trung thực với phần cứng.** Prototype Stitch chứa nhiều số liệu minh họa (pin, RSSI, ESP32, AES, SMS, camera…). Giao diện thật **chỉ hiển thị dữ liệu có trong RTDB** (`src/lib/paths.ts`). Mọi chữ minh họa không có nguồn dữ liệu phải bỏ hoặc thay bằng dữ liệu thật (xem mục 7).

---

## 1. Nguyên tắc thiết kế

1. **Tin cậy:** Trạng thái ổ khóa (`System/Last_Beat`, ngưỡng `ONLINE_THRESHOLD_MS = 35000`), chế độ khóa chặt (`Control/Lockdown`) và trạng thái đồng bộ (`Control/Need_Sync`) luôn hiển thị rõ, cập nhật thời gian thực.
2. **Phân biệt hai loại mất kết nối:** "Điện thoại/trình duyệt mất mạng" (`.info/connected`, màu cảnh báo vàng) khác "Ổ khóa mất kết nối" (`Last_Beat` quá hạn, màu trung tính xám).
3. **Rõ ràng, ít tải nhận thức:** Một hành động chính mỗi khối (Mở khóa từ xa). Hành động nguy hiểm (Khóa chặt, Khởi động lại, Xóa thành viên) luôn qua `ConfirmDialog`.
4. **Mobile-first:** Mọi màn hình dùng được ở 360px không cuộn ngang; vùng chạm ≥ 44px.

## 2. Điều hướng đa thiết bị

| Kích thước | Header trên | Thanh điều hướng |
| --- | --- | --- |
| Desktop `≥ 1024px` (`lg`) | Logo · **pill nav giữa** (`hidden lg:flex`, `whitespace-nowrap`) · trạng thái · theme · Thoát · avatar | Không có bottom nav |
| Tablet `768–1023px` & Mobile `< 768px` | Logo · trạng thái · theme · avatar (nút "Thoát" chỉ còn icon) | **Bottom nav** `fixed bottom-0 lg:hidden`, `pb-[env(safe-area-inset-bottom)]`, 3 mục `Tổng quan` / `Thành viên` / `Nhật ký`; nội dung trang có `pb-20 lg:pb-0` |

- Mục đang chọn (cả hai thanh): nền `primary-container`, chữ `on-primary`, dạng viên thuốc `rounded-full`.
- Logo bọc `<Link to="/">`. Màn hình Đăng nhập không có thanh điều hướng.

## 3. Design tokens

Mở rộng hệ biến CSS sẵn có (`rgb(var(--token) / <alpha-value>)`) để dùng được `bg-secondary-container/30`. Không dùng mã hex trực tiếp trong component.

| Token | Light (prototype) | Dark | Vai trò |
| --- | --- | --- | --- |
| `surface` | `#faf8ff` | `#0b0f19` | Nền trang |
| `surface-container-lowest` | `#ffffff` | `#111827` | Card, modal, bảng |
| `surface-container-low` | `#f2f3ff` | `#161e2e` | Ô input, thanh công cụ |
| `surface-container` | `#eaedff` | `#1e293b` | Chip chưa chọn, header bảng |
| `surface-container-high` | `#e2e7ff` | `#273348` | Hover, track switch tắt |
| `on-surface` | `#131b2e` | `#f8fafc` | Chữ chính |
| `on-surface-variant` | `#434655` | `#94a3b8` | Chữ phụ |
| `outline` | `#737686` | `#64748b` | Placeholder, timestamp |
| `outline-variant` | `#c3c6d7` | `#334155` | Viền mảnh (thường dùng `/30`) |
| `primary` | `#004ac6` | `#93b4ff` | Chữ/icon nhấn |
| `primary-container` | `#2563eb` | `#2563eb` | Nút chính, tab đang chọn (chữ trắng) |
| `primary-fixed` | `#dbe1ff` | `#172554` | Nền avatar, badge thông tin |
| `secondary` | `#006a61` | `#2dd4bf` | Trực tuyến, hợp lệ, mở quyền |
| `secondary-container` | `#86f2e4` | `#134e4a` | Nền badge thành công |
| `on-secondary-container` | `#006f66` | `#99f6e4` | Chữ trên nền thành công |
| `tertiary` / `tertiary-fixed` | `#6a1edb` / `#eaddff` | `#a78bfa` / `#2e1065` | Thẻ RFID, sự kiện hệ thống |
| `error` | `#ba1a1a` | `#f87171` | Cảnh báo, Khóa chặt, Xóa |
| `error-container` / `on-error-container` | `#ffdad6` / `#93000a` | `#450a0a` / `#fecaca` | Nền/chữ cảnh báo |
| `warning` / `warning-container` *(bổ sung)* | `#b45309` / `#fef3c7` | `#fbbf24` / `#451a03` | Mất mạng trình duyệt, log offline |

- **Giao diện mặc định:** theo hệ điều hành (`prefers-color-scheme`); người dùng chọn tay thì lưu `localStorage` (`smartlock_theme_preference`).
- **Tương phản:** mọi cặp chữ/nền đạt WCAG AA (≥ 4.5:1 cho chữ thường). Kiểm lại riêng các cặp dark mode khi code.

## 4. Typography

- Tiêu đề, nhãn, số liệu: **Plus Jakarta Sans** (600/700/800). Nội dung, bảng: **Inter** (400/500/600). Cả hai có bộ ký tự tiếng Việt.
- UID thẻ, mã PIN đang hiện: **JetBrains Mono** / `ui-monospace`.

| Token | Cỡ / dòng | Độ đậm | Dùng cho |
| --- | --- | --- | --- |
| `headline-xl` | 32/40 (mobile 26/34), `-0.02em` | 700 | Tiêu đề trang, số KPI |
| `headline-lg` | 24/32, `-0.015em` | 600 | Nhãn trạng thái khóa |
| `headline-md` | 20/28 | 600 | Tiêu đề card, modal |
| `headline-sm` | 16/24 | 600 | Tên thành viên, nút chính |
| `label-lg` / `label-md` / `label-sm` | 14/20 · 12/16 · 11/14 | 600 · 600 · 700 | Nhãn, chip, overline viết hoa |
| `body-lg` / `body-md` / `body-sm` | 16/24 · 14/20 · 13/18 | 400 | Nội dung |

## 5. Hình khối, khoảng cách, độ sâu

- Bo góc theo mặc định Tailwind (trùng cấu hình Stitch): chip/nav `rounded-full`; nút, input, ô icon `rounded-xl` (12px); card chính, modal `rounded-2xl` (16px).
- Container: Tổng quan `max-w-[1440px]`, Thành viên/Nhật ký `max-w-7xl`; lề ngang 16px / 24px (`md`) / 40px (`lg`); khoảng cách lưới 20–24px.
- Đổ bóng: card `shadow-sm`, hover/hộp thoại `shadow-md`, nút chính có quầng sáng nhẹ màu `primary`. Viền `outline-variant/30`.
- Chuyển động 150–300ms; tôn trọng `prefers-reduced-motion` (đã có trong `index.css`).

## 6. Đặc tả màn hình

### 6.1 Đăng nhập (`SCREEN_2`)
- Card đôi `max-w-[1080px] lg:grid-cols-12`. Mobile: chỉ hiện form, ẩn cột minh họa.
- **Cột trái (`lg:col-span-5`) — tĩnh, không đọc RTDB** (chưa đăng nhập thì Rules chặn đọc): biểu tượng khóa, tên sản phẩm, 3 gạch đầu dòng đúng sự thật: *Điều khiển từ xa qua Firebase*, *Mở bằng mã PIN, thẻ RFID hoặc nút bấm*, *Nhật ký vẫn ghi khi mất Wi-Fi và tự đồng bộ lại*.
- **Cột phải (`lg:col-span-7`):** Email, Mật khẩu (nút ẩn/hiện), nút `Đăng nhập vào Hệ thống`, Enter để gửi, thông báo lỗi tiếng Việt.
- **Không có:** Passkey/FIDO2, QR qua App, 2FA OTP, link "Đăng ký" (đăng ký phải tắt trong Firebase Auth), "Trợ giúp", chọn ngôn ngữ, giá trị điền sẵn.

### 6.2 Tổng quan (`SCREEN_6`)
- **3 thẻ KPI** (`grid-cols-1 md:grid-cols-3`), dùng chung với trang Nhật ký:
  1. *Lượt mở hôm nay* — không tính log offline; dòng phụ `+N từ log offline`.
  2. *Cảnh báo hôm nay* — dòng phụ `+N từ log offline`.
  3. *Trạng thái kết nối* — Trực tuyến / Ổ khóa ngoại tuyến / Mất mạng thiết bị; dòng phụ `Chế độ: Bình thường | Đang khóa chặt` và `Nhịp tim: X giây trước`.
- **Khối trái `lg:col-span-5` — điều khiển khóa:** badge `Cập nhật: X giây trước`; vòng tròn trạng thái 3 lớp (`w-40 h-40`); nút `MỞ KHÓA TỪ XA` (`h-14`, gradient `primary → primary-container`); khay 2 nút `Khởi động lại` và `KHÓA CHẶT` (khi đang khóa chặt đổi thành `Mở Trở Lại`).
- **Trạng thái vòng tròn (theo thứ tự ưu tiên):**

  | Ưu tiên | Điều kiện | Màu | Nhãn |
  | --- | --- | --- | --- |
  | 1 | `.info/connected = false` (sau 5s grace) | `warning` | ĐIỆN THOẠI/TRÌNH DUYỆT MẤT MẠNG |
  | 2 | `Last_Beat` quá 35s | trung tính | Ổ KHÓA MẤT KẾT NỐI |
  | 3 | Vừa nhận ack `Remote_Open` (hiện 3s) | `secondary` | THIẾT BỊ ĐÃ NHẬN LỆNH MỞ |
  | 4 | `Lockdown = true` | `error` | ĐANG KHÓA CHẶT |
  | 5 | Bình thường | `primary` | CỬA ĐANG ĐÓNG |

  Mô tả phụ đúng firmware: relay mở khoảng 3 giây rồi tự đóng. **Không có** nút "Khóa lại ngay" (firmware không có lệnh khóa từ xa).
- **Khối phải `lg:col-span-7` — Hoạt động mới nhất:** chip lọc nhanh, timeline các log thật, nút `Xem tất cả nhật ký`; thẻ tóm tắt `N thành viên đang mở quyền` dẫn sang `#/users`.

### 6.3 Thành viên (`SCREEN_8`)
- **3 thẻ KPI** (`grid-cols-1 sm:grid-cols-3`): *Tổng thành viên* (dòng phụ: N đang mở quyền) · *Thẻ RFID đã gán* (`X / Y`) · *Trạng thái đồng bộ* (Đã đồng bộ / Đang chờ ổ khóa đồng bộ / Chưa đồng bộ — Thử lại / Ổ khóa ngoại tuyến).
- **Card quản lý:** nút `Thêm thành viên`, ô tìm kiếm, chip `Tất cả` · `Đang mở quyền` · `Đã gán thẻ` · `Đang tạm khóa`.
- **Bảng (`≥ md`) / thẻ danh sách (`< md`):** avatar chữ cái đầu · tên + đổi tên · switch quyền (`Mở`/`Tắt`) · PIN `• • • • • •` + xem tạm (giữ số 0 đầu) + đổi/xóa PIN · badge thẻ RFID + Học/Đổi thẻ · Xóa.
- **2 thẻ hướng dẫn** (`md:grid-cols-2`):
  - *Gán thẻ từ RFID:* bấm nút thẻ trên hàng thành viên → LCD hiện "CHE DO THEM THE" → quẹt thẻ MIFARE vào đầu đọc. Web chờ tối đa 60 giây; đóng hộp thoại là hủy.
  - *Quy tắc mã PIN:* 4–6 chữ số, không trùng giữa các thành viên, không dùng `999999` (mã dành riêng của ổ khóa). Tên hiển thị trên LCD tối đa 16 ký tự, nên dùng không dấu.

### 6.4 Nhật ký (`SCREEN_4`)
- Cùng 3 thẻ KPI như Tổng quan (bỏ "Tổng sự kiện" theo yêu cầu trước đó).
- Card dữ liệu: tìm kiếm (debounce 250ms), `Tải thêm 500`, 6 chip có số đếm `Tất cả` · `Mở cửa` · `Cảnh báo` · `Nút bấm` · `Qua Web` · `Hệ thống`; bảng (`≥ md`) / thẻ (`< md`) nhóm theo `Ngày: DD/MM/YYYY`, dòng log offline có badge `Offline`; phân trang 15 dòng/trang.

### 6.5 Thành phần dùng chung
- Footer: `© Smart Lock IoT · Dữ liệu đồng bộ qua Firebase Realtime Database`. Không có link SDK/Trung tâm bảo mật/Hỗ trợ 24/7.
- Banner hệ thống (giữ nguyên chức năng): mất mạng trình duyệt; "Đã lưu nhưng chưa đồng bộ xuống ổ khóa" + `Thử lại`; thanh giả lập chỉ khi `VITE_USE_MOCK=true`.
- Icon: `lucide-react` (đã có), ánh xạ ngữ nghĩa với Material Symbols của prototype.

## 7. Nội dung prototype phải bỏ hoặc thay

| Màn hình | Nội dung minh họa | Xử lý |
| --- | --- | --- |
| Chung | "ESP32", "Gateway ESP32-V2", "FW v3.4.12", "MQTT Broker", "AWS IoT Core", "ECC608", "AES-128/256" | Bỏ. Phần cứng là Wemos D1 Mini + Uno, kết nối Firebase |
| Chung | Huy hiệu "Đang kết nối" khi đã online | Đổi thành "Trực tuyến" ("Đang kết nối" chỉ dùng lúc đang tải) |
| Đăng nhập | Passkey/FIDO2, QR qua App, 2FA OTP, Đăng ký, Trợ giúp, VIE, "-58 dBm", "98%", "14 ms", trạng thái gateway trước khi đăng nhập | Bỏ |
| Tổng quan | "Căn hộ A.1204", Ping/tín hiệu, pin 88% / "142 ngày", "Auto-Lock", "Đã gửi SMS", "Xác thực 2 lớp", "Khóa lại ngay", Camera, Cảm biến Reed, "Thẻ NFC #NFC-8821", "PIN dùng 1 lần / Khách ghé thăm", vai trò Admin/Member/Guest | Bỏ; dùng log và số liệu thật |
| Thành viên | "Cloud Guard", "100% Đã xác thực", "Chuẩn mã hóa Mifare", "Firmware v2.4.1", vai trò & ngày đăng ký, "Khách có hạn giờ", ô chọn vai trò, nút "Chi tiết phân quyền", "Bảo mật mã PIN 6-Digit", "Cảm biến đóng cửa", "Thử nghiệm quét", "10 giây", "tối thiểu 6 số", "khóa bàn phím 3 phút", "Chống nhìn trộm" | Bỏ hoặc thay bằng quy tắc thật ở 6.3 |
| Nhật ký | "Tổng sự kiện", "Tình trạng Cache / trễ 12ms", "Cập nhật mỗi 2 giây", "Sắp xếp", nhãn MQTT/ESP32 | Bỏ (dữ liệu là realtime, luôn mới nhất trước) |
