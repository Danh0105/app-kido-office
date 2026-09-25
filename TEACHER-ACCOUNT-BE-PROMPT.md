# Backend Update — Tài khoản đăng nhập cho giáo viên

## Overview

Giáo viên cần **tự đăng nhập** để xem lịch dạy và check-in/check-out tại trường
(`/#/giao-vien/lich-day`). Trước đây Nhân sự phải tạo tài khoản nhân viên ở màn khác,
cấp role `giaovien`, rồi mới quay lại gắn vào hồ sơ giáo viên — 3 bước, dễ quên.

Form **Thêm giáo viên** (`Giảng dạy → Giáo viên`) nay gộp luôn việc cấp tài khoản —
**không còn lựa chọn loại tài khoản**, cứ thêm giáo viên là có tài khoản đăng nhập:

- **SĐT và email bắt buộc.** SĐT chính là **tên đăng nhập** (`POST /auth/login` đang nhận
  `{ phone, password }`).
- Ô **Mật khẩu** điền sẵn **`123456`** (sửa được, tối thiểu 6 ký tự).
- Sửa giáo viên đã có tài khoản → form chỉ hiện tài khoản đang gắn, không tạo thêm.
  Giáo viên cũ chưa có tài khoản → lần sửa tiếp theo sẽ cấp luôn.

---

## 1. Hiện trạng FE đang chạy (không cần BE đổi gì để hoạt động)

Khi thêm giáo viên (hoặc sửa giáo viên chưa có tài khoản), FE gọi **2 request liên tiếp**:

```jsonc
// 1) Tạo tài khoản đăng nhập
POST /employees
{
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "a@kidoedu.vn",
  "password": "123456",
  "roles": ["giaovien"],
  "departmentId": 1
}

// 2) Gắn tài khoản vào hồ sơ giáo viên
POST /teachers
{
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "a@kidoedu.vn",
  "employeeId": <id từ bước 1>,
  "isActive": true,
  "note": null
}
```

Yêu cầu tối thiểu để luồng này đúng:

- `POST /employees` phải **trả về `id`** của tài khoản vừa tạo (FE đang đọc `res.id`
  hoặc `res.data.id`).
- **SĐT phải là duy nhất** — trùng thì trả `400/409` với message rõ ràng
  (`"Số điện thoại đã được sử dụng"`), FE hiển thị nguyên văn.
- Email nên duy nhất tương tự.
- Tài khoản tạo ra phải đăng nhập được ngay bằng `POST /auth/login` `{ phone, password }`
  và token có role `giaovien`.

---

## 2. Đề xuất: gộp về 1 request (BE làm, FE sẽ chuyển sang dùng)

Hai request liên tiếp không có transaction: nếu bước 2 lỗi thì tài khoản đã tạo bị mồ côi
(FE hiện báo cho người dùng biết để gắn lại, nhưng đó là vá tạm).

**`POST /teachers`** nhận thêm field `password`:

```json
{
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "a@kidoedu.vn",
  "password": "123456",
  "isActive": true
}
```

Xử lý:

1. `phone`, `email`: **bắt buộc**, validate định dạng, kiểm tra trùng.
2. Có `password` và **chưa gửi `employeeId`** → BE tự tạo tài khoản nhân viên
   (role `giaovien`, `departmentId` mặc định) rồi gắn `employeeId` vào hồ sơ giáo viên,
   **trong cùng một transaction**.
3. Có `employeeId` (giáo viên đã gắn tài khoản) → giữ nguyên, không tạo thêm tài khoản.
4. `password` mặc định `123456` nếu FE không gửi; độ dài tối thiểu 6.

Response giữ nguyên shape `Teacher` hiện có (kèm `employeeId`, `employeeName`).

---

## 3. Cần thêm: đặt lại mật khẩu (Nhân sự)

Hiện chỉ có `PATCH /employees/:id/change-password` yêu cầu `oldPassword` — Nhân sự **không
biết mật khẩu cũ** của giáo viên nên không dùng được khi giáo viên quên mật khẩu.

**`PATCH /employees/:id/reset-password`** (hoặc `/teachers/:id/reset-password`):

```json
// body rỗng, hoặc { "password": "123456" }
{}
```

- Chỉ role `nhansu` / `director` được gọi → sai thì `403`.
- Không cần `oldPassword`; đặt về `123456` nếu body rỗng.
- Trả `{ "password": "123456" }` để Nhân sự đọc lại cho giáo viên.

FE chưa làm nút "Đặt lại mật khẩu" vì chưa có endpoint — có endpoint là gắn được ngay
vào màn `Giảng dạy → Giáo viên`.

---

## 4. Kiểm tra lại phía giáo viên

Sau khi đăng nhập bằng SĐT + mật khẩu, tài khoản role `giaovien` phải:

- `GET /teachers/me` → trả hồ sơ giáo viên gắn với tài khoản đó
  (404 nếu chưa gắn → FE hiện màn "Chưa có hồ sơ giáo viên").
- `GET /teaching-sessions/me?fromDate=&toDate=` → chỉ trả buổi dạy của chính giáo viên đó.
- `POST /teaching-sessions/:id/checkin` và `/checkout` → chỉ cho phép trên buổi của chính mình.

Xem chi tiết phần check-in/check-out và số tiết ở `SCHOOL-LOCATION-BE-PROMPT.md` mục 4.
