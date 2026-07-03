# PROMPT CHO AI BE — MAP ĐỀ XUẤT CHI THEO TRƯỜNG VÀ NĂM HỌC

Frontend đã cập nhật module `EXPENSE_REQUEST` để mọi phiếu tạo mới bắt buộc
gắn với một trường và một năm học. Hãy cập nhật backend theo contract dưới đây.

## 1. Contract frontend gửi

`POST /expense-requests` dùng `multipart/form-data`:

| Field | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---:|---|
| `content` | string | Có | Tiêu đề/nội dung phiếu |
| `description` | string | Không | Nội dung chi tiết |
| `participants` | string | Không | Thành phần tham gia |
| `amount` | number | Có | Số tiền đề xuất |
| `expectedPaymentDate` | `YYYY-MM-DD` | Có | Ngày dự kiến chi |
| `schoolId` | number | Có | Trường liên quan |
| `schoolYear` | string | Có | Năm học, ví dụ `2026-2027` |
| `file` | file | Không | Một tệp đính kèm |

Ví dụ body logic trước khi chuyển thành `FormData`:

```ts
{
  content: "Mua thiết bị KNS",
  description: "Bổ sung thiết bị giảng dạy",
  participants: "Nhân viên phụ trách, kế toán",
  amount: 15000000,
  expectedPaymentDate: "2026-09-15",
  schoolId: 445,
  schoolYear: "2026-2027"
}
```

## 2. Database

Module đề xuất chi đang dùng chung bảng/entity `suggest` với
`type = 'EXPENSE_REQUEST'`.

- Thêm `school_id` kiểu số, nullable ở mức database để không làm hỏng dữ liệu
  cũ, FK tới `school.id`.
- Thêm `school_year` kiểu `varchar(20)`, nullable ở mức database để tương thích
  dữ liệu cũ.
- Thêm quan hệ `ManyToOne` từ đề xuất chi tới `School`.
- Nên thêm index phục vụ truy vấn:

```sql
CREATE INDEX idx_suggest_expense_school_year_status
ON suggest (type, school_id, school_year, status);
```

- Nếu dự án dùng migration, tạo migration thay vì sửa database thủ công.
- Nếu có thể xác định an toàn, backfill `school_year` cho phiếu cũ. Không đoán
  năm học khi dữ liệu không đủ.

## 3. DTO tạo phiếu

Trong `CreateExpenseRequestDto` hoặc DTO của nhánh
`type = 'EXPENSE_REQUEST'`, bổ sung:

```ts
@Type(() => Number)
@IsInt()
schoolId: number;

@IsString()
@Matches(/^\d{4}-\d{4}$/)
schoolYear: string;
```

Yêu cầu thêm:

- `schoolId` và `schoolYear` bắt buộc đối với phiếu `EXPENSE_REQUEST` tạo mới.
- Vì request là multipart, phải đọc hai trường từ body và ép `schoolId` sang
  number.
- Nếu bật whitelist hoặc `forbidNonWhitelisted`, phải khai báo hai trường trong
  DTO để request không bị trả 400.
- Giữ `participants?: string` trong DTO:

```ts
@IsOptional()
@IsString()
@MaxLength(500)
participants?: string;
```

## 4. Validation nghiệp vụ

Trước khi tạo phiếu:

1. Kiểm tra trường `schoolId` tồn tại.
2. Kiểm tra định dạng năm học và năm kết thúc phải bằng năm bắt đầu cộng một.
3. Kiểm tra trường có ít nhất một môn học thuộc đúng `schoolYear` đã gửi:
   `subject.schoolId = schoolId AND subject.schoolYear = schoolYear`.
4. Nếu không hợp lệ, trả HTTP 400 với thông báo tiếng Việt rõ ràng:
   - `Trường không tồn tại`
   - `Năm học không hợp lệ`
   - `Trường không có môn học trong năm học đã chọn`

Không xác định năm học bằng `expectedPaymentDate`, `createdAt` hoặc `spentAt`.
Nguồn map chính thức phải là cặp `schoolId + schoolYear` được lưu trên phiếu.

## 5. Lưu dữ liệu

Khi tạo phiếu:

- Gán quan hệ `school` theo `schoolId`.
- Lưu chính xác `schoolYear`.
- Lưu `participants` và các trường hiện có.
- Không thay đổi workflow trạng thái:
  `PENDING_APPROVAL -> ... -> SPENT`.

## 6. Response bắt buộc

Các API sau phải trả cả `schoolId`, `school`, và `schoolYear`:

- `POST /expense-requests`
- `GET /expense-requests/:id`
- `GET /expense-requests`
- `GET /expense-requests/my-tasks`
- Payload socket/notification có chứa snapshot đề xuất chi, nếu có

Shape tối thiểu:

```json
{
  "id": 123,
  "code": "DXC-000123",
  "content": "Mua thiết bị KNS",
  "amount": 15000000,
  "schoolId": 445,
  "school": {
    "id": 445,
    "name": "TH ABC"
  },
  "schoolYear": "2026-2027",
  "status": "SPENT"
}
```

## 7. Bộ lọc danh sách

Cập nhật Query DTO của `GET /expense-requests` để nhận:

```ts
@IsOptional()
@Type(() => Number)
@IsInt()
schoolId?: number;

@IsOptional()
@IsString()
@Matches(/^\d{4}-\d{4}$/)
schoolYear?: string;
```

Khi có cả hai tham số, truy vấn phải áp dụng điều kiện AND:

```sql
WHERE suggest.type = 'EXPENSE_REQUEST'
  AND suggest.school_id = :schoolId
  AND suggest.school_year = :schoolYear
```

Các filter hiện có như `status`, `createdBy`, `fromDate`, `toDate`, `overdue`,
`page`, `limit` vẫn phải hoạt động đồng thời.

Ví dụ frontend dùng để tính tổng đã chi trong Chính sách năm:

```http
GET /expense-requests?status=SPENT&schoolId=445&schoolYear=2026-2027&page=1&limit=100
```

API phải chỉ trả phiếu `SPENT` của đúng trường và đúng năm học. Tổng đã chi là
tổng `amount` của toàn bộ kết quả qua tất cả trang.

## 8. Tương thích dữ liệu cũ

- Record cũ thiếu `schoolId` hoặc `schoolYear` vẫn được phép đọc.
- Khi filter theo `schoolId + schoolYear`, không tự động gán record cũ vào một
  năm học dựa trên ngày.
- Frontend hiện vẫn có fallback theo ngày cho response cũ, nhưng backend mới
  phải ưu tiên và trả `schoolYear` đã lưu.

## 9. Tiêu chí nghiệm thu

1. Tạo phiếu thiếu `schoolId` hoặc `schoolYear` trả 400.
2. Tạo phiếu với trường/năm không khớp môn học trả 400.
3. Tạo hợp lệ lưu và trả đúng `school`, `schoolId`, `schoolYear`.
4. List/detail/my-tasks đều trả đủ ba trường.
5. Filter `status=SPENT&schoolId=X&schoolYear=Y` chỉ trả đúng scope.
6. Pagination không làm sai tổng số phiếu/tổng số trang.
7. Các workflow approve, payment order, cash released, confirm spent và socket
   notification không bị regression.
