import assert from "node:assert/strict";
import test from "node:test";

import { formatDecimalDraft, parseDecimalDraft } from "../src/utils/decimalInput.ts";

test("giữ số 0 ở đầu khi gõ số thập phân", () => {
  assert.equal(formatDecimalDraft("0", true), "0");
  assert.equal(formatDecimalDraft("0.", true), "0,");
  assert.equal(formatDecimalDraft("0.7", true), "0,7");
  assert.equal(formatDecimalDraft("0.75", true), "0,75");
});

test("chế độ số nguyên vẫn định dạng tiền theo vi-VN", () => {
  assert.equal(formatDecimalDraft("17000", false), "17.000");
});

test("không chèn dấu nghìn khi gõ ở chế độ nhập xong mới tính", () => {
  // Có dấu nghìn thì gõ 12345 sẽ qua bước 1.234 rồi bị hiểu nhầm thành 1,2345.
  let draft = "";
  for (const digit of "12345") draft = formatDecimalDraft(draft + digit, true, false);
  assert.equal(draft, "12345");
  assert.equal(parseDecimalDraft(draft), 12345);
  assert.equal(formatDecimalDraft("1234,5", true, false), "1234,5");
});

test("đọc đúng số đang gõ, kể cả 3 chữ số thập phân", () => {
  assert.equal(parseDecimalDraft("0,75"), 0.75);
  assert.equal(parseDecimalDraft(formatDecimalDraft("1.234", true), 4), 1.234);
  assert.equal(parseDecimalDraft(formatDecimalDraft("1,2345", true), 4), 1.2345);
  assert.equal(parseDecimalDraft(formatDecimalDraft("1234,5", true)), 1234.5);
  assert.equal(parseDecimalDraft(""), 0);
  assert.equal(parseDecimalDraft("0,"), 0);
});

test("làm tròn theo số chữ số thập phân cho phép", () => {
  assert.equal(parseDecimalDraft("1,23456", 4), 1.2346);
  assert.equal(parseDecimalDraft("1,239"), 1.24);
});
