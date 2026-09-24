import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePayrollPreview,
  formatPayrollDeduction,
  formatPayrollNumber,
  isPayrollEmployeeOption,
} from "../src/pages/Payroll/payroll.utils.ts";

test("payroll preview follows the backend formula and excludes base salary", () => {
  assert.deepEqual(
    calculatePayrollPreview({
      baseSalary: 14_000_000,
      officialWorkSalary: 14_000_000,
      overtimeAllowance: 1_620_000,
      otherSupport: 120_000,
      socialInsurance: 596_400,
      adjustmentAmount: 1_620_000,
    }),
    {
      totalIncome: 15_740_000,
      totalDeduction: 2_216_400,
      netSalary: 13_523_600,
    },
  );
});

test("a negative adjustment increases take-home pay", () => {
  assert.deepEqual(
    calculatePayrollPreview({ officialWorkSalary: "10000000", adjustmentAmount: -500000 }),
    { totalIncome: 10_000_000, totalDeduction: -500_000, netSalary: 10_500_000 },
  );
});

test("zero, deductions and backpay use payslip formatting", () => {
  assert.equal(formatPayrollNumber(0), "-");
  assert.equal(formatPayrollDeduction(596400), "(596.400)");
  assert.equal(formatPayrollDeduction(-1620000), "+1.620.000");
});

test("employee picker excludes collaborator teachers only", () => {
  assert.equal(isPayrollEmployeeOption({ roles: ["sales"] }), true);
  assert.equal(isPayrollEmployeeOption({ roles: ["giaovien_congty"] }), true);
  assert.equal(isPayrollEmployeeOption({ roles: ["employee", "giaovien_ctv"] }), false);
  assert.equal(isPayrollEmployeeOption({ roles: ["giaovienctv"] }), false);
});
