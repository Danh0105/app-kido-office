# Backend Update — Đơn giá riêng theo từng giáo viên

## Mục tiêu

Frontend màn **Giảng dạy → Giáo viên → Thêm/Sửa giáo viên** đã gửi thêm:

```json
{
  "defaultRatePerPeriod": 150000
}
```

Backend hiện trả `400`:

```text
property defaultRatePerPeriod should not exist
```

Hãy bổ sung đơn giá mặc định theo từng giáo viên. Giá giáo viên phải có thể
**ghi đè giá của môn học**, nhưng tuyệt đối không làm thay đổi cách tính thu nhập
hiện tại và không được làm biến động bảng công của các buổi đã tạo.

---

## 1. Contract `/teachers`

Thêm field sau vào entity, DTO create/update và mọi response giáo viên:

```ts
defaultRatePerPeriod: number | null;
```

Quy ước:

- `null` hoặc không gửi: chưa khai giá riêng, dùng giá môn học làm fallback.
- `0`: giá hợp lệ, nghĩa là dạy không công; **không được fallback** về giá môn.
- Hợp lệ trong khoảng `0`–`100_000_000`, tối đa 2 chữ số thập phân.
- Chỉ role `nhansu` được ghi field này. Role khác gửi lên phải trả `403`, hoặc loại
  field theo cơ chế phân quyền tiền đang có; không cho `giaovu` tự sửa giá.
- `PATCH /teachers/:id` không gửi field thì giữ nguyên; gửi `null` thì xóa giá riêng.

DTO gợi ý:

```ts
@IsOptional()
@Type(() => Number)
@IsNumber({ maxDecimalPlaces: 2 })
@Min(0)
@Max(100_000_000)
defaultRatePerPeriod?: number | null;
```

Lưu ý phải xử lý `null` đúng cách, không biến `null` thành `0` và không dùng `||`.

Entity gợi ý:

```ts
@Column({
  name: 'default_rate_per_period',
  type: 'decimal',
  precision: 12,
  scale: 2,
  nullable: true,
  transformer: numericTransformer,
})
defaultRatePerPeriod?: number | null;
```

Tạo migration thêm cột `teachers.default_rate_per_period`, nullable, không đặt
default `0`. Dữ liệu giáo viên cũ phải giữ `null` để tiếp tục dùng giá môn học.

---

## 2. Quy tắc chọn đơn giá

Với giáo viên cộng tác viên, đơn giá hiệu lực là:

```ts
const effectiveRate =
  teacher.defaultRatePerPeriod !== null &&
  teacher.defaultRatePerPeriod !== undefined
    ? teacher.defaultRatePerPeriod
    : subject.ratePerPeriod ?? null;
```

Thứ tự ưu tiên bắt buộc:

```text
giá riêng giáo viên → giá môn học → null (chưa khai giá)
```

Không dùng:

```ts
teacher.defaultRatePerPeriod || subject.ratePerPeriod
```

vì cách đó làm giá `0` bị thay bằng giá môn.

Giữ nguyên nghiệp vụ hiện tại của **giáo viên công ty**: họ nhận phụ cấp xăng,
không nhận tiền theo tiết, nên `teaching_sessions.rate_per_period` vẫn là `null`
dù hồ sơ hoặc môn học có giá. Không để thay đổi này làm giáo viên công ty được
cộng thêm tiền tiết ngoài ý muốn.

Nên gom quy tắc trên vào một helper/service dùng chung để các luồng tạo/gán buổi
không tính giá khác nhau.

---

## 3. Phải áp dụng ở tất cả luồng tạo và phân công

Rà soát toàn bộ các luồng sau, không chỉ `POST /teaching-sessions`:

1. Tạo buổi lẻ.
2. Tạo mẫu lịch và sinh buổi từ mẫu lịch.
3. Sinh buổi hàng loạt / bulk schedule.
4. Sinh buổi định kỳ bằng job hoặc endpoint `generate-sessions`.
5. Gán giáo viên cho tiết đang mở.
6. Đổi giáo viên / chọn giáo viên từ danh sách đăng ký.
7. Tạo buổi dạy bù.

Khi tạo một buổi đã có giáo viên cộng tác viên, chốt `effectiveRate` vào
`teaching_sessions.rate_per_period`.

Khi một tiết đang mở được gán giáo viên hoặc đổi sang giáo viên khác trước khi
dạy, phải chốt lại theo **giá của giáo viên mới**, fallback về giá môn nếu người
mới chưa có giá riêng. Nếu đổi sang giáo viên công ty thì chốt `null` và giữ logic
phụ cấp xăng hiện tại.

Nếu mẫu lịch đang lưu snapshot `ratePerPeriod`, giá dùng để sinh buổi phải được
chốt theo giáo viên tại thời điểm tạo/cập nhật mẫu. Tuy nhiên khi đổi giáo viên
trực tiếp trên một buổi, phải tính lại snapshot cho chính buổi đó theo người mới.

