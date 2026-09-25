# Prompt — Gắn API cho FE giáo viên trên Zalo Mini App

Bạn đang xây **Zalo Mini App cho giáo viên** của hệ thống KIDO, thay cho giao diện
`giaovien` đang chạy trong web app hiện tại (`/giao-vien/*`).

**Backend giữ nguyên, không sửa gì.** Toàn bộ endpoint dưới đây đã chạy thật trên
production; nhiệm vụ của bạn là gọi đúng và giữ nguyên các quy tắc nghiệp vụ.
Những chỗ backend **chưa có** được đánh dấu ⚠️ ở mục 2.7 và mục 8 — không tự bịa
endpoint thay thế.

Nguồn tham chiếu trong repo web hiện tại (đọc để lấy đúng kiểu dữ liệu, đừng gõ lại tay):

| Việc                        | File                                     |
| --------------------------- | ---------------------------------------- |
| Kiểu dữ liệu & enum         | `src/types/teaching.ts`                  |
| Toàn bộ lời gọi API         | `src/service/teaching.ts`                |
| Interceptor token / 401 403 | `src/service/api.ts`                     |
| GPS, haversine, bán kính    | `src/utils/geo.ts`                       |
| Logic check-in / check-out  | `src/pages/Teaching/hooks/useSessionCheckin.ts` |
| 3 màn giáo viên đang chạy   | `src/pages/Teaching/MySchedulePage.tsx`, `TeacherAttendancePage.tsx`, `OpenSessionsPage.tsx` |
| Hàm ngày giờ, tính tiết     | `src/pages/Teaching/lib.ts`              |

---

## 1. Phạm vi

Mini App có đúng **3 màn** (bằng đúng 3 tab của giao diện giáo viên hiện tại):

1. **Lịch của tôi** — xem buổi dạy theo ngày / tuần / tháng + tổng hợp + lịch tuần cố định.
2. **Chấm công** — check-in / check-out tại trường bằng GPS, xem lịch sử đã chấm.
3. **Tiết đang mở** — xem tiết Nhân sự mở, đăng ký nhận dạy, rút đăng ký.

Ngoài phạm vi: mọi màn của `nhansu` (quản lý giáo viên, lớp học, xếp TKB, chấm công
cho người khác). Mini App **không được** gọi các endpoint quản lý — role `giaovien`
sẽ nhận 403.

---

## 2. Kết nối & xác thực

```
Production : https://sales.kidoedu.vn
Dev        : http://160.250.132.143:3011
```

Base URL **không có prefix `/api`** — endpoint là `/teachers`, `/teaching-sessions`, …

Khai domain vào whitelist request của Mini App (`app-config.json`) trước khi gọi,
nếu không mọi request bị chặn ngay ở webview.

> Lưu ý: web app hiện tại hard-code `https://sales.kidoedu.vn/auth/login` trong
> `src/pages/Auth/Login.tsx` trong khi các API khác đọc `VITE_API_URL`. **Đừng chép
> lại lỗi này** — Mini App phải lấy base URL từ một chỗ cấu hình duy nhất.

### Xác thực — tổng quan

Hệ thống dùng **JWT bearer token, một tầng, không có refresh token**. Toàn bộ mô tả
dưới đây đã đối chiếu với code backend đang chạy
(`src/auth/*`, `src/teaching/teaching-roles.ts`).

### 2.1 Đăng nhập bằng số điện thoại + mật khẩu

Đây là **cách đăng nhập duy nhất** Mini App được dùng ở giai đoạn này.

```http
POST /auth/login
Content-Type: application/json

{ "phone": "0901234567", "password": "123456" }
```

```jsonc
// 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 42,
    "name": "Nguyễn Văn A",
    "roles": ["giaovien"]        // mảng, một người có thể nhiều role
  }
}

// 401 Unauthorized
{ "statusCode": 401, "message": "Sai số điện thoại hoặc mật khẩu" }
```

Điểm phải biết trước khi code:

- Endpoint **không có ValidationPipe**. Thiếu `phone` hoặc `password`, gửi sai kiểu →
  vẫn rơi vào `401` với đúng message trên, **không phải `400`**. Vậy nên FE tự validate
  trước khi gửi (SĐT không rỗng, mật khẩu không rỗng).
