# Backend Update — Mở tiết dạy cho giáo viên đăng ký

## Lỗi đang chặn

Nhân sự tạo tiết **không chọn giáo viên** → backend trả:

```text
teacherId must be an integer number
```

`CreateTeachingSessionDto.teacherId` đang bắt buộc là số nguyên. Với tiết đang mở thì
**chưa có giáo viên**, nên FE không gửi field này. Backend phải cho phép thiếu/`null`.

```ts
// CreateTeachingSessionDto / UpdateTeachingSessionDto
@IsOptional()
@IsInt()
teacherId?: number | null;

@IsOptional()
@IsIn(["OPEN", "ASSIGNED", "CLOSED", "CANCELLED"])
assignmentStatus?: AssignmentStatus;
```

Quy tắc:

- Không có `teacherId` → bắt buộc `assignmentStatus = "OPEN"` (hoặc BE tự set).
- Có `teacherId` → `assignmentStatus = "ASSIGNED"`.
- Gửi `teacherId: null` khi sửa = **gỡ phân công**, chuyển tiết về `OPEN`.

FE đang gửi đúng payload này:

```jsonc
// Mở tiết cho giáo viên đăng ký — KHÔNG có key teacherId
{
  "assignmentStatus": "OPEN",
  "schoolId": 12,
  "subjectId": 5,
  "date": "2026-08-12",
  "startTime": "07:30",
  "endTime": "09:00",
  "periods": 2,
  "note": null
}

// Phân công thẳng
{
  "teacherId": 8,
  "assignmentStatus": "ASSIGNED",
  ...
}
```

---

## 1. Cột / bảng cần có

### `teaching_sessions`

| Cột                | Kiểu      | Null | Ghi chú                                     |
| ------------------ | --------- | ---- | ------------------------------------------- |
| `teacherId`        | `int` FK  | ✅   | **Đổi thành nullable** — null = đang tuyển   |
| `assignmentStatus` | `enum`    | ❌   | `OPEN` / `ASSIGNED` / `CLOSED` / `CANCELLED` |
| `periods`          | `int`     | ✅   | Số tiết, `1…20`                              |

`applicationCount` không cần cột riêng — đếm từ bảng đơn đăng ký và trả kèm trong response.

### `teachers`

| Cột                 | Kiểu  | Null | Ghi chú                          |
| ------------------- | ----- | ---- | -------------------------------- |
| `maxPeriodsPerWeek` | `int` | ✅   | `1…100`; null = không giới hạn    |

### `teaching_applications` (mới)

| Cột          | Kiểu        | Ghi chú                                                |
| ------------ | ----------- | ------------------------------------------------------ |
| `id`         | `int` PK    |                                                        |
| `sessionId`  | `int` FK    | unique cùng `teacherId` — mỗi giáo viên 1 đơn/tiết      |
| `teacherId`  | `int` FK    | lấy từ JWT, **không nhận từ client**                    |
| `status`     | `enum`      | `PENDING` / `SELECTED` / `NOT_SELECTED` / `WITHDRAWN`   |
| `latitude`   | `decimal(10,7)` | Toạ độ lúc đăng ký                                 |
| `longitude`  | `decimal(10,7)` |                                                    |
| `accuracy`   | `int`       | Sai số GPS (mét), nullable                             |
| `distance`   | `int`       | **BE tự tính** khoảng cách tới trường (haversine)        |
| `appliedAt`  | `timestamp` |                                                        |
| `note`       | `varchar(500)` | nullable                                            |

---

## 2. Endpoint

### `GET /teaching-sessions/open`

Query: `fromDate`, `toDate`, `schoolId`, `subjectId`, `page`, `limit`.

Trả `Paged<TeachingSession>` gồm các tiết `assignmentStatus = "OPEN"`, kèm:

```json
{
  "assignmentStatus": "OPEN",
  "applicationCount": 4,
  "hasApplied": true,
  "myApplicationStatus": "PENDING"
}
```

