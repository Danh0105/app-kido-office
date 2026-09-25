# Backend Update — lưu dữ liệu cũ/mới cho Nhật ký thao tác

## Vấn đề

`GET /activity-logs` hiện trả log sửa chỉ có `body` (payload mới). Ví dụ cập
nhật bảng tiết của trường chỉ có danh sách giờ mới. Không có dữ liệu trước khi
sửa nên frontend không thể hiển thị cột **Dữ liệu cũ**.

## Yêu cầu

Với mọi request thành công dùng `PATCH`, `PUT`, `DELETE` (và endpoint cập nhật
đặc thù), lưu và trả kèm ba field sau trong mỗi activity log:

```ts
beforeData?: Record<string, unknown> | null;
afterData?: Record<string, unknown> | null;
changes?: Array<{
  field: string;
  before: unknown;
  after: unknown;
}>;
```

Ví dụ response `GET /activity-logs`:

```json
{
  "method": "PATCH",
  "path": "/schools/365/periods",
  "body": { "periods": [{ "periodNo": 1, "startTime": "07:15" }] },
  "beforeData": {
    "periods": [{ "periodNo": 1, "startTime": "07:00" }]
  },
  "afterData": {
    "periods": [{ "periodNo": 1, "startTime": "07:15" }]
  },
  "changes": [{
    "field": "periods",
    "before": [{ "periodNo": 1, "startTime": "07:00" }],
    "after": [{ "periodNo": 1, "startTime": "07:15" }]
  }]
}
```

## Cách thực hiện

1. Trong interceptor/middleware audit, lấy bản ghi trước khi gọi handler cập
   nhật và sao chép sâu (`beforeData`).
2. Sau khi lưu thành công, đọc lại bản ghi đã lưu (`afterData`). Không dùng
   trực tiếp `req.body`, vì payload có thể bị backend chuẩn hoá hoặc bổ sung
   giá trị mặc định.
3. So sánh hai snapshot để tạo `changes`; chỉ giữ field thực sự thay đổi.
4. Loại khỏi snapshot/changes các field kỹ thuật hoặc nhạy cảm: mật khẩu,
   refresh token, token Zalo, `createdAt`, `updatedAt`, `deletedAt`.
5. Với update dạng mảng (bảng tiết, bulk update), lưu cả mảng trước/sau; không
   chỉ lưu số lượng phần tử.
6. Việc lưu log phải cùng transaction với cập nhật chính, hoặc chỉ ghi log khi
   cập nhật đã thành công.

### Bắt buộc với xoá lịch dạy

Với `DELETE /teaching-schedules/:id`, đọc đầy đủ lịch dạy **trước khi xoá**,
bao gồm quan hệ/tên `schoolName`, `className`, `subjectName`, `teacherName` và
thời gian. Lưu vào `beforeData` và `context`, rồi mới xoá bản ghi. Ví dụ:

```json
{
  "beforeData": {
    "schoolId": 448,
    "schoolName": "Trường Tiểu học A",
    "className": "8/1",
    "subjectName": "Tiếng Anh",
    "teacherName": "Nguyễn Ngọc Phương Nghi",
    "dayOfWeek": 2,
    "startTime": "09:15",
    "endTime": "10:00"
  },
  "context": {
    "schoolName": "Trường Tiểu học A",
    "className": "8/1",
    "subjectName": "Tiếng Anh",
    "teacherName": "Nguyễn Ngọc Phương Nghi",
    "startTime": "09:15",
    "endTime": "10:00"
  }
}
```

### Bắt buộc với thêm nhiều lịch dạy

Với `POST /teaching-schedules/bulk`, từng phần tử trong `schedules` phải chốt
đủ thông tin dưới đây, không chỉ `dayOfWeek` và giờ:

```json
{
  "schoolId": 448,
  "schoolName": "Trường Tiểu học A",
  "classId": 81,
  "className": "8/1",
  "subjectId": 886,
  "subjectName": "Tiếng Anh",
  "teacherId": 17,
  "teacherName": "Nguyễn Ngọc Phương Nghi",
  "dayOfWeek": 6,
  "startTime": "14:10",
  "endTime": "14:45",
  "periods": 1
}
```

Như vậy một dòng lịch trong Nhật ký mới đọc được ngay: trường nào, lớp nào,
môn gì, giáo viên nào, thứ và tiết nào.

## Tương thích

- Log cũ không thể khôi phục dữ liệu trước đó; trả `null`/bỏ field là đúng.
- Frontend đã hỗ trợ cả `changes` và tự đối chiếu `beforeData`/`afterData` nếu
  `changes` trống. Sau khi backend triển khai, **các log mới tạo** sẽ hiện bảng
  Dữ liệu cũ / Dữ liệu mới trong tab Nhật ký.

## Bộ lọc Nhật ký theo trường và giáo viên

`GET /activity-logs` cần nhận hai query tuỳ chọn:

```text
?schoolId=448&teacherId=17
```

- `schoolId`: chỉ trả các log có `context.schoolId` hoặc dữ liệu lịch/lớp liên
  quan thuộc trường này.
- `teacherId`: chỉ trả các log có `context.teacherId` hoặc dữ liệu lịch liên
  quan tới giáo viên này.
- Hai điều kiện áp dụng đồng thời khi cùng được gửi; vẫn phân trang và trả
  `total` sau lọc.

Khi ghi log lịch dạy, cần lưu cả `schoolId` và `teacherId` vào `context` (cùng
với tên) để bộ lọc chính xác, kể cả sau khi lớp hoặc giáo viên được đổi tên.