- Sai SĐT và sai mật khẩu trả **cùng một message** — cố tình như vậy, đừng đoán và hiển
  thị "số điện thoại không tồn tại".
- Mật khẩu so bằng bcrypt phía server. **Không bao giờ lưu mật khẩu** trên máy, kể cả
  khi làm "ghi nhớ đăng nhập" — chỉ lưu `access_token`.
- Tài khoản giáo viên do phòng Nhân sự tạo, mật khẩu cấp sẵn là `123456`. Nhắc đổi mật
  khẩu sau lần đăng nhập đầu (⚠️ backend **chưa có** endpoint đổi mật khẩu — xem 2.7).

### 2.2 Access token

| Thuộc tính     | Giá trị                                                            |
| -------------- | ------------------------------------------------------------------ |
| Kiểu           | JWT ký đối xứng bằng `JWT_SECRET` phía server                       |
| **Hạn dùng**   | **1 ngày** (`expiresIn: '1d'`) tính từ lúc đăng nhập                |
| Refresh token  | **Không có**                                                       |
| Thu hồi token  | Không có — server không giữ danh sách token; đăng xuất chỉ là xoá phía client |

Payload decode được (chỉ để hiển thị, xem 2.6):

```jsonc
{
  "sub": 42,                 // employeeId — chính là user.id
  "roles": ["giaovien"],
  "name": "Nguyễn Văn A",
  "iat": 1786000000,         // giây
  "exp": 1786086400          // giây — hết hạn sau 1 ngày
}
```

Backend đọc token qua `passport-jwt` → `req.user = { id, roles, name, iat, exp }`.
`sub` trong token thành `id` ở phía server.

### 2.3 Gắn token vào mọi request

Header duy nhất cần gửi:

```http
Authorization: Bearer <access_token>
```

Không có cookie, không có CSRF token, không có header tuỳ biến nào khác.

**Khác web, phải xử lý:** web dùng `localStorage` đồng bộ nên interceptor đọc token
ngay trong hàm. Zalo Mini App dùng storage **bất đồng bộ** (`zmp-sdk`
`getStorage`/`setStorage`), nên:

1. Lúc app khởi động: `await getStorage(['access_token'])` **một lần** → nạp vào một
   biến module / store. Chưa nạp xong thì hiện splash, chưa gọi API.
2. Interceptor request đọc từ **biến** đó (đồng bộ) — không `await` storage mỗi request.
3. Đăng nhập / đăng xuất: cập nhật **cả biến lẫn storage**, đúng thứ tự đó.
4. Đăng xuất = xoá token ở cả hai chỗ rồi về màn đăng nhập. Không cần gọi API nào.

### 2.4 Hết hạn phiên

Vì không có refresh token, sau **1 ngày** mọi request trả `401`. Bắt buộc xử lý:

- Interceptor response: gặp `401` → xoá token (biến + storage) → điều hướng về màn
  đăng nhập kèm thông báo *"Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."*
- Chủ động hơn: lúc mở app, decode `exp` và so với `Date.now()/1000`. Hết hạn rồi thì
  vào thẳng màn đăng nhập, khỏi để user bấm một vòng mới biết.
- ⚠️ Cẩn thận với dữ liệu đang nhập: giáo viên đang gõ lý do báo bận / ghi chú đăng ký
  mà bị đá ra là mất trắng. Giữ lại nội dung đang nhập, đăng nhập xong trả về đúng chỗ cũ.
- **Không** tự động đăng nhập lại bằng mật khẩu lưu sẵn (vì không được lưu mật khẩu).

### 2.5 Phân quyền — phân biệt 401 / 403 / 404

Backend chặn hai tầng: `JwtAuthGuard` (token) rồi `RolesGuard` (role trong metadata).
Riêng module giảng dạy còn suy thêm **scope từ token**, và:

> `teacherId` gửi lên query của các endpoint `/me` **luôn bị bỏ qua** — giáo viên không
> xem được lịch của người khác dù có sửa tham số.

| Mã    | Nghĩa                                                        | Mini App xử lý |
| ----- | ------------------------------------------------------------ | -------------- |
| `401` | Không có token / token sai chữ ký / **token hết hạn**        | Xoá token → màn đăng nhập |
| `403` | Token hợp lệ nhưng **role không đủ** (vd gọi endpoint của `nhansu`) | Toast "Bạn không có quyền truy cập chức năng này". Không hiện thêm toast lỗi khác. |
| `404` | Ở nhóm `/me`: token và role đều đúng, nhưng **tài khoản chưa được gắn hồ sơ giáo viên** | Empty state (mục 4), **không** logout, **không** màn lỗi |

