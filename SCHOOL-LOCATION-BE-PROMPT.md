# Backend Update — Vị trí trường học (phục vụ check-in theo vị trí)

## Overview

Frontend đã bổ sung 2 chỗ gắn toạ độ cho trường:

- **Nhân sự** — màn riêng `Giảng dạy → Vị trí trường` (`/nhan-su/vi-tri-truong`):
  danh sách toàn bộ trường, lọc "chưa gắn vị trí", bấm từng trường để đặt toạ độ.
  Lưu bằng `PUT /schools/:id` với **toàn bộ bản ghi cũ + phần vị trí mới**
  (vì `PUT` đang là ghi đè). Nếu BE muốn gọn hơn thì mở thêm
  `PATCH /schools/:id/location` — FE sẽ chuyển sang dùng.
- **Sales** — form tạo/sửa trường sẵn có (`Nhân viên → Danh sách trường → Sửa`).

Cả 2 chỗ đặt vị trí bằng **link chia sẻ Google Maps** (hoặc nút "Lấy vị trí hiện tại"),
kèm bán kính cho phép check-in. Giao diện **không hiển thị và không cho nhập toạ độ** —
toạ độ chỉ là dữ liệu bên dưới.

Backend cần thêm 4 cột vào bảng `schools`, nhận chúng trong payload create/update và
trả ra trong mọi response của `/schools`.

---

## 1. Cột mới trên bảng `schools`

| Cột              | Kiểu             | Null | Ghi chú                                              |
| ---------------- | ---------------- | ---- | ---------------------------------------------------- |
| `latitude`       | `decimal(10, 7)` | ✅   | Vĩ độ, miền hợp lệ `-90 … 90`                         |
| `longitude`      | `decimal(10, 7)` | ✅   | Kinh độ, miền hợp lệ `-180 … 180`                     |
| `checkinRadius`  | `int`            | ✅   | Bán kính cho phép check-in, đơn vị **mét**, `20…2000` |
| `googleMapsUrl`  | `varchar(500)`   | ✅   | **MỚI** — link chia sẻ Google Maps đã dùng để đặt vị trí |

Ghi chú:

- `decimal(10,7)` giữ đủ 7 số lẻ (~1cm), **không dùng `float`** để tránh sai số khi so sánh.
- Trường chưa gắn vị trí → cả 4 cột `null`. Đây là trạng thái hợp lệ, không phải lỗi.
- `checkinRadius` để trống khi có toạ độ → FE gửi mặc định `200`.

### Vì sao cần `googleMapsUrl`

Giao diện **không hiển thị toạ độ** nữa — người dùng chỉ thao tác bằng link chia sẻ.
Cột này để:

1. Đánh dấu **"Đã đặt vị trí"** chỉ cho trường được gắn bằng link Google Maps.
   Trường có toạ độ nhưng không có link (đặt bằng nút "Lấy vị trí hiện tại", hoặc dữ liệu cũ)
   sẽ hiện nhãn **"Chưa có link Maps"** để nhắc bổ sung.
2. Nút "Xem trên Google Maps" mở **đúng địa điểm gốc** người dùng đã chọn, thay vì
   link `?q=lat,lng` dựng lại (chỉ ra một điểm trên bản đồ, không có tên/thông tin địa điểm).

Yêu cầu:

- Validate: nếu có giá trị thì phải là URL HTTPS thuộc đúng danh sách host ở mục 3b,
  độ dài ≤ 500. Sai → `400 "Chỉ hỗ trợ link chia sẻ Google Maps"`.
- **Xoá vị trí** (`latitude: null`) phải xoá luôn `googleMapsUrl`.
- Gửi `googleMapsUrl: null` khi vẫn có toạ độ = chỉ gỡ link, giữ toạ độ — hợp lệ.
- Trả về trong **mọi** response của `/schools` (như 3 cột kia).

---

## 2. Payload create / update

**Endpoint:** `POST /schools`, `PUT /schools/:id`

```json
{
  "name": "Trường Tiểu học ABC",
  "address": "12 Nguyễn Huệ, Quận 1",
  "latitude": 10.762622,      // <-- MỚI (number | null)
  "longitude": 106.660172,    // <-- MỚI (number | null)
  "checkinRadius": 200,       // <-- MỚI (number | null, mét)
  "googleMapsUrl": "https://maps.app.goo.gl/abc123"  // <-- MỚI (string | null)
}
```

### Backend TODO

- Thêm 4 cột vào entity `School` + migration.
- Cập nhật Create/Update DTO:
  - `latitude`: `@IsOptional() @IsNumber() @Min(-90) @Max(90)`, cho phép `null`.
  - `longitude`: `@IsOptional() @IsNumber() @Min(-180) @Max(180)`, cho phép `null`.
  - `checkinRadius`: `@IsOptional() @IsInt() @Min(20) @Max(2000)`, cho phép `null`.
