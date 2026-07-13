# PROMPT BE: Sửa grouped notification đề xuất chi theo nhân viên

## Hiện trạng lỗi

FE gọi:

- `GET /notifications/expense/summary` trả `general.unread > 0`.
- `GET /notifications/expense/grouped-by-employee?scope=general&tab=unread&page=1&limit=20` lại trả `data: []`.
- `GET /notifications/expense?scope=general&tab=unread&page=1&limit=20` có dữ liệu, nhưng `meta` thiếu `employeeId`, `employeeName`, `employeePhone`; chỉ còn `senderId`.

Ví dụ notification hiện tại:

```json
{
  "id": 5504,
  "senderId": 20,
  "type": "SUGGEST",
  "entityId": 74,
  "meta": {
    "suggestId": 74,
    "suggestType": "EXPENSE_REQUEST",
    "status": "PENDING_APPROVAL"
  },
  "isRead": false
}
```

## Yêu cầu sửa

### 1. Group theo nhân viên tạo đề xuất

Với notification đề xuất chi:

- `type = "SUGGEST"`
- `meta.suggestType = "EXPENSE_REQUEST"`

Nhân viên kinh doanh/người tạo đề xuất là:

1. Ưu tiên `meta.employeeId` nếu có.
2. Nếu notification cũ chưa có `meta.employeeId`, fallback sang `senderId`.
3. Nếu cần chính xác hơn, join sang bảng đề xuất chi bằng `meta.suggestId` hoặc `entityId`, lấy `createdBy`.

### 2. Endpoint grouped không được loại notification cũ

`GET /notifications/expense/grouped-by-employee`

Query:

- `scope=general | overdue | all`
- `tab=unread | read` optional
- `page`
- `limit`

Logic scope:

- `general`: lấy tất cả notification đề xuất chi trừ `meta.kind = "overdue"`.
- `overdue`: chỉ lấy `meta.kind = "overdue"`.
- `all`: không lọc theo `kind`.

Response:

```json
{
  "scope": "general",
  "data": [
    {
      "employeeId": 20,
      "employeeName": "Tên nhân viên",
      "phone": "09...",
      "total": 3,
      "unreadCount": 3,
      "latestAt": "2026-07-10T11:40:46.306Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

`total` và `totalPages` phân trang theo số nhân viên, không theo số notification.

### 3. Flat endpoint nên trả đủ meta

`GET /notifications/expense`

Mỗi item nên có:

```json
"meta": {
  "suggestType": "EXPENSE_REQUEST",
  "suggestId": 74,
  "suggestCode": "DX-202607-0020",
  "employeeId": 20,
  "employeeName": "Tên nhân viên",
  "employeePhone": "09...",
  "kind": "created | reminder | due_today | overdue",
  "status": "PENDING_APPROVAL",
  "daysLate": 1
}
```

Nếu notification cũ không lưu đủ meta, có thể enrich response runtime bằng join:

- notification `senderId`
- hoặc suggest `createdBy`
- join employee/user để lấy name/phone.

### 4. Khi tạo notification mới

Khi tạo notification đề xuất chi mới, BE cần lưu `meta` đủ:

- `employeeId`: người tạo đề xuất
- `employeeName`
- `employeePhone`
- `suggestId`
- `suggestCode`
- `kind`
- `status`
- `daysLate` nếu overdue

## Checklist nghiệm thu

- `summary.general.unread = 3` thì `grouped-by-employee?scope=general&tab=unread` không được trả rỗng.
- Notification cũ thiếu `meta.employeeId` vẫn được group theo `senderId` hoặc `suggest.createdBy`.
- Tab `scope=overdue` chỉ trả cảnh báo quá hạn.
- Tab `scope=general` không chứa `meta.kind = "overdue"`.
- `employeeName` và `phone` trong grouped response lấy từ bảng nhân viên mới nhất.