Role dùng trong hệ thống (`employee.roles` là mảng text):

| Role                                                | Vai trò                         |
| --------------------------------------------------- | ------------------------------- |
| `giaovien`                                          | **Role Mini App cần**           |
| `nhansu`                                            | Quản lý toàn bộ module giảng dạy |
| `director`, `director_la`, `troly_gd`, `ketoan_truong` | Chỉ xem                      |

Quy tắc cho Mini App:

- Sau khi login, kiểm tra `user.roles.includes("giaovien")`. Không có → **không lưu
  token**, hiện thông báo *"Tài khoản này không phải giáo viên. Vui lòng dùng ứng dụng
  web của công ty."* Đừng để vào rồi ăn 403 ở từng màn.
- Một người **có thể vừa `giaovien` vừa `nhansu`** — Mini App chỉ có giao diện giáo viên
  nên cứ cho vào bình thường, không cần phân nhánh như web.
- Mini App **không được** gọi bất kỳ endpoint quản lý nào (danh sách được phép: mục 4).

### 2.6 Decode token phía client

Được phép decode payload để đọc `name`, `roles`, `exp` cho việc hiển thị và điều hướng.
Nhưng:

- **Không tự verify chữ ký** — secret nằm ở server, FE không có và không cần.
- Không dùng `roles` trong token làm cơ sở bảo mật thật. Server vẫn là nơi quyết định;
  ẩn nút chỉ là để đỡ bấm nhầm.
- Decode = `atob` phần giữa của chuỗi JWT rồi `JSON.parse`. Token hỏng/không đúng định
  dạng thì trả `null` và coi như chưa đăng nhập, đừng để app crash.

### 2.7 Những gì backend **chưa có** (đừng tự chế)

| Thứ                        | Trạng thái | Hệ quả cho Mini App |
| -------------------------- | ---------- | ------------------- |
| Refresh token              | ❌ Chưa có | Hết 1 ngày là đăng nhập lại, không có cách khác |
| `GET /auth/me`             | ❌ Chưa có | Lấy thông tin người dùng từ payload token + `GET /teachers/me` |
| Đổi / quên mật khẩu        | ❌ Chưa có | Hướng dẫn liên hệ phòng Nhân sự |
| Đăng xuất phía server      | ❌ Chưa có | Đăng xuất = xoá token ở client |
| **Đăng nhập bằng Zalo**    | ❌ Chưa có | Xem bên dưới |

**Về đăng nhập bằng Zalo:** backend đã có sẵn `ZaloService.getZaloUser(accessToken)`
(gọi `graph.zalo.me/v2.0/me`) nhưng **không controller nào expose nó** — hiện chưa có
endpoint đăng nhập bằng Zalo. Nếu muốn "đăng nhập một chạm" trong Mini App thì cần
backend bổ sung, contract đề xuất:

```jsonc
// POST /auth/zalo   (CHƯA TỒN TẠI — cần backend làm)
// FE gửi access token lấy từ zmp-sdk getAccessToken()
{ "accessToken": "<zalo_access_token>" }

// 200 — trả về đúng shape như /auth/login
{ "access_token": "...", "user": { "id": 42, "name": "...", "roles": ["giaovien"] } }
// 404 nếu zaloUserId chưa được liên kết với nhân viên nào
```

Kèm theo là luồng **liên kết tài khoản lần đầu**: đăng nhập bằng SĐT + mật khẩu một lần,
rồi gọi endpoint lưu `zaloUserId` vào hồ sơ nhân viên. Chừng nào backend chưa có, Mini
App **chỉ dùng SĐT + mật khẩu**.

**Về đăng nhập bằng khuôn mặt:** backend có `POST /face/login` (body `{ descriptor:
number[128] }`, trả cùng shape `{ access_token, user }`, ngưỡng nhận diện 0.82). Web đang
dùng. **Không khuyến nghị đưa vào Mini App**: cần camera + model `face-api` vài MB, vượt
giới hạn dung lượng của Mini App. Chỉ làm nếu được yêu cầu rõ ràng.

