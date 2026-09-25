# Backend Prompt — Phân trang thư viện ảnh báo giảng

## Mục tiêu

Xây dựng API phân trang **theo từng ảnh báo giảng**, không phân trang theo buổi
dạy. Hệ thống có thể có 3.000–5.000 ảnh nên tuyệt đối không trả toàn bộ ảnh
trong một response.

Frontend đã có tab `Nhân sự → Hình ảnh` và cần API bên dưới.

---

## Endpoint

```http
GET /teaching-sessions/lesson-images
```

Yêu cầu JWT. Backend tự kiểm tra phạm vi dữ liệu theo tài khoản đăng nhập;
không tin `teacherId`, `schoolId` hay `provinceId` từ frontend.

### Query parameters

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---:|:---:|---|
| `page` | number | Không | Trang, mặc định `1`, tối thiểu `1` |
| `limit` | number | Không | Số **ảnh** mỗi trang, mặc định `30`, tối đa `30` |
| `provinceId` | number | Không | Khu vực/tỉnh của trường |
| `schoolId` | number | Không | Trường |
| `schoolLocationId` | number | Không | Điểm trường |
| `teacherId` | number | Không | Giáo viên |
| `fromDate` | `YYYY-MM-DD` | Không | Ngày dạy từ mốc này |
| `toDate` | `YYYY-MM-DD` | Không | Ngày dạy đến mốc này |
| `status` | string | Không | Trạng thái buổi dạy (`PRESENT`, `ABSENT`…) |
| `search` | string | Không | Tìm không phân biệt hoa/thường theo tên/mã giáo viên |
| `sortBy` | string | Không | Chỉ cho phép `createdAt` hoặc `sessionDate`; mặc định `createdAt` |
| `sortOrder` | string | Không | `DESC` mặc định hoặc `ASC` |

### Validation

- Parse số nguyên, trả `400` nếu không hợp lệ.
- Ép `limit` vào khoảng `1…30`; không chấp nhận `limit` lớn hơn 30.
- `fromDate <= toDate`, nếu cùng có mặt.
- Whitelist `status`, `sortBy`, `sortOrder`; không đưa trực tiếp chuỗi query
  vào `ORDER BY`.
- `search` tối đa 100 ký tự.

---

## Response

```json
{
  "data": [
    {
      "id": 901,
      "thumbnailUrl": "/uploads/lesson-images/thumb/901.webp",
      "url": "/uploads/lesson-images/901.jpg",
      "createdAt": "2026-09-10T01:15:32.000Z",
      "type": "LESSON_REPORT",
      "session": {
        "id": 1787,
        "date": "2026-09-09",
        "startTime": "14:15",
        "endTime": "15:00",
        "status": "PRESENT",
        "teacherId": 42,
        "teacherName": "Nguyễn Văn A",
        "teacherCode": "GV042",
        "schoolId": 448,
        "schoolName": "Trường Tiểu học A",
        "schoolLocationId": 11,
        "schoolLocationName": "Cơ sở chính",
        "className": "3A1",
        "subjectName": "Kỹ năng sống",
        "provinceId": 6,
        "provinceName": "Hồ Chí Minh"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 5276,
    "totalPages": 176,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "stats": {
    "totalImages": 5276,
    "teachersWithImages": 184,
    "schoolsWithImages": 91
  }
}
```

`thumbnailUrl` phải là ảnh nhỏ đã resize (khoảng 320px, WebP/JPEG); danh sách
không trả base64 và không trả ảnh gốc làm thumbnail.

---

## Truy vấn và hiệu năng

1. Bảng nguồn ảnh liên kết với `teaching_sessions` bằng `session_id`. Tận dụng
   quan hệ hiện có; không sao chép tên giáo viên/trường vào bảng ảnh.
2. Query một lần với JOIN cần thiết: ảnh → buổi dạy → giáo viên → lớp → trường
   → điểm trường/xã/phường/tỉnh. Chỉ select các cột có trong response.
3. Đếm `total` bằng query count riêng với **cùng điều kiện lọc**, không lấy hết
   bản ghi về RAM rồi cắt mảng.
4. Sắp xếp mặc định `image.created_at DESC, image.id DESC` để thứ tự ổn định
   giữa các trang.
5. Thêm index an toàn (tên bảng/cột điều chỉnh theo schema thực tế):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lesson_images_session_id
  ON lesson_images (session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lesson_images_created_at_id
  ON lesson_images (created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teaching_sessions_filters
  ON teaching_sessions (teacher_id, school_id, date, status);
```

Nếu dùng MySQL, dùng migration/index online tương đương; không chạy
`CONCURRENTLY` trong transaction migration của PostgreSQL.

---

## Phân quyền bắt buộc

- Admin/Nhân sự có quyền phù hợp: xem toàn bộ phạm vi được cấp.
- Quản lý khu vực: chỉ ảnh có trường thuộc khu vực được phân công.
- Quản lý trường: chỉ ảnh của trường được phân công.
- Giáo viên (nếu mở API cho role này): chỉ `session.teacherId` là hồ sơ của họ.
- Mọi điều kiện phạm vi phải nằm trong query SQL/repository trước phân trang.
  Không tải xong rồi lọc ở service/frontend.

---

## Kiểm thử cần có

1. `page=1&limit=30` trả tối đa 30 **ảnh**, `total` đúng.
2. Trang 1 và 2 không trùng ảnh; thứ tự mới nhất trước ổn định.
3. Lọc kết hợp khu vực + trường + giáo viên + khoảng ngày + status.
4. Trường không thuộc khu vực đã chọn trả dữ liệu rỗng.
5. Role bị giới hạn không thể đổi query để xem ảnh ngoài phạm vi.
6. `limit=1000`, ngày sai, sort sai trả validation error/được chặn đúng quy ước API.
7. Ảnh cũ vẫn hiển thị được; không migration nào xoá hoặc đổi URL ảnh gốc.
