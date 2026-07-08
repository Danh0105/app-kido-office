# PROMPT CHO AI BE - LUU DU LIEU CHINH SACH NAM

Frontend da co man hinh `director/expense-management` -> tab `Chinh sach nam`.
Can backend them API luu va doc du lieu chinh sach nam theo truong + nam hoc.

## 1. Muc tieu

Luu duoc toan bo du lieu cua man hinh Chinh sach nam:

- Thong tin chung cua chinh sach nam.
- Cau hinh mon hoc.
- Cac dong thong tin nhap theo thang.
- Cac gia tri ho tro tien mat va thiet bi.
- Summary tinh san tu FE de doi chieu/bao cao.

Khong can backend tinh lai cong thuc neu chua co logic san; backend uu tien luu raw input va tra ve dung data da luu.

## 2. Endpoint de xuat

### Upsert chinh sach nam

`POST /policy-years/upsert`

Hoac neu BE muon nam trong module thu chi:

`POST /school-expenses/policy-years/upsert`

Body JSON:

```json
{
  "id": 1,
  "schoolId": 123,
  "schoolName": "Truong ABC",
  "schoolYear": "2025-2026",
  "status": "ACTIVE",
  "subjects": [
    {
      "id": 10,
      "code": "STEM",
      "name": "STEM",
      "tuitionPrice": 0,
      "schoolRetainUnit": 0,
      "policyTotalAmount": 0,
      "policyStudentBase": 0,
      "policyMonthBase": 0,
      "taxPercent": 10,
      "companyProfitPerHS": 0,
      "cashSupportAmount": 110000000,
      "equipmentSupportAmount": 17000000
    }
  ],
  "monthlyRows": [
    {
      "id": 1001,
      "rowIndex": 0,
      "subjectId": 10,
      "month": "2026-07",
      "studentCount": 300,
      "unitPrice": 0,
      "monthsCount": 1,
      "principalPolicyAmount": 0,
      "cashPolicyAmount": 110000000,
      "equipmentPolicyAmount": 17000000,
      "paidCashAmount": 0,
      "paidEquipmentAmount": 0,
      "calculatedPolicyAmount": 3666667,
      "policyAfterTaxAmount": 3300000,
      "note": ""
    }
  ],
  "summary": {
    "totalStudents": 1800,
    "totalRevenue": 0,
    "totalTkd": 0,
    "totalSchoolRetain": 0,
    "totalCompanyPayment": 0,
    "totalInitialPolicy": 127000000,
    "totalPolicyAfterTax": 9900000,
    "totalPaid": 0,
    "totalRemaining": 9900000
  }
}
```

Frontend payload da duoc chuan hoa boi ham:

`buildPolicyYearSavePayload(policy)` trong `src/pages/Director/expense/PolicyYear/utils.ts`.

Khi noi API, FE se gui them `schoolId` tu context truong hien tai.

## 3. API doc danh sach/detail

### Lay theo truong + nam hoc

`GET /policy-years?schoolId=123&schoolYear=2025-2026`

Tra ve record policy year cua dung truong va nam hoc. Neu chua co, co the tra `null` hoac `404`; FE se tao draft tu du lieu thu chi hien co.

### Lay detail

`GET /policy-years/:id`

Tra ve cung shape voi payload upsert.

## 4. Database de xuat

Co the dung 3 bang:

### `policy_years`

- `id`
- `school_id`
- `school_name`
- `school_year`
- `status` enum: `DRAFT | ACTIVE | LOCKED`
- cac cot summary: `total_students`, `total_policy_after_tax`, `total_paid`, ...
- `created_at`, `updated_at`

Unique index:

```sql
CREATE UNIQUE INDEX idx_policy_year_school_year
ON policy_years (school_id, school_year);
```

### `policy_year_subjects`

- `id`
- `policy_year_id`
- `subject_id`
- `code`
- `name`
- `tuition_price`
- `school_retain_unit`
- `policy_total_amount`
- `policy_student_base`
- `policy_month_base`
- `tax_percent`
- `company_profit_per_hs`
- `cash_support_amount`
- `equipment_support_amount`

### `policy_year_monthly_rows`

- `id`
- `policy_year_id`
- `row_index`
- `subject_id`
- `month` varchar `YYYY-MM`
- `student_count`
- `unit_price`
- `months_count`
- `principal_policy_amount`
- `cash_policy_amount`
- `equipment_policy_amount`
- `paid_cash_amount`
- `paid_equipment_amount`
- `calculated_policy_amount`
- `policy_after_tax_amount`
- `note`

Tat ca cot tien/so luong nen dung decimal, khong dung int.

## 5. Validation

- `schoolId` bat buoc khi upsert.
- `schoolYear` dung format `/^\d{4}-\d{4}$/` va nam sau = nam truoc + 1.
- `status` chi nhan `DRAFT`, `ACTIVE`, `LOCKED`.
- `subjects[].id` va `monthlyRows[].subjectId` bat buoc.
- `monthlyRows[].month` dung format `YYYY-MM`.
- Moi `monthlyRows[].subjectId` phai ton tai trong `subjects[].id`.
- Khong tu y nhan doi `cashPolicyAmount` hoac `equipmentPolicyAmount` theo so dong thang. Day la raw input FE gui.

## 6. Response bat buoc

Sau upsert tra ve record day du:

```json
{
  "id": 1,
  "schoolId": 123,
  "schoolName": "Truong ABC",
  "schoolYear": "2025-2026",
  "status": "ACTIVE",
  "subjects": [],
  "monthlyRows": [],
  "summary": {},
  "updatedAt": "2026-07-08T00:00:00.000Z"
}
```

## 7. Tieu chi nghiem thu

1. Upsert cung `schoolId + schoolYear` khong tao duplicate.
2. Luu va doc lai giu nguyen `cashPolicyAmount` va `equipmentPolicyAmount`.
3. `equipmentPolicyAmount` duoc FE dung de hien thi `Tien chi thiet bi`.
4. `monthlyRows` tra ve dung thu tu `rowIndex`, sau do theo `month`.
5. Du lieu decimal khong bi lam tron khi luu raw input.
6. Record `LOCKED` khong cho cap nhat neu BE co rule khoa.
