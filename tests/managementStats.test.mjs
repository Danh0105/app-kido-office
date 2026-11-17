import assert from "node:assert/strict";
import test from "node:test";

import {
  paidPercentOf,
  summarizeManagementRows,
} from "../src/pages/Director/expense/utils/managementStats.ts";

test("đếm dòng theo trạng thái chi, bỏ dòng trống", () => {
  assert.deepEqual(
    summarizeManagementRows([
      { totalOutside: 1000, paidAmount: 1000 },
      { totalOutside: 1000, paidAmount: 400 },
      { totalOutside: 1000, paidAmount: 0 },
      { totalOutside: 0, paidAmount: 0 },
    ]),
    {
      rowCount: 3,
      paidRows: 1,
      partialRows: 1,
      unpaidRows: 1,
      overpaidRows: 0,
      overpaidAmount: 0,
    },
  );
});

test("chi vượt vẫn tính là đã chi đủ và báo số tiền vượt", () => {
  const stats = summarizeManagementRows([
    { totalOutside: 0, paidAmount: 32400000 },
    { totalOutside: 1000, paidAmount: 1500 },
  ]);
  assert.equal(stats.paidRows, 2);
  assert.equal(stats.overpaidRows, 2);
  assert.equal(stats.overpaidAmount, 32400500);
});

test("lệch dưới 1 đồng do làm tròn không đổi trạng thái", () => {
  const stats = summarizeManagementRows([
    { totalOutside: 1000.4, paidAmount: 1000 },
    { totalOutside: 1000, paidAmount: 1000.4 },
  ]);
  assert.equal(stats.paidRows, 2);
  assert.equal(stats.overpaidRows, 0);
});

test("nhận số dạng chuỗi và bỏ qua giá trị trống", () => {
  const stats = summarizeManagementRows([
    { totalOutside: "2000.50", paidAmount: "500" },
    { totalOutside: null, paidAmount: undefined },
  ]);
  assert.equal(stats.rowCount, 1);
  assert.equal(stats.partialRows, 1);
});

test("phần trăm đã chi làm tròn xuống, chỉ 100% khi đủ", () => {
  assert.equal(paidPercentOf(1000, 250), 25);
  assert.equal(paidPercentOf(3, 1), 33.3);
  assert.equal(paidPercentOf(1000000, 999000), 99.9);
  assert.equal(paidPercentOf(100000000, 99990000), 99.9);
  assert.equal(paidPercentOf(1000, 1000), 100);
  assert.equal(paidPercentOf(1000, 1500), 100);
});

test("không có tổng chi thì phần trăm bằng 0", () => {
  assert.equal(paidPercentOf(0, 0), 0);
  assert.equal(paidPercentOf(0, 500), 0);
});