### 2.8 Quy tắc bảo mật bắt buộc

- Production **chỉ dùng HTTPS**. Bản `http://160.250.132.143:3011` chỉ để dev.
- Không log token ra console, không đưa token vào URL/query, không gửi sang bên thứ ba.
- Không lưu mật khẩu, kể cả dạng mã hoá, kể cả cho tính năng "ghi nhớ".
- Toạ độ GPS chỉ gửi cho backend của hệ thống, đúng 3 chỗ (check-in, check-out, đăng ký
  tiết) và chỉ tại thời điểm người dùng bấm nút — **không theo dõi nền**.

### 2.9 Xử lý lỗi chung (giữ nguyên hành vi web)

| Mã    | Xử lý                                                                        |
| ----- | ---------------------------------------------------------------------------- |
| `401` | Xoá token (biến + storage) → về màn đăng nhập.                                |
| `403` | Toast "Bạn không có quyền truy cập chức năng này". **Không** hiện thêm toast lỗi khác. |
| `404` | Ở các endpoint `/me` → xem mục 4. Chỗ khác coi như lỗi thường.               |
| `409` | Lỗi nghiệp vụ — **hiện nguyên văn `message` của backend**, đừng viết lại lời. |
| `400` | Validation. `message` có thể là **mảng chuỗi** → hiện từng dòng.             |

---

## 3. Quy ước dữ liệu

| Thứ            | Quy ước                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| Ngày           | `"YYYY-MM-DD"` cả khi gửi lẫn khi nhận. Hiển thị `DD/MM/YYYY`.               |
| Giờ            | Gửi `"HH:mm"`. Backend có thể trả `"HH:mm:ss"` → **luôn cắt 5 ký tự đầu** khi hiển thị hoặc so sánh. |
| `dayOfWeek`    | ⚠️ Thứ Hai = **2** … Thứ Bảy = 7, **Chủ Nhật = 8**. **Không có giá trị 1.**   |
| Phân trang     | `{ data: T[], pagination: { page, limit, total, totalPages } }`              |
| Tiền           | `amount = ratePerPeriod × periods`, do BE tính. `null` = **chưa khai giá**, khác hẳn `0` = dạy không công. |
| Số tiết        | Ưu tiên `periods`; buổi cũ `null` thì quy đổi tạm `Math.round(số phút / 45)`, tối thiểu 1. |
| Toạ độ         | `latitude` / `longitude` số thực, `accuracy` mét (số nguyên, cho phép `null`). |

Trạng thái — dùng đúng chuỗi này, đừng dịch sang enum riêng:

```ts
SessionStatus    = "SCHEDULED" | "PRESENT" | "ABSENT" | "EXCUSED" | "CANCELLED"
AssignmentStatus = "OPEN" | "ASSIGNED" | "CLOSED" | "CANCELLED"
ApplicationStatus= "PENDING" | "SELECTED" | "NOT_SELECTED" | "WITHDRAWN"
```

Nhãn tiếng Việt và màu badge: chép từ `SESSION_STATUS_META`, `ASSIGNMENT_STATUS_META`,
`APPLICATION_STATUS_META` trong `src/types/teaching.ts`.

`status` (chấm công) và `assignmentStatus` (phân công) là **hai trục khác nhau** —
một buổi có thể `ASSIGNED` + `SCHEDULED` (đã phân công, chưa chấm công).

---

## 4. Danh mục endpoint của giáo viên

Tất cả đều yêu cầu role `giaovien` (`/teachers/me` cho thêm các role xem).

| # | Method | Path                                        | Dùng ở màn        |
| - | ------ | ------------------------------------------- | ----------------- |
| 1 | GET    | `/teachers/me`                              | Tiết đang mở, Hồ sơ |
| 2 | GET    | `/teaching-sessions/me`                     | Lịch của tôi, Chấm công |
| 3 | GET    | `/teaching-schedules/me`                    | Lịch của tôi (tab Cố định) |
| 4 | POST   | `/teaching-sessions/:id/checkin`            | Chấm công         |
| 5 | POST   | `/teaching-sessions/:id/checkout`           | Chấm công         |
| 6 | GET    | `/teaching-sessions/open`                   | Tiết đang mở      |
| 7 | POST   | `/teaching-sessions/:id/applications`       | Tiết đang mở      |
| 8 | DELETE | `/teaching-sessions/:id/applications/me`    | Tiết đang mở      |
| 9 | GET    | `/notifications/teaching-schedule`          | Chuông thông báo  |

