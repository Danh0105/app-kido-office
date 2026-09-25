# Backend Update — Giáo viên từ chối buổi dạy và yêu cầu người thay thế

Frontend đã có luồng: giáo viên mở chi tiết một buổi đã phân công, nhập lý do
không thể dạy; Nhân sự nhận thông báo, mở buổi và chọn giáo viên khác.

## 1. Dữ liệu `TeachingSession`

Thêm các cột nullable:

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `declinedAt` | timestamp | Thời điểm giáo viên từ chối |
| `declineReason` | varchar(500) / text | Lý do bắt buộc |
| `declinedTeacherId` | int FK teachers | Giáo viên vừa từ chối |
| `declinedTeacherName` | response field | Tên giáo viên vừa từ chối |

Mọi response trả `TeachingSession` (`list`, `me`, `findOne`, `update`, `assign`)
phải có `declinedAt`, `declineReason`, `declinedTeacherName`; chưa có thì trả
`null`.

## 2. Giáo viên từ chối

`POST /teaching-sessions/:id/decline`

Body:

```json
{ "reason": "Tôi có việc gia đình đột xuất" }
```

Validate `reason`: trim, bắt buộc, 5–500 ký tự.

Thực hiện trong một transaction và khóa dòng buổi dạy:

1. Chỉ tài khoản role `giaovien` gắn với đúng `teacherId` hiện tại được gọi.
2. Chỉ cho từ chối buổi `ASSIGNED`, trạng thái công `SCHEDULED`, chưa
   `checkinAt`, ngày dạy không ở quá khứ và chưa từng `declinedAt`.
3. Lưu giáo viên cũ vào `declinedTeacherId`, lý do và thời điểm hiện tại.
4. Gỡ `teacherId`, đổi `assignmentStatus` thành `OPEN` để Nhân sự có thể phân
   công lại. Không sửa buổi khác trong cùng mẫu lịch tuần.
5. Trả buổi đã cập nhật.
6. Tạo notification cho các tài khoản có quyền quản lý Giảng dạy/Nhân sự, ví dụ:
   `GV Nguyễn Văn A từ chối buổi Toán lớp 3A ngày 10/08, 08:00–09:30. Lý do: ...`
   Metadata tối thiểu:

```json
{
  "kind": "TEACHING_REPLACEMENT_REQUEST",
  "module": "teaching",
  "sessionId": 123,
  "path": "/nhan-su/lich-day?tab=sessions&sessionId=123",
  "declinedTeacherId": 45
}
```

Bắn socket event `notification:new` và push notification nếu hệ thống đã bật.
Không gửi nội dung cho các role không có quyền xem module Giảng dạy.

Mã lỗi: `403` sai giáo viên/quyền; `404` không có buổi; `409` khi buổi không còn
đủ điều kiện từ chối.

## 3. Phân công người thay thế

Endpoint đang có:

`PATCH /teaching-sessions/:id/assign`

với `{ "teacherId": 99, "override": false }` tiếp tục dùng để chọn người thay
thế. Khi thành công:

- đặt `teacherId` mới và `assignmentStatus = ASSIGNED`;
- giữ `declinedAt`, `declineReason`, `declinedTeacherId` làm lịch sử đối chiếu;
- gửi notification lịch dạy tới giáo viên mới, ghi rõ đây là buổi dạy thay;
- không gửi lại cho giáo viên đã từ chối;
- vẫn kiểm tra trùng lịch và định mức như luồng phân công hiện tại.

## 4. An toàn đồng thời

Hai thao tác từ chối/phân công chạy đồng thời phải khóa cùng dòng session. Nếu
Nhân sự đã đổi giáo viên trước khi request từ chối được xử lý, request cũ phải
trả `409`, tuyệt đối không gỡ giáo viên mới.
