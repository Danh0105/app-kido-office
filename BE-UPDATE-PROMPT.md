# Backend Update - School Expense Module

## Overview

Frontend has been updated with new fields and formula changes for the school expense feature. Backend needs to update entities, DTOs, and calculation logic to match.

---

## 1. New Field: `content` (Nội dung)

### What changed
A new text field `content` has been added to the **Revenue Item** (Doanh Thu) table. This field is shared/synced across all 3 tables (Doanh Thu, Chi Trường, Chi Ngoài) on the frontend, but is stored only in the `revenue-items` entity.

### Payload change

**Endpoint:** `POST /school-expenses/:id/save-all`

`revenueItems[]` now includes:

```json
{
  "rowIndex": 0,
  "subjectId": 1,
  "content": "Nội dung mô tả dòng này",   // <-- NEW FIELD (string, nullable)
  "totalPeriods": 10,
  "studentCount": 25,
  "monthsCount": 3,
  "unitPrice": 500000,
  "invoiced": true,
  "invoiceType": "company",
  "invoiceOther": "",
  "invoiceDate": "2026-06-01",
  "paidAmount": 1000000,
  "paymentMethod": "bank_transfer",
  "paymentDate": "2026-06-15"
}
```

### Backend TODO

- Add `content` column (type: `varchar(500)`, nullable, default `""`) to `revenue_items` table
- Update the `RevenueItem` entity to include `content`
- Update the Create/Update DTO to accept `content`
- Return `content` in GET responses (`GET /revenue-items?schoolExpenseId=...`)

---

## 2. All numeric fields support decimals

### What changed

All monetary and quantity fields now support decimal input (e.g., `monthsCount = 1.5`, `unitPrice = 123456.78`).

### Backend TODO

- Ensure the following columns support decimal values (use `decimal` / `float` / `double` type, NOT `int`):
  - `revenue_items`: `totalPeriods`, `studentCount`, `monthsCount`, `unitPrice`, `paidAmount`
  - `school_expense_items`: `totalPeriods`, `studentCount`, `monthsCount`, `teacherUnitPrice`, `taxUnitPrice`, `csvcUnitPrice`, `paidAmount`
  - `management_expense_items`: `totalPeriods`, `studentCount`, `monthsCount`, `ql1UnitPrice`, `ql2UnitPrice`, `paidAmount`
- Update DTOs to use `number` / `float` type (not `int`) for these fields
- If there's any backend calculation, use float arithmetic

---

## 3. Formula changes (FE-only calculation, but BE should be aware)

These formulas are computed on the frontend. The backend stores unit prices and raw inputs only. But if the backend does any server-side calculation or validation, it needs to match:

### Chi Trường (School Expense) formulas

| Column | Old Formula | New Formula |
|--------|------------|-------------|
| CSVC | `csvcUnitPrice * studentCount` | `csvcUnitPrice * monthsCount * studentCount` |
| ĐG giáo viên (display) | `teacherUnitPrice` | `teacherUnitPrice` (no change in stored value) |
| Giáo viên | `studentCount * monthsCount * teacherUnitPrice` | (unchanged) |
| Thuế | `studentCount * monthsCount * taxUnitPrice` | (unchanged) |
| Chi trường | `teacherAmount + csvcAmount + taxAmount` | (unchanged, but csvcAmount changed) |

### Doanh Thu (Revenue) formulas

| Column | Formula |
|--------|---------|
| Thành tiền | `studentCount * monthsCount * unitPrice` |
| Còn lại | `thanhTien - paidAmount` |

### Chi Ngoài (Management Expense) formulas

| Column | Formula |
|--------|---------|
| Chi QL1 | `(ql1Percent - ql1Tax) * studentCount * monthsCount` |
| Chi QL2 | `(ql2Percent - ql2Tax) * studentCount * monthsCount` |
| Chi ngoài | `chiQL1 + chiQL2` |
| Còn chi | `chiNgoai - paidAmount` |

---

## 4. Complete `save-all` Payload Reference

**Endpoint:** `POST /school-expenses/:id/save-all`

```json
{
  "subjectId": 1,

  "revenueItems": [
    {
      "rowIndex": 0,
      "subjectId": 1,
      "content": "string (NEW)",
      "totalPeriods": "number (decimal)",
      "studentCount": "number (decimal)",
      "monthsCount": "number (decimal)",
      "unitPrice": "number (decimal)",
      "invoiced": "boolean",
      "invoiceType": "enum: '' | 'company' | 'student' | 'none' | 'other'",
      "invoiceOther": "string | undefined",
      "invoiceDate": "string (date) | undefined",
      "paidAmount": "number (decimal)",
      "paymentMethod": "enum: '' | 'cash' | 'bank_transfer' | undefined",
      "paymentDate": "string (date) | undefined"
    }
  ],

  "schoolExpenseItems": [
    {
      "rowIndex": 0,
      "subjectId": 1,
      "totalPeriods": "number (decimal)",
      "studentCount": "number (decimal)",
      "monthsCount": "number (decimal)",
      "teacherUnitPrice": "number (decimal)",
      "taxUnitPrice": "number (decimal)",
      "csvcUnitPrice": "number (decimal)",
      "paidAmount": "number (decimal)",
      "expenseDate": "string (date) | undefined",
      "payer": "string",
      "note": "string"
    }
  ],

  "managementExpenseItems": [
    {
      "rowIndex": 0,
      "subjectId": 1,
      "totalPeriods": "number (decimal)",
      "studentCount": "number (decimal)",
      "monthsCount": "number (decimal)",
      "ql1UnitPrice": "number (decimal)",
      "ql2UnitPrice": "number (decimal)",
      "invoiceAmount": "number (decimal)",
      "paidAmount": "number (decimal)",
      "expenseDate": "string (date) | undefined",
      "payer": "string",
      "note": "string"
    }
  ]
}
```

---

## 5. GET Response — fields to return

### `GET /revenue-items?schoolExpenseId=X&subjectId=Y`

Must return `content` field in each item:

```json
[
  {
    "id": 1,
    "content": "Lớp A1",
    "totalPeriods": 10,
    "studentCount": 25.5,
    "monthsCount": 1.5,
    "unitPrice": 500000,
    "invoiced": true,
    "invoiceType": "company",
    "invoiceOther": "",
    "invoiceDate": "2026-06-01",
    "paidAmount": 1000000.50,
    "paymentMethod": "bank_transfer",
    "paymentDate": "2026-06-15"
  }
]
```

---

## Summary of changes

| Change | Entity | Action |
|--------|--------|--------|
| Add `content` field | `revenue_items` | Add column `varchar(500)`, update entity + DTO |
| Decimal support | All 3 tables | Change `int` columns to `decimal`/`float` |
| CSVC formula | N/A (FE only) | `csvc * months * students` (was `csvc * students`) |