---

## 4. Không làm ảnh hưởng việc tính thu nhập

`teaching_sessions.rate_per_period` tiếp tục là **nguồn duy nhất** để tính tiền
tiết của một buổi đã lưu:

```text
amount = teaching_sessions.rate_per_period × periods
```

Giữ nguyên các nguyên tắc:

- Chỉ buổi `PRESENT` mới được cộng vào `payableAmount` theo logic hiện tại.
- `ratePerPeriod = null` → chưa khai giá, `amount = null`, tăng
  `missingRateSessions` nếu đúng điều kiện hiện tại.
- `ratePerPeriod = 0` → `amount = 0`, không được tính là thiếu giá.
- Phụ cấp xăng, chi phí khác và `totalPayableAmount` giữ nguyên công thức hiện tại.
- API response vẫn tính `amount` từ snapshot của buổi, không tra ngược giá mới từ
  giáo viên hoặc môn học khi đọc dữ liệu.

### Yêu cầu quan trọng về lịch sử

Sửa `teachers.defaultRatePerPeriod` **không được UPDATE hàng loạt các buổi đã tạo**.
Buổi cũ phải giữ nguyên `teaching_sessions.rate_per_period`, kể cả buổi ở tháng
hiện tại, để bảng công và thu nhập đã ghi nhận không thay đổi.

Giá mới chỉ áp dụng khi:

- tạo mẫu lịch/buổi mới sau thời điểm đổi giá; hoặc
- người có quyền chủ động gán/đổi giáo viên trên một buổi chưa dạy.

Không chạy migration backfill giá giáo viên xuống các session cũ.

---

## 5. Response và khả năng tương thích

Các endpoint trả hồ sơ/danh sách giáo viên phải có field:

```json
{
  "id": 12,
  "name": "Nguyễn Văn A",
  "defaultRatePerPeriod": 150000
}
```

Bao gồm tối thiểu:

- `GET /teachers`
- `GET /teachers/:id`
- `GET /teachers/me`
- response của `POST /teachers`
- response của `PATCH /teachers/:id`
- dữ liệu giáo viên được nhúng trong endpoint candidates nếu FE cần hiển thị giá

Giá môn học vẫn giữ nguyên để làm fallback cho giáo viên chưa có giá riêng. Không
xóa cột/API giá môn và không đổi dữ liệu cũ.

---

## 6. Test bắt buộc

Viết unit/integration test cho tối thiểu các trường hợp:

1. Tạo giáo viên với `defaultRatePerPeriod: 150000` lưu và trả đúng số.
2. PATCH giá từ `150000` thành `180000` thành công.
3. PATCH `null` xóa giá riêng; PATCH không có field giữ nguyên giá cũ.
4. Giá âm, quá `100_000_000`, quá 2 số lẻ bị `400`.
5. Giá giáo viên `150000`, giá môn `100000` → buổi mới chốt `150000`.
6. Giá giáo viên `null`, giá môn `100000` → buổi mới chốt `100000`.
7. Giá giáo viên `0`, giá môn `100000` → buổi mới chốt đúng `0`.
8. Giá cả giáo viên và môn đều `null` → session rate/amount đều `null`.
9. Đổi giá hồ sơ giáo viên không làm đổi rate/amount của session đã tồn tại.
10. Đổi giáo viên trên buổi chưa dạy → chốt giá người mới; đổi sang giáo viên
    công ty → rate `null` và phụ cấp xăng vẫn được tính như hiện tại.
11. Tổng hợp thu nhập vẫn dùng snapshot session: `payableAmount`,
    `missingRateSessions`, `fuelAllowanceAmount`, `otherCostsAmount` và
    `totalPayableAmount` cho kết quả đúng.
12. Role không phải `nhansu` không thể sửa `defaultRatePerPeriod`.

Chạy toàn bộ test module Teaching và kiểm tra migration chạy được trên database có
dữ liệu cũ. Không sửa công thức tổng hợp thu nhập chỉ để làm test mới pass.

---

## Tiêu chí hoàn thành

- FE không còn nhận lỗi `property defaultRatePerPeriod should not exist`.
- Nhân sự lưu và đọc lại được giá riêng của từng giáo viên.
- Giá giáo viên ghi đè giá môn đúng cả trường hợp `0`.
- Mọi buổi mới/gán lại giáo viên chốt đúng giá hiệu lực.
- Đổi giá giáo viên không làm biến động thu nhập của buổi đã tạo.
- Giáo viên công ty vẫn theo cơ chế phụ cấp xăng hiện tại.
- Bảng công/tổng hợp thu nhập hiện tại không bị thay đổi công thức hoặc sai số.
