import type { PayrollNumberField } from "@/types/payroll";

type PayrollNumbers = Partial<Record<PayrollNumberField, number | string | null>>;

const amount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const calculatePayrollPreview = (values: PayrollNumbers) => {
  const totalIncome = roundMoney(
    amount(values.officialWorkSalary) +
    amount(values.probationWorkSalary) +
    amount(values.fuelAllowance) +
    amount(values.overtimeAllowance) +
    amount(values.excessPeriodAllowance) +
    amount(values.otherSupport) +
    amount(values.bonus),
  );
  const totalDeduction = roundMoney(
    amount(values.socialInsurance) +
    amount(values.personalIncomeTax) +
    amount(values.adjustmentAmount) +
    amount(values.advancePayment),
  );

  return {
    totalIncome,
    totalDeduction,
    netSalary: roundMoney(totalIncome - totalDeduction),
  };
};

export const formatPayrollNumber = (value: number | string | null | undefined) => {
  const parsed = amount(value);
  if (parsed === 0) return "-";
  return parsed.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
};

export const formatPayrollMoney = (value: number | string | null | undefined) =>
  formatPayrollNumber(value);

/** Số dương là khoản bị trừ; số âm là truy lãnh nên được cộng lại. */
export const formatPayrollDeduction = (
  value: number | string | null | undefined,
) => {
  const parsed = amount(value);
  if (parsed === 0) return "-";
  const formatted = Math.abs(parsed).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
  return parsed > 0 ? `(${formatted})` : `+${formatted}`;
};

export const currentPayrollPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

export const payrollYearOptions = (selected?: number) => {
  const current = new Date().getFullYear();
  const years = new Set<number>();
  for (let year = current + 1; year >= current - 6; year -= 1) years.add(year);
  if (selected) years.add(selected);
  return [...years].sort((a, b) => b - a);
};

/** Giáo viên cộng tác viên nhận thù lao theo luồng giảng dạy, không chọn vào phiếu lương nhân viên. */
export const isPayrollEmployeeOption = (employee: { roles?: string[] | null }) =>
  !(employee.roles ?? []).some(
    (role) => role.toLowerCase().replace(/[_-]/g, "") === "giaovienctv",
  );
