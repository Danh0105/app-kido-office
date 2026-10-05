import assert from "node:assert/strict";
import test from "node:test";

import { calculateRevenueAmount } from "../src/utils/revenueAmount.ts";

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
