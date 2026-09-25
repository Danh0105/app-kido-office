# Backend Update — Gửi lịch dạy cho giáo viên

## Bối cảnh

Màn `Giảng dạy → Lịch dạy → Buổi dạy` (`/#/nhan-su/lich-day`) có nút **Gửi lịch dạy**.
Nhân sự xem một kỳ (ngày / tuần / tháng) với bộ lọc đang áp, bấm nút → mở popup xem trước
danh sách giáo viên nhận và số buổi, nhập lời nhắn, rồi gửi.

FE đã làm xong phần giao diện. Cần backend mở endpoint dưới đây.

---

## Endpoint

**`POST /teaching-sessions/notify-schedule`** (JWT, chỉ role `nhansu`)

```json
{
  "fromDate": "2026-08-10",
  "toDate": "2026-08-16",
  "teacherId": 8,
  "schoolId": 12,
  "subjectId": 5,
  "message": "Lịch tuần tới, nhờ thầy cô kiểm tra lại."
}
```

- `fromDate`, `toDate`: **bắt buộc**, đúng khoảng Nhân sự đang xem.
- `teacherId`, `schoolId`, `subjectId`: tuỳ chọn — là bộ lọc đang áp trên màn; FE chỉ gửi
  field nào có giá trị.
- `message`: tuỳ chọn, ≤ 500 ký tự.

### Xử lý

1. Lấy các buổi dạy trong `[fromDate, toDate]` khớp bộ lọc và
   **`assignmentStatus = "ASSIGNED"`** (buổi chưa phân công không gửi cho ai).
2. Gom theo `teacherId`, mỗi giáo viên **chỉ nhận lịch của chính mình**.
3. Gửi thông báo (in-app + push nếu có) tới tài khoản gắn với giáo viên đó
   (`teachers.employeeId`). Giáo viên chưa có tài khoản → bỏ qua, đếm riêng.
4. Nội dung đề xuất:

```text
Lịch dạy 10/08 – 16/08/2026: 6 buổi · 12 tiết
Lời nhắn: Lịch tuần tới, nhờ thầy cô kiểm tra lại.
```

Bấm vào thông báo nên mở `/#/giao-vien/lich-day`.

### Response

```json
{
  "notified": 7,
  "sessionCount": 32,
  "teachers": [
    { "id": 8, "name": "Nguyễn Văn A", "sessionCount": 6 }
  ]
}
```

FE hiển thị `Đã gửi lịch dạy tới {notified} giáo viên`. Các field còn lại là tuỳ chọn.

### Lỗi

- `400`: thiếu `fromDate` / `toDate`, hoặc `fromDate > toDate`.
- `403`: không phải `nhansu`.
- Không có buổi nào khớp → trả `200` với `notified: 0` (FE tự báo cho người dùng),
  **đừng trả lỗi**.

---

## Lưu ý

- Nên chặn gửi trùng liên tục (ví dụ rate-limit 1 lần/phút cho cùng khoảng + bộ lọc),
  tránh giáo viên bị spam khi Nhân sự bấm nhiều lần.
- Ghi log ai gửi, khoảng nào, bao nhiêu người nhận — để đối chiếu khi giáo viên báo
  "không nhận được lịch".
- Popup của FE đếm người nhận từ dữ liệu **đã tải trên màn** nên chỉ là ước lượng;
  con số chính thức lấy từ `notified` trong response.
