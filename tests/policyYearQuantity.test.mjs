import assert from "node:assert/strict";
import test from "node:test";

import { resolvePolicyYearQuantities } from "../src/pages/Director/expense/PolicyYear/utils.ts";

test("chính sách HP/HS lấy số học sinh, không chuyển từ số tiết", () => {
  assert.deepEqual(
    resolvePolicyYearQuantities({
      billingMode: "HS",
      totalPeriods: 60,
      studentCount: 120,
      declaredStudentCount: 150,
      classCount: 10,
    }),
    { totalPeriods: 0, studentCount: 120 },
  );
});

test("chính sách HP/HS dùng số học sinh đã khai khi dòng thu chi đang trống", () => {
  assert.deepEqual(
    resolvePolicyYearQuantities({
      billingMode: "HS",
      studentCount: 0,
      declaredStudentCount: 150,
    }),
    { totalPeriods: 0, studentCount: 150 },
  );
});

test("chính sách HP/TIẾT bóc số tiết và quy đổi học sinh theo số lớp", () => {
  assert.deepEqual(
    resolvePolicyYearQuantities({
      billingMode: "TIET",
      totalPeriods: 60,
      studentCount: 0,
      classCount: 8,
    }),
    { totalPeriods: 60, studentCount: 120 },
  );
});

test("chính sách HP/TIẾT dùng số tiết đã khai khi dòng thu chi đang trống", () => {
  assert.deepEqual(
    resolvePolicyYearQuantities({
      billingMode: "TIET",
      totalPeriods: 0,
      declaredPeriods: 36,
      classCount: 5,
    }),
    { totalPeriods: 36, studentCount: 45 },
  );
});

test("chính sách cũ chưa lưu loại vẫn nhận diện theo dữ liệu số tiết", () => {
  assert.deepEqual(
    resolvePolicyYearQuantities({
      totalPeriods: 0,
      studentCount: 0,
      declaredPeriods: 40,
      classCount: 6,
    }),
    { totalPeriods: 40, studentCount: 60 },
  );
});
