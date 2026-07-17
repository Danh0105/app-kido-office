# PROMPT BE: Trả đủ dữ liệu chi tiết cho bảng "Tổng hợp" thu chi

## Hiện trạng

FE (trang **Quản lý thu chi** → tab **Tổng hợp** trong `RealExpenseDetail`) gọi:

```
GET /school-expenses/:id/summary
```

(không truyền `subjectId` → phải trả dữ liệu **của tất cả môn học** trong phiếu thu chi đó).

Hiện tại FE chỉ dùng response này để tính vài con số tổng (tổng doanh thu, đã thu, tổng chi...) hiển thị dạng thẻ KPI. FE vừa thêm **bảng chi tiết theo từng dòng** (giống bảng Excel tổng hợp thu-chi theo trường/tháng), nên response `/summary` cần trả về **mảng chi tiết từng item**, không chỉ số tổng, để FE tự ráp từng dòng.

Mỗi dòng trong bảng mới cần ghép `revenueItem`, `schoolExpenseItem` và `managementExpenseItem` **cùng `subjectId` và cùng `rowIndex`** (đây là cách FE lưu khi gọi `POST /school-expenses/:id/save-all` — 3 mảng luôn được gửi kèm `rowIndex` để giữ đúng thứ tự dòng nhập liệu).

Bảng phải bao gồm **toàn bộ dữ liệu thu và chi của tất cả môn học**. FE tạo danh sách dòng từ hợp của khóa `(subjectId, rowIndex)` trong cả 3 mảng, nên một dòng chỉ có dữ liệu thu hoặc chỉ có dữ liệu chi vẫn được hiển thị; không được lấy riêng `revenueItems` làm danh sách dòng gốc.

## Yêu cầu sửa

### 1. `GET /school-expenses/:id/summary` phải trả đủ 3 mảng item (không chỉ tổng)

Response cần có tối thiểu:

```json
{
  "summary": {
    "totalRevenue": 213125000,
    "totalRevenuePaid": 25127550,
    "totalSchoolExpense": 0,
    "totalManagementExpense": 0,
    "totalExpense": 0,
    "totalExpensePaid": 0,

    "revenueItems": [
      {
        "id": 501,
        "subjectId": 12,
        "rowIndex": 0,
        "content": "HK1",
        "totalPeriods": 4.5,
        "studentCount": 1093,
        "monthsCount": 4.5,
        "unitPrice": 25000,
        "invoiceAmount": 113125500,
        "invoiced": true,
        "invoiceType": "company",
        "invoiceDate": "2026-01-27",
        "paidAmount": 13279950,
        "paymentMethod": "bank_transfer",
        "paymentDate": "2026-01-30"
      }
    ],

    "schoolExpenseItems": [
      {
        "id": 601,
        "subjectId": 12,
        "rowIndex": 0,
        "teacherUnitPrice": 0,
        "taxUnitPrice": 0,
        "csvcUnitPrice": 0,
        "schoolExpenseAmount": 0,
        "paidAmount": 0,
        "expenseDate": "2026-02-09",
        "payer": "Nam+Trường",
        "note": ""
      }
    ],

    "managementExpenseItems": [
      {
        "id": 701,
        "subjectId": 12,
        "rowIndex": 0,
        "ql1UnitPrice": 0,
        "ql2UnitPrice": 0,
        "totalOutside": 0,
        "paidAmount": 0,
        "expenseDate": "2026-02-09",
        "payer": "Nam+Trường",
        "note": ""
      }
    ]
  }
}
```

Lưu ý bắt buộc:

- **`subjectId` và `rowIndex` phải có trên cả 3 loại item** — đây là khoá để FE ghép 1 dòng doanh thu với 1 dòng chi ngoài HĐ tương ứng. Thiếu 1 trong 2 field này thì FE không ghép được dòng, bảng sẽ hiển thị sai/thiếu.
- `schoolExpenseAmount` (của `schoolExpenseItems`) và `totalOutside` (của `managementExpenseItems`) nên trả sẵn giá trị đã tính (BE tính từ đơn giá × số học sinh × số tháng), không bắt FE tự suy ra từ đơn giá — tránh lệch số nếu công thức tính phía BE khác FE.
- Nếu 1 `schoolExpense` có nhiều môn học (subject), `revenueItems`/`schoolExpenseItems`/`managementExpenseItems` phải gộp **tất cả subjectId**, không chỉ subject đang active — vì bảng tổng hợp hiển thị toàn bộ môn học của trường trong 1 bảng duy nhất.
- Không được loại một item chỉ vì không tìm thấy item tương ứng trong 2 mảng còn lại. Ví dụ, một `(subjectId, rowIndex)` có chi nhưng chưa có thu vẫn phải được trả trong mảng chi tương ứng để FE hiển thị thành một dòng.

### 2. `GET /schools` (danh sách trường trong "Quản lý thu chi") cần trả kèm quan hệ `ward` và `employee`

FE cần 2 field sau cho mỗi trường để hiển thị cột "Tư vấn" và "Phường/Xã":

```json
{
  "id": 88,
  "name": "TH CỬU LONG",
  "employee": { "id": 20, "name": "Nam", "phone": "09..." },
  "ward": { "id": 305, "name": "XUÂN HƯƠNG - ĐÀ LẠT" }
}
```

- Endpoint `/schools` với các query hiện có (`page`, `limit`, `hasRemainingExpense`, `keyword`, `employeeName`) đều phải trả kèm `ward` (không chỉ khi lọc theo `wardId`) — hiện tại một số nơi khác trong hệ thống (ví dụ chi tiết đề xuất chi) đã có `school.ward?.name`, nên cần đảm bảo `/schools` list dùng ở "Quản lý thu chi" cũng include quan hệ này, tránh trường hợp trả `ward: null` dù trường đã được gán khu vực.

### 3. Không bắt buộc: số hoá đơn

FE **chưa** cần trường "Số hóa đơn" (mã hoá đơn) ở giai đoạn này — nếu hệ thống có sẵn field này thì có thể trả kèm trong `revenueItems` (ví dụ `invoiceNumber`), nhưng không phải yêu cầu bắt buộc của prompt này.

## Checklist nghiệm thu

- [ ] `GET /school-expenses/:id/summary` (không truyền `subjectId`) trả về `revenueItems`, `schoolExpenseItems`, `managementExpenseItems` là **mảng chi tiết từng dòng** của **tất cả môn học**, mỗi item có `subjectId` và `rowIndex`.
- [ ] Với 1 phiếu thu chi có N môn học, số dòng `revenueItems` = tổng số dòng doanh thu đã nhập của cả N môn (không chỉ môn đang xem).
- [ ] Hợp các khóa `(subjectId, rowIndex)` của cả 3 mảng bao phủ toàn bộ dòng thu/chi của cả N môn; dòng chỉ có thu hoặc chỉ có chi không bị mất.
- [ ] `schoolExpenseAmount` và `totalOutside` trả sẵn giá trị đã tính, khớp với số hiển thị ở tab chi tiết từng môn học (`ExpenseFormTable`).
- [ ] `GET /schools?...` trả `ward.name` đúng với khu vực đã gán cho trường (kể cả khi filter theo `employeeName`/`hasRemainingExpense`/`keyword`), không trả `null` nếu trường đã có khu vực.
- [ ] `GET /schools?...` vẫn giữ nguyên `employee.name`, `employee.phone` như hiện tại (không đổi hành vi cũ).
