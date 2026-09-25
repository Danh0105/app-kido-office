# Backend Update — Thư viện ảnh báo giảng

## Hiện trạng

Ảnh báo giảng đang nằm trong `teaching_sessions.lessonImages` và chỉ được tải
kèm danh sách buổi dạy. Cách này không thể dùng làm thư viện khi có hàng nghìn
ảnh: không phân trang theo ảnh, không lọc theo khu vực chính xác và dễ N+1.

## API mới

`GET /teaching-sessions/lesson-images` (JWT, backend bắt buộc kiểm tra phạm vi)

Query: `provinceId`, `schoolId`, `schoolLocationId`, `teacherId`, `fromDate`,
`toDate`, `status`, `search`, `page`, `limit` (1–30), `sortBy` (`createdAt`),
`sortOrder` (`DESC` mặc định).

Response:

```json
{
  "data": [{
    "id": 123,
    "thumbnailUrl": "/uploads/thumb/a.jpg",
    "url": "/uploads/a.jpg",
    "createdAt": "2026-09-09T08:00:00Z",
    "session": {
      "id": 88, "date": "2026-09-09", "startTime": "07:00",
      "endTime": "07:40", "status": "PRESENT",
      "teacherId": 17, "teacherName": "Nguyễn A",
      "schoolId": 12, "schoolName": "Trường B", "className": "3A"
    }
  }],
  "pagination": { "page": 1, "limit": 30, "total": 5000, "totalPages": 167 },
  "stats": { "images": 5000, "teachers": 120, "schools": 67 }
}
```

Không trả base64. Danh sách chỉ trả thumbnail; URL gốc chỉ dùng khi mở viewer.
Join teacher/class/school/ward trong một query chọn cột tối thiểu; index các
khóa `lesson_image.session_id`, `teaching_sessions.teacher_id`, `school_id`,
`date`, `created_at`. Không thay đổi dữ liệu ảnh cũ.

## Phân quyền

Backend áp phạm vi theo user: admin xem tất cả, quản lý khu vực chỉ khu vực của
mình, quản lý trường chỉ trường được phân công; không tin filter do frontend.
Trả 403 hoặc tập rỗng khi user cố truy cập ngoài phạm vi.