`hasApplied` / `myApplicationStatus` tính theo giáo viên trong JWT.

**Nên trả kèm** định mức tuần của giáo viên đăng nhập (FE hiện đang chỉ biết sau lần đăng ký
đầu tiên): `assignedPeriodsInWeek`, `pendingPeriodsInWeek`, `remainingPeriodsInWeek`.

### `POST /teaching-sessions/:id/applications`

```json
{ "latitude": 10.762622, "longitude": 106.660172, "accuracy": 15, "note": null }
```

- `teacherId` lấy từ JWT — **bỏ qua nếu client gửi lên**.
- Tính `distance` bằng haversine tới toạ độ trường (R = `6371000 m`); trường chưa gắn toạ độ
  → `distance = null`.
- Chặn `409` với message hiển thị trực tiếp cho người dùng:
  - `"Tiết dạy bị trùng với lịch đã được phân công"`
  - `"Vượt quá số tiết tối đa trong tuần"`
  - `"Bạn đã đăng ký tiết này"`
- Định mức tuần = `tiết đã phân công + tiết đang chờ duyệt + tiết của đơn mới`,
  tính theo tuần chứa `session.date` (Thứ Hai → Chủ Nhật).
- Trả về:

```json
{
  "id": 42,
  "status": "PENDING",
  "distance": 1840,
  "assignedPeriodsInWeek": 10,
  "pendingPeriodsInWeek": 2,
  "maxPeriodsPerWeek": 20,
  "remainingPeriodsInWeek": 8
}
```

### `DELETE /teaching-sessions/:id/applications/me`

- Chỉ rút được khi đơn còn `PENDING` → khác thì `409`.
- Đơn chuyển `WITHDRAWN` (giữ lịch sử, không xoá cứng).

### `GET /teaching-sessions/:id/suggestions`

Chỉ `nhansu` (và các role xem) được gọi. Trả mảng `TeachingApplication` **đã xếp hạng**,
kèm `suggestionRank` bắt đầu từ 1 và các số liệu:

```json
{
  "assignedPeriodsInWeek": 12,
  "pendingPeriodsInWeek": 2,
  "maxPeriodsPerWeek": 20,
  "remainingPeriodsInWeek": 6,
  "hasScheduleConflict": false
}
```

Gợi ý thứ tự xếp hạng: không trùng lịch → còn định mức → khoảng cách gần → đăng ký sớm.

FE **không tự sắp xếp lại**, chỉ tô màu: đỏ khi trùng lịch hoặc vượt định mức, vàng khi
thiếu khoảng cách hoặc GPS sai số > 100 m.

> Thiếu để FE hiện đúng cảnh báo *"hồ sơ giáo viên ngừng hoạt động"*: cần thêm
> `teacherIsActive: boolean` vào mỗi phần tử.

### `PATCH /teaching-sessions/:id/assign`

```json
{ "teacherId": 8, "override": false }
```

- Trùng lịch / vượt định mức → `409`:

```json
{ "message": "Giáo viên vượt quá số tiết tối đa trong tuần", "requiresOverride": true }
```

FE mở modal xác nhận rồi gửi lại `override: true`.

- Thành công: session → `ASSIGNED` + `teacherId`; đơn của người được chọn → `SELECTED`;
  các đơn `PENDING` còn lại → `NOT_SELECTED`. Trả về **session đã cập nhật**.
- Đổi giáo viên dùng lại chính endpoint này.

---

## 3. Ràng buộc bảo mật

- Không tin `latitude`/`longitude` client gửi để kết luận — BE tự tính `distance` và tự
  quyết định hợp lệ. Toạ độ có thể bị giả mạo.
- Chỉ role `nhansu` xem được toạ độ đăng ký của giáo viên; API dành cho giáo viên không
  trả toạ độ của người khác.
- Giáo viên chỉ check-in/check-out được trên session `ASSIGNED` có `teacherId` là chính mình
  (xem `SCHOOL-LOCATION-BE-PROMPT.md` mục 4).
