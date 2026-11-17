import assert from "node:assert/strict";
import test from "node:test";

import { calculateOtherCostExpense } from "../src/pages/Director/expense/utils/policyOtherCosts.ts";

test("Chi khác = số lượng × (đơn giá − thuế)", () => {
  assert.equal(calculateOtherCostExpense(29880, 2988, 74), 74 * (29880 - 2988));
  assert.equal(calculateOtherCostExpense(500, 50, 60 * 2), 54000);
});

test("không âm khi thuế lớn hơn đơn giá", () => {
  assert.equal(calculateOtherCostExpense(50, 500, 10), 0);
});

test("thiếu giá trị được tính là 0", () => {
  assert.equal(calculateOtherCostExpense(null, undefined, 10), 0);
  assert.equal(calculateOtherCostExpense("100", "10", 2), 180);
});
