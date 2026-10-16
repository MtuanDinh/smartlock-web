# Smart Lock IoT — Web Dashboard (React 18 + Vite + TypeScript)

Bảng điều khiển Web quản trị ổ khóa thông minh IoT giao tiếp với mạch **ESP8266 (`newwemos.ino`)** và **Arduino Uno (`unoslave.ino`)** thông qua **Firebase Authentication** và **Firebase Realtime Database**.

---

## 1. Yêu cầu môi trường

- **Node.js**: tối thiểu `>= 18.18.0` (khuyến nghị **Node.js 20 LTS** hoặc **Node.js 22 LTS**).
- **npm**: `>= 9.0.0`.

---

## 2. Cài đặt & Chạy trên máy Local

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Cấu hình biến môi trường (`.env.local`)
Sao chép tệp mẫu `.env.example` sang `.env.local` và điền thông tin cấu hình Firebase Web App:
```bash
cp .env.example .env.local
```

Danh sách các biến môi trường trong `.env.local`:
| Biến môi trường | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | Có | Public Web API Key của Firebase Project |
| `VITE_FIREBASE_AUTH_DOMAIN` | Có | Auth domain (`<project-id>.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Có | Project ID của Firebase |
| `VITE_FIREBASE_DATABASE_URL` | Có | URL của Firebase Realtime Database |
| `VITE_ONLINE_THRESHOLD_MS` | Tùy chọn | Ngưỡng tính trạng thái Online của khóa theo nhịp tim `Last_Beat` (mặc định `35000` = 35 giây) |
| `VITE_USE_MOCK` | Tùy chọn | Đặt `true` để chạy chế độ giả lập giao diện không cần Firebase hay phần cứng (mặc định `false`) |

*(Lưu ý: Tệp `.env.local` đã được đưa vào `.gitignore` để không bao giờ bị commit lên Git).*

### Bước 3: Chạy môi trường phát triển (Dev Server)
```bash
npm run dev
```

### Bước 4: Chạy kiểm thử (Unit Tests), Lint & Build
```bash
npm run test      # Chạy bộ unit test bằng Vitest (logMeta, validators, userMutations, time, learnCardMachine)
npm run lint      # Kiểm tra ESLint 9 & TypeScript (tsc --noEmit)
npm run build     # Build bản tĩnh ra thư mục dist/
npm run preview   # Xem thử bản build tĩnh tại local
```

---

## 3. Chế độ Giả lập (`VITE_USE_MOCK=true`)

Khi muốn kiểm thử toàn bộ giao diện và luồng nghiệp vụ mà không cần kết nối Firebase hay mạch phần cứng:
1. Đặt `VITE_USE_MOCK=true` trong `.env.local` (hoặc chạy với biến môi trường `VITE_USE_MOCK=true`).
2. Ở chế độ Mock:
   - **Tự động bỏ qua bước đăng nhập** (đăng nhập sẵn tài khoản giả lập `admin@smartlock.local` để vào thẳng trang Tổng quan; bạn vẫn có thể bấm nút **Thoát** trên góc phải để kiểm thử màn hình Đăng nhập).
   - Hiển thị **Thanh công cụ Mock** ở đầu trang cho phép bật/tắt trạng thái *Ổ khóa Online/Offline*, *Mất mạng Trình duyệt*, *Quẹt thẻ mới OK*, và *Quẹt thẻ trùng*.
   - Module `src/lib/mockService.ts` được nạp bằng `import()` động nên **hoàn toàn không được đóng gói vào bản build production** khi `VITE_USE_MOCK=false`.

---

## 4. Triển khai (Deploy) lên GitHub Pages

Dự án sử dụng `HashRouter` và `base: './'` trong `vite.config.ts`, kèm 2 trang chuyển hướng tĩnh `public/users.html` và `public/logs.html` để tương thích ngược với các đường dẫn bookmark cũ.

> [!WARNING]
> **Cảnh báo trước khi merge vào nhánh `main`:**
> Nếu trước đây GitHub Pages đang phục vụ trực tiếp `index.html` từ thư mục gốc của nhánh `main`, **KHÔNG merge nhánh `feat/react-migration` vào `main`** cho đến khi bạn hoàn tất 2 bước cấu hình dưới đây.

### Bước 1: Khai báo GitHub Repository Variables
Vào **Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions $\rightarrow$ tab Variables** của repository và thêm đủ 4 biến (Workflow `.github/workflows/deploy.yml` sẽ tự động dừng và báo lỗi nếu bất kỳ biến nào bị bỏ trống):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_DATABASE_URL`
- *(Tùy chọn)* `VITE_ONLINE_THRESHOLD_MS` (ví dụ: `35000`)

### Bước 2: Chuyển nguồn GitHub Pages sang GitHub Actions
Vào **Settings $\rightarrow$ Pages $\rightarrow$ Build and deployment $\rightarrow$ Source**, chọn **GitHub Actions**.
Khi có commit được đẩy lên nhánh `main`, workflow `.github/workflows/deploy.yml` sẽ tự động chạy `lint`, `test`, `build`, kiểm tra không rò rỉ dữ liệu mock trong `dist/`, và xuất bản lên GitHub Pages.

---

## 5. Checklist Kiểm thử Thực tế trên Phần cứng (Wemos D1 Mini + Arduino Uno)

Khi kết nối với mạch thật, vui lòng kiểm tra 3 kịch bản nhạy cảm sau:

- [ ] **Test Phần cứng 1 – Học thẻ mới, Chống trùng thẻ & Ngắt kết nối**:
  1. Bấm `+ Thẻ mới` trên Web $\rightarrow$ màn hình LCD trên khóa chuyển sang `CHE DO THEM THE: Moi quet the...`.
  2. Quẹt thẻ mới $\rightarrow$ LCD báo `DA LUU THE MOI!`, modal trên Web tự đóng và hiện Toast thành công.
  3. Mở học thẻ cho thành viên khác, quẹt lại chiếc thẻ vừa cấp $\rightarrow$ LCD báo `THE DA BI TRUNG!`, modal trên Web tự đóng và hiện Toast cảnh báo thẻ trùng.
  4. **Kiểm tra tự thoát chế độ học thẻ (`onDisconnect` & Timeout)**:
     *(Lưu ý: các khoảng thời gian dưới đây là ước lượng thực nghiệm, không phải số liệu cam kết chính thức của Firebase)*
     - **4a. Đóng hẳn tab trình duyệt (Clean close)**: Mở chế độ học thẻ trên Web rồi đóng hẳn tab trình duyệt $\rightarrow$ kết nối WebSocket đóng sạch nên máy chủ Firebase thường kích hoạt `onDisconnect` trong khoảng vài giây, màn hình LCD thoát khỏi `CHE DO THEM THE`.
     - **4b. Bật chế độ máy bay / Mất mạng đột ngột (Unclean disconnect)**: Mở chế độ học thẻ trên điện thoại rồi bật chế độ máy bay $\rightarrow$ do kết nối TCP bị đứt ngang, máy chủ Firebase có thể cần khoảng vài chục giây đến vài phút để phát hiện đứt kết nối và chạy `onDisconnect` hạ `Add_Card_Mode = false`.
- [ ] **Test Phần cứng 2 – Thay thẻ từ cũ bằng thẻ mới & Đồng bộ Cache**:
  1. Chọn thành viên đang có thẻ A, bấm nút đổi thẻ và quẹt thẻ B mới.
  2. Sau khi modal tự đóng (Web đã xóa `SmartLock/RFID/{thẻ A}` và kích hoạt `Need_Sync` `false` $\rightarrow$ `true`), chờ khoảng vài giây cho Wemos đồng bộ xong.
  3. Quẹt thử **thẻ B (mới)** $\rightarrow$ cửa mở bình thường.
  4. Quẹt thử **thẻ A (cũ)** $\rightarrow$ khóa báo `The khong hop le` (xác nhận `/rfid.json` trong LittleFS của Wemos đã xóa sạch thẻ A).
- [ ] **Test Phần cứng 3 – Khóa rớt Wi-Fi khi đang Học thẻ & Tự phục hồi (`needsCancelRecovery`)**:
  1. Bật chế độ học thẻ cho một thành viên trên Web (LCD hiện `CHE DO THEM THE`).
  2. Ngắt Wi-Fi của ổ khóa và chờ đến khi Web phát hiện ổ khóa mất kết nối, modal học thẻ tự động đóng.
  3. Cấp lại Wi-Fi cho ổ khóa, chờ Web hiện ổ khóa Online trở lại (Web tự gửi xung `Add_Card_Mode: true` $\rightarrow$ `false` để mạch thoát khỏi `isLearningMode`).
  4. Quẹt một **thẻ LẠ** chưa đăng ký vào ổ khóa $\rightarrow$ khóa phải báo `The khong hop le` (tuyệt đối không gán thẻ lạ vào thành viên vừa hủy).

---

## 6. Ghi chú Bảo mật & Cấu hình Firebase Rules

> [!CAUTION]
> Các điểm dưới đây được ghi nhận từ thiết kế hiện tại của hệ thống và firmware (`newwemos.ino`, `unoslave.ino`). Vì ràng buộc giữ nguyên 100% firmware và cấu trúc dữ liệu, các mục này được tài liệu hóa để người vận hành nắm rõ và cấu hình bảo vệ trên Firebase Console / Google Cloud Console.

### 6.1. Legacy Database Secret (`FIREBASE_AUTH`) trong Firmware
- Trong tệp `newwemos.ino` (dòng 10), hằng số `FIREBASE_AUTH` (`"<REDACTED_DATABASE_SECRET>"`) là một **Firebase Database Secret** (legacy token).
- Token này có quyền quản trị tối cao và **bỏ qua toàn bộ Firebase Security Rules**.
- **Khuyến nghị bắt buộc**: Nếu mã nguồn chứa `newwemos.ino` từng được đẩy lên repository công khai (Public), bạn cần vào ngay *Firebase Console $\rightarrow$ Project Settings $\rightarrow$ Service accounts $\rightarrow$ Database secrets* để **Rotate (Tạo mới & Xóa secret cũ)**, sau đó nạp lại firmware cho ESP8266.

### 6.2. Các mật mã cố định (Hardcoded) trong Firmware
- **Mã Master mở cửa `999999`** (`unoslave.ino`, dòng 341): Luôn mở cửa trực tiếp tại bàn phím cứng mà không cần tra cứu cache hay Firebase. (Trên giao diện Web đã chặn không cho phép đặt mã PIN thành viên trùng với `999999`).
- **Mã xóa Wi-Fi & Cache `BABABC` + `#`** (`unoslave.ino`, dòng 330): Khi bấm `BABABC#` trên bàn phím cứng, mạch sẽ xóa cấu hình Wi-Fi, format bộ nhớ LittleFS và khởi động lại.
- **Mật khẩu WiFiManager AP `12345678`** (`newwemos.ino`, dòng 148): Mật khẩu của mạng Wi-Fi cấu hình `SmartLock_Setup` khi mạch không kết nối được router.

### 6.3. Lưu trữ mã PIN dạng Plaintext
- Để mạch ESP8266 có thể đọc và dò chuỗi trực tiếp từ tệp `/pass.json` trong bộ nhớ LittleFS mà không tốn RAM giải mã, mã PIN của thành viên đang được lưu dạng chuỗi thuần (plaintext) tại `SmartLock/Users/{id}/pass` và dùng trực tiếp làm key tại `SmartLock/Passwords/{pin}`.
- Trên giao diện Web, mã PIN mặc định được che (`••••••`) và chỉ hiển thị khi người quản trị bấm nút con mắt.

### 6.4. Khóa tự đăng ký (Sign-up), Giới hạn API Key & Cấu hình Firebase Rules
Do cấu hình `VITE_FIREBASE_*` nằm trong mã nguồn phía trình duyệt (Public Client Config), việc bảo mật dữ liệu hoàn toàn phụ thuộc vào cấu hình trên **Firebase Console** và **Google Cloud Console**:

1. **Bắt buộc tắt tính năng tự tạo tài khoản (Enable create / Sign-up) trong Firebase Authentication**:
   - *Lý do*: Dù giao diện Web không có trang Đăng ký, bất kỳ ai lấy được `VITE_FIREBASE_API_KEY` từ trình duyệt đều có thể gọi trực tiếp REST API `accounts:signUp` của Firebase Identity Toolkit để tự tạo tài khoản mới và vượt qua quy tắc `auth != null`.
   - *Cách tắt*: Vào **Firebase Console $\rightarrow$ Authentication $\rightarrow$ Settings $\rightarrow$ User actions**, bỏ chọn (tắt) mục **"Enable create (sign-up)"**.
2. **Giới hạn HTTP Referrer cho Browser API Key**:
   - Vào **Google Cloud Console $\rightarrow$ APIs & Services $\rightarrow$ Credentials**, chọn API Key tương ứng với `VITE_FIREBASE_API_KEY`.
   - Trong mục **Application restrictions**, chọn **Websites** và chỉ cho phép domain GitHub Pages của bạn (`https://<username>.github.io/*`) cùng `http://localhost:*`.
3. **Cấu hình Firebase Realtime Database Rules (Giới hạn theo `uid` hoặc `email` Admin + Đánh chỉ mục `.indexOn`)**:
   - Thay vì chỉ kiểm tra `auth != null`, hãy giới hạn quyền đọc/ghi cho đúng `uid` của tài khoản Admin (hoặc kiểm tra `email` kèm `email_verified === true`).
   - Đồng thời thêm `.indexOn: ["timestamp"]` tại nhánh `SmartLock/Logs` để truy vấn `orderByChild("timestamp").limitToLast(500)` được thực thi bằng chỉ mục phía server:

```json
{
  "rules": {
    "SmartLock": {
      ".read": "auth != null && (auth.uid === '<ADMIN_UID>' || (auth.token.email === '<ADMIN_EMAIL>' && auth.token.email_verified === true))",
      ".write": "auth != null && (auth.uid === '<ADMIN_UID>' || (auth.token.email === '<ADMIN_EMAIL>' && auth.token.email_verified === true))",
      "Logs": {
        ".indexOn": ["timestamp"]
      }
    }
  }
}
```