> **`404` ở nhóm `/me` không phải lỗi.** Nghĩa là tài khoản chưa được Nhân sự gắn với
> hồ sơ giáo viên. Hiện empty state: *"Chưa có hồ sơ giáo viên — Tài khoản của bạn chưa
> được phòng Nhân sự gắn với hồ sơ giáo viên. Vui lòng liên hệ phòng Nhân sự."*
> Tuyệt đối không hiện màn lỗi đỏ hay tự logout.

### 1. `GET /teachers/me` — hồ sơ giáo viên

Trả về object `Teacher`. Mini App chỉ cần: `name`, `phone`, `maxPeriodsPerWeek`
(`null` = không giới hạn), `defaultRatePerPeriod`, `isActive`.

### 2. `GET /teaching-sessions/me` — buổi dạy của tôi

Query: `fromDate`, `toDate`, `page`, `limit` (dùng `limit=200` cho khoảng 1 tháng),
`status`, `unchecked`. **`teacherId` gửi lên bị bỏ qua** — BE lấy từ token.

Trả `Paged<TeachingSession>`. Các field Mini App cần:

```jsonc
{
  "id": 1024,
  "date": "2026-08-12",
  "startTime": "07:30",       // có thể là "07:30:00"
  "endTime": "09:00",
  "periods": 2,
  "schoolName": "TIỂU HỌC THẮNG NHÌ",
  "className": "1A",           // null với dữ liệu cũ → hiện "—"
  "subjectName": "STEM",
  "status": "SCHEDULED",
  "assignmentStatus": "ASSIGNED",
  "isMakeup": false,
  "ratePerPeriod": 150000,
  "amount": 300000,

  "schoolLatitude": 10.762622,   // null = trường chưa gắn toạ độ
  "schoolLongitude": 106.660172,
  "schoolCheckinRadius": 200,    // null = dùng mặc định 200 m

  "checkinAt": null,             // ISO datetime
  "checkinDistance": null,       // mét, BE tính lại
  "checkinOutOfRange": null,     // BE quyết định
  "checkoutAt": null,
  "checkoutDistance": null,
  "checkoutOutOfRange": null
}
```

### 3. `GET /teaching-schedules/me` — mẫu lịch tuần cố định

Query: `isActive=true`, `limit=100`. Trả `Paged<TeachingSchedule>` — lịch **lặp hàng
tuần**, không gắn ngày cụ thể: `dayOfWeek`, `startTime`, `endTime`, `effectiveFrom`,
`effectiveTo` (`null` = không thời hạn).

### 4–5. Check-in / check-out

```http
POST /teaching-sessions/:id/checkin
POST /teaching-sessions/:id/checkout

{ "latitude": 10.762622, "longitude": 106.660172, "accuracy": 25 }
```

Trả về **nguyên buổi dạy đã cập nhật** (`TeachingSession`) — thay thẳng vào danh sách,
đừng gọi lại list.

- `accuracy` optional, gửi `null` được.
- Backend **tự tính lại** `checkinDistance` và `checkinOutOfRange`; giá trị FE tính chỉ
  để hỏi lại người dùng trước khi gửi.
- `403` = không phải giáo viên của buổi này. `409` = đã check-in / chưa check-in mà đòi
  check-out / đã check-out.

### 6. `GET /teaching-sessions/open` — tiết đang mở

Query: `fromDate`, `toDate`, `schoolId`, `subjectId`, `page`, `limit`.
Mặc định của màn: `fromDate = hôm nay`, `toDate = hôm nay + 30 ngày`, `limit = 20`.

Ngoài các field của `TeachingSession`, có thêm:

```jsonc
{
  "applicationCount": 3,            // số giáo viên đã đăng ký
  "hasApplied": true,               // chính mình đã đăng ký chưa
  "myApplicationStatus": "PENDING"  // PENDING | SELECTED | NOT_SELECTED | WITHDRAWN | null
}
```

**Vẫn phải lọc lại ở client**: chỉ giữ `assignmentStatus === "OPEN"` và `date >= hôm nay`.

### 7. `POST /teaching-sessions/:id/applications` — đăng ký nhận tiết