- Ràng buộc chéo: **có `latitude` thì phải có `longitude`** và ngược lại.
  Nếu chỉ gửi 1 trong 2 → trả `400` với message
  `"Cần đủ cả vĩ độ và kinh độ"`.
- Gửi `null` cho `latitude`/`longitude` = **xoá vị trí** của trường
  (kèm `checkinRadius = null` và `googleMapsUrl = null`).
- `googleMapsUrl`: `@IsOptional() @IsUrl() @MaxLength(500)`, cho phép `null`.

---

## 3. Response

Cả 4 cột phải có mặt trong response của **tất cả** endpoint trả về school, đặc biệt:

- `GET /schools` (có phân trang — module Giảng dạy dùng `?page=1&limit=1000`)
- `GET /schools/by-employee-ward`
- `GET /schools/employee-region/:id`
- `GET /schools/search/:keyword`
- `POST /schools`, `PUT /schools/:id`

```json
{
  "id": 12,
  "name": "Trường Tiểu học ABC",
  "address": "12 Nguyễn Huệ, Quận 1",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "checkinRadius": 200,
  "googleMapsUrl": "https://maps.app.goo.gl/abc123"
}
```

Kiểu trả về là **number**, không phải string (nhiều ORM trả `decimal` dưới dạng string —
nhớ transform, ví dụ `@Transform(({ value }) => (value === null ? null : Number(value)))`).

---

## 3b. Endpoint đọc toạ độ từ link Google Maps

**`POST /schools/resolve-google-maps`**

Người dùng mở Google Maps → *Chia sẻ → Sao chép liên kết* → dán vào form. Link rút gọn
(`https://maps.app.goo.gl/xxxx`) **không chứa toạ độ**, phải đi theo redirect mới ra link đầy đủ —
trình duyệt bị CORS chặn nên phải nhờ backend.

Request / Response:

```json
// POST body
{ "url": "https://maps.app.goo.gl/abc123" }

// 200
{ "latitude": 10.762622, "longitude": 106.660172 }
```

> ✅ Backend đã làm xong mục này. Host được chấp nhận: `maps.app.goo.gl`, `goo.gl`,
> `maps.google.com`, `www.google.com`, `google.com`. Các message lỗi
> (`Link Google Maps không hợp lệ`, `Chỉ hỗ trợ link chia sẻ Google Maps`,
> `Không mở được link chia sẻ Google Maps`, `Không tìm thấy tọa độ trong link Google Maps`)
> được FE hiển thị **nguyên văn**. FE dùng đúng danh sách host này để chặn sớm.

Xử lý:

1. Chỉ chấp nhận host của Google Maps (danh sách trên). Host khác → `400`.
   ⚠️ Đây là điểm **SSRF**: tuyệt đối không fetch URL tuỳ ý người dùng gửi lên.
2. Gọi `GET` với `followRedirect` (tối đa ~5 lần), timeout ~5s, lấy URL cuối cùng.
3. Trích toạ độ từ URL cuối theo thứ tự ưu tiên (giống FE, xem `parseLatLng`
   trong `src/utils/geo.ts`):
   - `!3d<lat>!4d<lng>` — ghim chính xác của địa điểm
   - `?q=` / `?query=` / `&ll=` / `&center=` dạng `lat,lng`
   - `/place/<lat>,<lng>`
   - `@<lat>,<lng>` — chỉ là tâm khung nhìn, dùng cuối cùng
4. Không tìm được toạ độ → `400` với message
   `"Không đọc được vị trí từ link Google Maps"`.
5. Trả `latitude`/`longitude` kiểu **number**.

FE chỉ gọi endpoint này khi link **không tự đọc được** (tức link rút gọn) — link đầy đủ
đã được parse ngay trên máy, không tốn request.

---

## 4. Check-in của giáo viên tại buổi dạy

FE đã làm màn chấm vị trí: giáo viên mở buổi dạy trong "Lịch dạy của tôi" → bấm
**Check-in tại trường**, dạy xong bấm **Check-out** → app lấy GPS, so với toạ độ trường
và gọi API bên dưới. Màn còn có tab **Tổng hợp** cộng số tiết đã dạy theo tháng.

### 4.1. Cột mới trên bảng `teaching_sessions`

