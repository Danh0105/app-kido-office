import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPeriodsInput,
  calculateRevenueAmount,
  calculateRevenueQuantity,
  revenueQuantityDefaultsFromPolicy,
} from "../src/utils/revenueAmount.ts";

test("dòng mới HP/TIẾT tự lấy số tiết trong chính sách", () => {
  assert.deepEqual(
    revenueQuantityDefaultsFromPolicy({
      studentCount: 240,
      policies: [{ data: { mode: "TIET", periods: 60 } }],
    }),
    { totalPeriods: 60, studentCount: 0 },
  );
});

test("dòng mới HP/HS tự lấy số học sinh của môn tại trường", () => {
  assert.deepEqual(
    revenueQuantityDefaultsFromPolicy({
      studentCount: 240,
      policies: [{ data: { mode: "HS", periods: 60 } }],
    }),
    { totalPeriods: 0, studentCount: 240 },
  );
});

test("số lượng hóa đơn ưu tiên học sinh và nhân số tháng", () => {
  assert.equal(
    calculateRevenueQuantity({
      studentCount: 30,
      totalPeriods: 60,
      monthsCount: 2,
    }),
    60,
  );
});

test("số lượng hóa đơn dùng số tiết khi không có học sinh", () => {
  assert.equal(
    calculateRevenueQuantity({
      studentCount: 0,
      totalPeriods: 60,
      monthsCount: 1,
    }),
    60,
  );
  assert.equal(
    calculateRevenueQuantity({
      studentCount: "",
      totalPeriods: "60",
      monthsCount: "2",
    }),
    120,
  );
});

test("doanh thu dùng số học sinh khi có nhập học sinh", () => {
  assert.equal(
    calculateRevenueAmount({
      studentCount: 30,
      totalPeriods: 60,
      monthsCount: 2,
      unitPrice: 120_000,
    }),
    7_200_000,
  );
});

test("doanh thu dùng số tiết khi học sinh trống hoặc bằng 0", () => {
  assert.equal(
    calculateRevenueAmount({
      studentCount: 0,
      totalPeriods: 60,
      monthsCount: 1,
      unitPrice: 530_000,
    }),
    31_800_000,
  );
  assert.equal(
    calculateRevenueAmount({
      studentCount: "",
      totalPeriods: "60",
      monthsCount: "1",
      unitPrice: "120000",
    }),
    7_200_000,
  );
});

test("không có học sinh và số tiết thì thành tiền bằng 0", () => {
  assert.equal(
    calculateRevenueAmount({ monthsCount: 3, unitPrice: 530_000 }),
    0,
  );
});

// --- Nhập "Số tiết" không được tự sinh / ghi đè / xoá HS -------------------

test("case 1: HS trống, nhập 20 tiết (3 lớp) → HS vẫn trống, tính theo 20 tiết", () => {
  const row = applyPeriodsInput(
    { studentCount: null, totalPeriods: 0, monthsCount: 2, unitPrice: 100_000 },
    "20",
  );
  assert.equal(row.studentCount, null);
  assert.equal(row.totalPeriods, 20);
  assert.equal(calculateRevenueQuantity({ ...row, monthsCount: 1 }), 20);
  assert.equal(calculateRevenueAmount(row), 4_000_000); // 20 × 2 × 100.000
});

test("case 2: HS = 0, 20 tiết → tính theo 20 tiết", () => {
  assert.equal(
    calculateRevenueQuantity({ studentCount: 0, totalPeriods: 20, monthsCount: 1 }),
    20,
  );
});

test("case 3: HS = 120, 20 tiết → tính theo 120 HS", () => {
  assert.equal(
    calculateRevenueQuantity({ studentCount: 120, totalPeriods: 20, monthsCount: 1 }),
    120,
  );
});

test("case 4: HS = 120, sửa số tiết 20 → 24 thì HS vẫn 120", () => {
  const row = applyPeriodsInput(
    { studentCount: 120, totalPeriods: 20, monthsCount: 1, unitPrice: 1 },
    24,
  );
  assert.equal(row.studentCount, 120);
  assert.equal(row.totalPeriods, 24);
  assert.equal(calculateRevenueQuantity(row), 120);
});

test("case 5: HS trống, 20 tiết, 5 lớp → HS KHÔNG tự thành 25", () => {
  const row = applyPeriodsInput(
    { studentCount: null, totalPeriods: 0, monthsCount: 1, classCount: 5 },
    20,
  );
  assert.equal(row.studentCount, null);
  assert.notEqual(row.studentCount, 25);
  assert.deepEqual(Object.keys(row).sort(), [
    "classCount",
    "monthsCount",
    "studentCount",
    "totalPeriods",
  ]);
  assert.equal(calculateRevenueQuantity(row), 20);
});

test("xoá HS (về 0) thì chuyển sang tính theo số tiết", () => {
  const withStudents = { studentCount: 120, totalPeriods: 24, monthsCount: 1 };
  assert.equal(calculateRevenueQuantity(withStudents), 120);
  assert.equal(calculateRevenueQuantity({ ...withStudents, studentCount: 0 }), 24);
});
