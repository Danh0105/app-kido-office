import assert from "node:assert/strict";
import test from "node:test";

import {
  getManagementRowInput,
  placeRowsByIndex,
  STANDALONE_MANAGEMENT_CONTENT,
} from "../src/pages/Director/expense/utils/managementRows.ts";

const inputRows = [{ content: "Doanh thu 1", totalPeriods: 1, studentCount: 2, monthsCount: 3 }];

test("dòng đi kèm Doanh Thu dùng Nội dung của Doanh Thu", () => {
  assert.equal(getManagementRowInput({ content: "bỏ qua" }, 0, inputRows).content, "Doanh thu 1");
});

test("dòng thêm riêng dùng Nội dung của chính nó", () => {
  assert.equal(getManagementRowInput({ content: "Đợt 1" }, 1, inputRows).content, "Đợt 1");
  assert.equal(getManagementRowInput({ content: "" }, 1, inputRows).content, "");
});

test("dòng thêm riêng cũ chưa có Nội dung hiện nhãn mặc định", () => {
  assert.equal(getManagementRowInput({}, 1, inputRows).content, STANDALONE_MANAGEMENT_CONTENT);
});

test("đặt dòng theo rowIndex, chừa chỗ trống cho dòng chưa lưu", () => {
  const a = { rowIndex: 0 };
  const b = { rowIndex: 2 };
  assert.deepEqual(placeRowsByIndex([b, a]), [a, undefined, b]);
});

test("rowIndex trùng hoặc lạ thì giữ nguyên thứ tự nhận về", () => {
  const rows = [{ rowIndex: 1 }, { rowIndex: 1 }];
  assert.deepEqual(placeRowsByIndex(rows), rows);
  const noIndex = [{}, {}];
  assert.deepEqual(placeRowsByIndex(noIndex), noIndex);
});