| Cột                  | Kiểu             | Null | Ghi chú                                       |
| -------------------- | ---------------- | ---- | --------------------------------------------- |
| `periods`            | `int`            | ✅   | **MỚI** — số tiết của buổi dạy, `1…20`          |
| `checkinAt`          | `timestamp`      | ✅   | Thời điểm check-in (BE tự set `now()`)         |
| `checkinLatitude`    | `decimal(10, 7)` | ✅   | Toạ độ client gửi lên                          |
| `checkinLongitude`   | `decimal(10, 7)` | ✅   | Toạ độ client gửi lên                          |
| `checkinAccuracy`    | `int`            | ✅   | Sai số GPS thiết bị báo (mét)                  |
| `checkinDistance`    | `int`            | ✅   | Khoảng cách tới trường, **BE tự tính**         |
| `checkinOutOfRange`  | `boolean`        | ✅   | `true` nếu `checkinDistance > bán kính`        |
| `checkoutAt`         | `timestamp`      | ✅   | **MỚI** — thời điểm check-out                   |
| `checkoutLatitude`   | `decimal(10, 7)` | ✅   | **MỚI**                                        |
| `checkoutLongitude`  | `decimal(10, 7)` | ✅   | **MỚI**                                        |
| `checkoutAccuracy`   | `int`            | ✅   | **MỚI**                                        |
| `checkoutDistance`   | `int`            | ✅   | **MỚI** — BE tự tính                            |
| `checkoutOutOfRange` | `boolean`        | ✅   | **MỚI**                                        |

Bảng `teaching_schedules` cũng cần cột `periods` (`int`, null, `1…20`) — mẫu lịch khai báo
số tiết, khi **sinh buổi dạy** thì copy sang `teaching_sessions.periods`.

#### Số tiết (`periods`)

- Nhân sự nhập ở form **Mẫu lịch tuần** và **Thêm buổi lẻ** (mặc định `1`), gửi trong
  `SchedulePayload` / `SessionPayload`: `periods: number` (nguyên, `1…20`).
- Đây là **căn cứ tính công dạy** — màn "Lịch dạy của tôi → Tổng hợp" của giáo viên cộng
  `periods` của các buổi trạng thái `PRESENT`.
- Buổi cũ chưa có `periods` → FE tạm quy đổi 45 phút/tiết theo khung giờ và hiện cảnh báo
  "chưa khai báo số tiết". Nên **backfill** `periods` cho dữ liệu cũ.

### 4.2. Endpoint mới

**`POST /teaching-sessions/:id/checkin`** và **`POST /teaching-sessions/:id/checkout`**

Hai endpoint dùng **chung request body và chung quy tắc vị trí**; chỉ khác cột được ghi
và điều kiện thứ tự.

Request:

```json
{
  "latitude": 10.762622,
  "longitude": 106.660172,
  "accuracy": 12
}
```

Xử lý:

1. Chỉ **giáo viên của chính buổi đó** được chấm → sai thì `403`.
2. `checkin`: buổi đã có `checkinAt` → `409` (`"Buổi này đã check-in"`).
   `checkout`: chưa có `checkinAt` → `409` (`"Chưa check-in"`);
   đã có `checkoutAt` → `409` (`"Buổi này đã check-out"`).
3. Chỉ cho chấm **trong ngày dạy** (`session.date === hôm nay`) → sai thì `400`.
4. Lấy `latitude`/`longitude`/`checkinRadius` của trường thuộc buổi dạy:
   - Trường **chưa gắn toạ độ** → `checkinDistance = null`, `checkinOutOfRange = false`,
     vẫn cho check-in (chỉ ghi nhận vị trí).
   - Có toạ độ → **BE tự tính lại** khoảng cách (haversine, R = `6371000 m`),
     `checkinOutOfRange = distance > (checkinRadius ?? 200)`.
5. **Ngoài bán kính vẫn ghi nhận check-in**, chỉ bật cờ `checkinOutOfRange` để Nhân sự
   xem lại — đây là quyết định nghiệp vụ đã chốt, đừng chặn.
6. Trả về **bản ghi buổi dạy đã cập nhật** (đúng shape `TeachingSession` hiện có).

⚠️ Toạ độ client gửi lên **luôn có thể bị giả mạo** (fake GPS). Việc so khoảng cách ở FE chỉ để
báo trước cho người dùng; con số cuối cùng phải do BE tính.

### 4.3. Trả kèm vị trí trường trong response buổi dạy

Để app tính được khoảng cách **trước khi** gửi check-in, mọi response trả `TeachingSession`
(`GET /teaching-sessions`, `GET /teaching-sessions/me`, `GET /teaching-sessions/:id`,
`POST`, `PATCH`, `.../attendance`, `.../checkin`) phải kèm:

```json
{
  "schoolLatitude": 10.762622,
  "schoolLongitude": 106.660172,
  "schoolCheckinRadius": 200,

  "checkinAt": "2026-08-05T07:28:00.000Z",
  "checkinLatitude": 10.762701,
  "checkinLongitude": 106.6609,
  "checkinAccuracy": 12,
  "checkinDistance": 84,
  "checkinOutOfRange": false,

  "periods": 2,
  "checkoutAt": "2026-08-05T09:05:00.000Z",
  "checkoutLatitude": 10.762698,
  "checkoutLongitude": 106.660905,
  "checkoutAccuracy": 15,
  "checkoutDistance": 92,
  "checkoutOutOfRange": false
}
```

Buổi chưa check-in / check-out → các trường `checkin*` / `checkout*` trả `null`
(riêng `*OutOfRange` trả `false` hoặc `null` đều được, FE xử lý cả hai).
