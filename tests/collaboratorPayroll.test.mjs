import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRateRange,
  monthRange,
  normalizeSearch,
  payrollWarnings,
  periodMonth,
  schoolYearMonths,
  schoolYearOf,
  schoolYearRange,
} from "../src/pages/Director/expense/utils/collaboratorPayroll.ts";

test("khoảng ngày của tháng, kể cả tháng 2 năm nhuận", () => {
  assert.deepEqual(monthRange(11, 2026), {
    fromDate: "2026-11-01",
    toDate: "2026-11-30",
  });
  assert.deepEqual(monthRange(2, 2028), {
    fromDate: "2028-02-01",
    toDate: "2028-02-29",
  });
  assert.deepEqual(monthRange(12, 2026).toDate, "2026-12-31");
});

test("năm học bắt đầu từ tháng 8", () => {
  assert.equal(schoolYearOf(8, 2026), "2026-2027");
  assert.equal(schoolYearOf(7, 2027), "2026-2027");
  assert.equal(schoolYearOf(1, 2027), "2026-2027");
  assert.deepEqual(schoolYearRange("2026-2027"), {
    fromDate: "2026-08-01",
    toDate: "2027-07-31",
  });
  assert.equal(schoolYearRange("abc"), null);
});

test("12 tháng của năm học theo thứ tự 8 → 7", () => {
  const months = schoolYearMonths("2026-2027");
  assert.equal(months.length, 12);
  assert.deepEqual(months[0], { month: 8, year: 2026 });
  assert.deepEqual(months[4], { month: 12, year: 2026 });
  assert.deepEqual(months[5], { month: 1, year: 2027 });
  assert.deepEqual(months[11], { month: 7, year: 2027 });
  assert.deepEqual(schoolYearMonths(""), []);
});

test("kỳ tuỳ chỉnh (tháng > 12) không gắn tháng", () => {
  assert.deepEqual(periodMonth({ month: 11, year: 2026 }), {
    month: 11,
    year: 2026,
  });
  assert.deepEqual(periodMonth({ month: "3", year: "2027" }), {
    month: 3,
    year: 2027,
  });
  assert.equal(periodMonth({ month: 13, year: 2026 }), null);
  assert.equal(periodMonth({ month: 0, year: 2026 }), null);
  assert.equal(periodMonth(null), null);
  assert.equal(periodMonth({ month: 5 }), null);
});

test("đơn giá: một mức, nhiều mức, chưa có", () => {
  assert.equal(formatRateRange(100000, 100000), (100000).toLocaleString("vi-VN"));
  assert.equal(
    formatRateRange(80000, 100000),
    `${(80000).toLocaleString("vi-VN")} – ${(100000).toLocaleString("vi-VN")}`,
  );
  assert.equal(formatRateRange(null, null), "—");
});

test("cảnh báo thiếu đơn giá / chưa chấm công", () => {
  assert.deepEqual(payrollWarnings({ missingRateSessions: 0, uncheckedSessions: 0 }), []);
  assert.deepEqual(
    payrollWarnings({ missingRateSessions: 2, uncheckedSessions: 1 }),
    ["2 buổi thiếu đơn giá", "1 buổi chưa chấm công"],
  );
});

test("tìm trường không phân biệt dấu", () => {
  assert.ok(normalizeSearch("Trường TH Lê Lợi").includes(normalizeSearch("le loi")));
  assert.ok(normalizeSearch("Đống Đa").includes("dong da"));
});