```jsonc
{ "latitude": 10.762622, "longitude": 106.660172, "accuracy": 25, "note": "Nhà gần trường" }
```

**Không gửi `teacherId`** — BE lấy từ token. `note` tối đa 500 ký tự, cho `null`.

```jsonc
// 200
{
  "id": 77, "status": "PENDING",
  "distance": 850,                  // mét, BE tính; null = không xác định được
  "assignedPeriodsInWeek": 6,
  "pendingPeriodsInWeek": 2,
  "maxPeriodsPerWeek": 20,          // null = không giới hạn
  "remainingPeriodsInWeek": 12
}
```

`409` = trùng lịch / đã đăng ký / vượt định mức tuần → hiện nguyên văn `message`.

### 8. `DELETE /teaching-sessions/:id/applications/me` — rút đăng ký

Chỉ rút được khi đơn còn `PENDING`. Trả `204`.

### 9. `GET /notifications/teaching-schedule` — thông báo lịch dạy

Query `page`, `limit`, `tab` (`unread` | `read`). Kèm:
`GET /notifications/teaching-schedule/unread-count`,
`PATCH /notifications/teaching-schedule/read-all`,
`PATCH /notifications/:id/read`.

---

## 5. Ba màn hình

### Màn 1 — Lịch của tôi

```
GET /teaching-sessions/me?fromDate&toDate&limit=200   (theo khoảng đang xem)
GET /teaching-schedules/me?isActive=true&limit=100    (chỉ khi xem lịch ngày/tuần/tháng)
```

Khoảng ngày theo chế độ xem: ngày = chính ngày đó; tuần = Thứ Hai → Chủ Nhật; tháng =
trọn lưới tháng (tính cả ngày bù đầu/cuối tuần).

**Ô "dự kiến" từ mẫu lịch:** vẽ thêm các buổi mà Nhân sự chưa sinh, dựng từ
`/teaching-schedules/me`. Chép nguyên thuật toán `plannedFromSchedules` trong
`src/pages/Teaching/lib.ts`, giữ đủ 3 quy tắc:

1. Chỉ dựng cho **hôm nay trở đi** — ngày đã qua mà không có buổi thật nghĩa là buổi đó
   không diễn ra.
2. Bỏ qua mẫu nếu ngày đó đã có buổi thật (khớp theo `scheduleId`, **và** theo
   `subjectId + date + startTime` để buổi Nhân sự tạo tay không bị vẽ trùng).
3. Ô dự kiến **không bấm vào xem chi tiết được** (id âm, không có trong DB) — phải khác
   màu/nhạt hơn buổi thật và có chú thích.

Bấm vào buổi thật → mở chi tiết, trong đó có nút check-in/check-out và nút báo bận
(mục 8).

### Màn 2 — Chấm công

Hai tab: **Hôm nay** (`fromDate = toDate = hôm nay`) và **Lịch sử** (trọn tháng, có nút
lùi/tiến tháng). Cùng một endpoint `/teaching-sessions/me`.

Luồng bấm nút chấm (chép từ `useSessionCheckin.ts`):

```
1. Lấy GPS hiện tại.
2. accuracy > 100 m  → toast nhắc "Sai số GPS đang lớn (~X m). Ra chỗ thoáng sẽ chính xác hơn."
                       (chỉ cảnh báo, KHÔNG chặn)
3. Trường có toạ độ (schoolLatitude/Longitude khác null)?
   - Tính haversine tới trường, so với schoolCheckinRadius ?? 200 m.
   - Ngoài bán kính → DỪNG LẠI, hỏi xác nhận:
     "Bạn đang cách trường X m, ngoài bán kính cho phép Y m. Vẫn chấm công?
      Buổi này sẽ bị đánh dấu để Nhân sự xem lại."
     → Đồng ý thì mới gửi.
   - Trường chưa có toạ độ → bỏ qua bước so sánh, gửi luôn.
4. POST checkin (chưa check-in) hoặc checkout (đã check-in).
5. Response trả về có checkinOutOfRange/checkoutOutOfRange = true
   → toast "Đã check-in — buổi này được đánh dấu ngoài vùng".
```

Điều kiện hiện nút:

| Tình huống                          | Hiện gì                                        |
| ----------------------------------- | ---------------------------------------------- |
| `status === "CANCELLED"`            | "Buổi đã huỷ — không cần chấm công."           |
| `assignmentStatus !== "ASSIGNED"`   | "Tiết này chưa được phân công nên chưa check-in được." |
| Chưa `checkinAt`                    | Nút **Check-in tại trường**                    |
| Có `checkinAt`, chưa `checkoutAt`   | Nút **Check-out**                              |
| Đã `checkoutAt`                     | "Đã chấm công xong buổi này."                  |

Ghi rõ cho giáo viên: *"Cho phép trong bán kính {radius} m quanh {schoolName}. Đứng
ngoài vẫn chấm được nhưng sẽ bị đánh dấu để Nhân sự xem lại."* — hoặc *"Trường chưa gắn
toạ độ nên hệ thống chỉ ghi nhận vị trí, chưa kiểm tra khoảng cách."*

Tab Lịch sử hiện 3 số: đã check-in / thiếu check-out / ngoài vùng, kèm câu chốt:
*"Trạng thái công (Có dạy / Vắng / Huỷ) do phòng Nhân sự chốt sau buổi dạy."*
Giáo viên **không** tự chấm trạng thái công.

### Màn 3 — Tiết đang mở

```
GET /teaching-sessions/open?fromDate&toDate&page&limit=20
GET /teachers/me                                   (lấy maxPeriodsPerWeek)
GET /teaching-sessions/me?fromDate&toDate&limit=200 (để cảnh báo trùng giờ)
```

Chặn ở client **trước khi** gửi (BE vẫn kiểm lại, đây chỉ để đỡ bấm nhầm):

- **Trùng giờ**: có buổi `ASSIGNED` cùng `date` và khoảng giờ giao nhau
  (chạm biên không tính là trùng: 07:30–09:00 và 09:00–10:30 là hợp lệ).
- **Vượt định mức**: `remainingPeriodsInWeek < số tiết của buổi` (lấy từ lần đăng ký
  gần nhất; chưa có thì không chặn).

Trạng thái nút theo `myApplicationStatus`:

| Giá trị                    | Hiện gì                                          |
| -------------------------- | ------------------------------------------------ |
| `null` / chưa đăng ký      | Nút **Đăng ký dạy**                              |
| `PENDING`                  | Nút **Rút đăng ký**                              |
| `SELECTED`                 | "Bạn đã được phân công tiết này — xem trong Lịch của tôi." |
| `NOT_SELECTED`/`WITHDRAWN` | "Tiết này đã có kết quả phân công."               |

Trước khi gửi phải nói rõ với người dùng: *"Khi gửi, app lấy vị trí hiện tại của bạn để
Nhân sự xếp giáo viên gần trường nhất. Vị trí chỉ lấy một lần tại thời điểm đăng ký."*

---

## 6. Lấy GPS trên Zalo Mini App

Đây là điểm khác lớn nhất so với web. Web dùng `navigator.geolocation` — trong webview
Zalo **không dùng được cách này**, phải qua `getLocation` của `zmp-sdk`.

Yêu cầu bắt buộc:

1. Bọc thành **một hàm duy nhất** `getCurrentPosition(): Promise<{ latitude, longitude, accuracy }>`
   để 3 chỗ gọi (check-in, check-out, đăng ký tiết) không phải biết nó lấy từ đâu.
2. **Kiểm chứng `getLocation` trả gì trên tài khoản Mini App thật trước khi code tiếp**:
   tuỳ quyền đã được duyệt, nó có thể trả thẳng toạ độ, hoặc trả một **token** phải nhờ
   server đổi lấy toạ độ qua API của Zalo. Nếu rơi vào trường hợp token thì **báo lại
   ngay** — khi đó cần thêm một endpoint backend để đổi token, không tự chế.
3. Zalo có thể **không trả `accuracy`** → gửi `accuracy: null` (API cho phép), và bỏ
   qua bước cảnh báo sai số. Đừng bịa số 0 vì 0 nghĩa là "chính xác tuyệt đối".
4. Xin quyền vị trí đúng lúc **người dùng bấm nút**, không xin lúc mở app.
5. Người dùng từ chối quyền → thông báo tiếng Việt rõ ràng, có đường dẫn bật lại trong
   cài đặt Zalo. Không được im lặng nuốt lỗi.

Hàm tính khoảng cách haversine và `formatDistance` chép nguyên từ `src/utils/geo.ts` —
đơn vị mét, làm tròn số nguyên; hiển thị `< 1000 m` thì "850 m", trên nữa thì "1.25 km".

---

## 7. Những chỗ khác của web phải bỏ đi

| Web hiện tại                        | Mini App                                       |
| ----------------------------------- | ---------------------------------------------- |
| `localStorage` (đồng bộ)            | `zmp-sdk` storage (bất đồng bộ) — xem mục 2    |
| `window.location.href = '/login'`   | Điều hướng bằng router của `zmp-ui`            |
| `navigator.geolocation`             | `getLocation` của `zmp-sdk` — xem mục 6        |
| `<input type="date">`               | Date picker của `zmp-ui`                       |
| Firebase Web Push (FCM)             | Zalo Notification — xem mục 8                  |
| `react-hot-toast`                   | Snackbar của `zmp-ui`                          |
| Layout desktop (`md:` breakpoints)  | Chỉ mobile, một cột                            |

---

## 8. ⚠️ Hai chỗ backend chưa có

Kiểm tra lại trước khi làm; nếu vẫn chưa có thì **ẩn tính năng**, không gọi rồi bắt lỗi
404 cho qua chuyện.

### a. Báo bận / xin người dạy thay

Web đã có UI và đã gọi `POST /teaching-sessions/:id/decline` với body `{ reason }`,
nhưng **backend chưa cài endpoint này** (spec nằm ở `TEACHER-DECLINE-SESSION-BE-PROMPT.md`).

Nếu đến lúc bạn làm mà BE đã có, giữ đúng điều kiện hiện nút:

```
assignmentStatus === "ASSIGNED"
&& status === "SCHEDULED"
&& !checkinAt
&& !declinedAt
&& date >= hôm nay
&& lý do >= 5 ký tự (tối đa 500)
```

### b. Push thông báo

Web đăng ký FCM qua `POST /employee-fcm-token/save { token }`. Zalo Mini App **không
dùng FCM** — phải đi qua Zalo Notification/OA, cần backend bổ sung endpoint lưu
`zaloUserId` và luồng gửi tương ứng. Trong lúc chờ: chỉ hiển thị thông báo trong app
bằng `GET /notifications/teaching-schedule` + badge từ `.../unread-count`.

---

## 9. Checklist nghiệm thu

- [ ] Đăng nhập bằng SĐT + mật khẩu, token lưu qua storage của `zmp-sdk`, mở lại app không phải đăng nhập lại.
- [ ] Token hết hạn (1 ngày) hoặc bị `401`: về màn đăng nhập kèm thông báo "phiên đã hết hạn", **không** mất nội dung đang nhập dở.
- [ ] Đăng xuất xoá token ở cả biến lẫn storage; mở lại app phải đăng nhập lại.
- [ ] Tài khoản không có role `giaovien` bị chặn ngay, kèm thông báo rõ ràng.
- [ ] Tài khoản chưa gắn hồ sơ giáo viên (404 ở `/me`) → empty state, không phải màn lỗi.
- [ ] Lịch ngày / tuần / tháng đúng khoảng ngày, ô "dự kiến" từ mẫu lịch không trùng buổi thật và không bấm được.
- [ ] Check-in trong bán kính: gửi thẳng. Ngoài bán kính: hỏi lại, đồng ý mới gửi, kết quả hiện "ngoài vùng".
- [ ] Check-out chỉ hiện sau khi đã check-in; đã check-out thì không còn nút.
- [ ] Buổi `CANCELLED` và tiết chưa phân công: không có nút chấm công.
- [ ] Đăng ký tiết gửi kèm GPS; trùng giờ / vượt định mức bị chặn trước, 409 từ BE hiện nguyên văn.
- [ ] Rút đăng ký chỉ hiện khi `myApplicationStatus === "PENDING"`.
- [ ] `dayOfWeek` hiển thị đúng (Chủ Nhật = 8), giờ `"07:30:00"` hiển thị thành `07:30`.
- [ ] Tiền: `null` hiện "Chưa khai giá", `0` hiện "0 ₫" — không gộp làm một.
- [ ] Mất mạng giữa chừng: báo lỗi rõ, không mất dữ liệu đang nhập, bấm lại được.
