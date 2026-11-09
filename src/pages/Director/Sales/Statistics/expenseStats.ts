import type { AccountingCashflowSummaryItem } from "@/service/schoolExpense";

/**
 * Số liệu thu chi của tab "Thu chi" ở Trung tâm thống kê — cùng nguồn và cùng
 * cách cộng với "Báo cáo tổng hợp" / tab "Tổng hợp" của Quản lý thu chi:
 * cộng các cột đã lưu của Doanh Thu (invoiceAmount / paidAmount /
 * remainingAmount), Chi Trường (schoolExpenseAmount / paidAmount / remaining),
 * Chi Ngoài (totalOutside / paidAmount / remaining) và Chính sách tiền mặt
 * (cashPolicyAmount + otherAmount).
 */

export type ExpensePeriodInfo = {
  id: number;
  name: string | null;
  month: number;
  year: number;
};

/** Một bảng thu chi = một trường trong một kỳ. */
export type CashflowRow = {
  schoolExpenseId: number;
  schoolId: number;
  schoolName: string;
  period: ExpensePeriodInfo;
  revenue: number;
  revenuePaid: number;
  revenueRemaining: number;
  schoolExpense: number;
  schoolExpensePaid: number;
  schoolExpenseRemaining: number;
  managementExpense: number;
  managementExpensePaid: number;
  managementExpenseRemaining: number;
  cashPolicy: number;
};

export type CashflowFigures = {
  /** Doanh thu = tổng số tiền hóa đơn. */
  revenue: number;
  revenuePaid: number;
  revenueRemaining: number;
  schoolExpense: number;
  schoolExpensePaid: number;
  schoolExpenseRemaining: number;
  managementExpense: number;
  managementExpensePaid: number;
  managementExpenseRemaining: number;
  /** Chi nhà trường + Chi ngoài HĐ. */
  totalExpense: number;
  expensePaid: number;
  expenseRemaining: number;
  cashPolicy: number;
  /** Chênh lệch = Doanh thu − Tổng chi − CS tiền mặt (như QL thu chi). */
  balance: number;
};

export type SchoolCashflow = CashflowFigures & {
  schoolId: number;
  schoolName: string;
  subjectNames: string[];
  periods: Array<CashflowFigures & { key: number; period: ExpensePeriodInfo }>;
};

export type EmployeeCashflow = CashflowFigures & {
  key: string;
  employeeId: number;
  employeeName: string;
  schools: SchoolCashflow[];
};

/**
 * Role được gọi `GET /accounting/cashflow-summary` — phải khớp
 * ACCOUNTING_SUMMARY_ROLES ở backend (accounting-summary.controller.ts).
 * Role khác (sales admin) đọc từng bảng qua `/school-expenses/:id/summary`.
 */
export const CASHFLOW_SUMMARY_ROLES = [
  "accountant",
  "ketoan_congno",
  "ketoan_truong",
  "troly_gd",
  "director",
];

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Cộng tiền theo xu để không lệch số lẻ khi cộng nhiều dòng thập phân. */
const addMoney = (...values: number[]) =>
  values.reduce((total, value) => total + Math.round(toNumber(value) * 100), 0) /
  100;

const sumMoney = (items: any[], getValue: (item: any) => unknown) =>
  addMoney(...items.map((item) => toNumber(getValue(item))));

const unwrap = (value: any) =>
  value?.data && !Array.isArray(value.data) ? value.data : value || {};

export const toPeriod = (period: any): ExpensePeriodInfo => ({
  id: toNumber(period?.id),
  name: period?.name ?? null,
  month: toNumber(period?.month),
  year: toNumber(period?.year),
});

export const fromCashflowSummaryItem = (
  item: AccountingCashflowSummaryItem,
): CashflowRow => ({
  schoolExpenseId: toNumber(item.schoolExpenseId),
  schoolId: toNumber(item.school?.id),
  schoolName: item.school?.name || "",
  period: toPeriod(item.period),
  revenue: toNumber(item.revenue?.expected),
  revenuePaid: toNumber(item.revenue?.collected),
  revenueRemaining: toNumber(item.revenue?.receivable),
  schoolExpense: toNumber(item.expense?.school?.expected),
  schoolExpensePaid: toNumber(item.expense?.school?.paid),
  schoolExpenseRemaining: toNumber(item.expense?.school?.payable),
  managementExpense: toNumber(item.expense?.management?.expected),
  managementExpensePaid: toNumber(item.expense?.management?.paid),
  managementExpenseRemaining: toNumber(item.expense?.management?.payable),
  cashPolicy: toNumber(item.cashPolicy),
});

/**
 * Dựng cùng dòng số liệu từ bản ghi `/school-expenses` (có `cashPolicyItems`)
 * và kết quả `/school-expenses/:id/summary` của nó.
 */
export const fromSchoolExpenseSummary = (
  record: any,
  summaryResponse: any,
): CashflowRow => {
  const payload = unwrap(summaryResponse);
  const summary = payload?.summary || payload;
  const revenueItems = Array.isArray(summary?.revenueItems)
    ? summary.revenueItems
    : [];
  const schoolItems = Array.isArray(summary?.schoolExpenseItems)
    ? summary.schoolExpenseItems
    : [];
  const managementItems = Array.isArray(summary?.managementExpenseItems)
    ? summary.managementExpenseItems
    : [];
  const cashPolicyItems = Array.isArray(record?.cashPolicyItems)
    ? record.cashPolicyItems
    : [];

  return {
    schoolExpenseId: toNumber(record?.id),
    schoolId: toNumber(record?.school?.id ?? record?.schoolId),
    schoolName: record?.school?.name || "",
    period: toPeriod(record?.period),
    revenue: sumMoney(revenueItems, (item) => item.invoiceAmount),
    revenuePaid: sumMoney(revenueItems, (item) => item.paidAmount),
    revenueRemaining: sumMoney(revenueItems, (item) => item.remainingAmount),
    schoolExpense: sumMoney(schoolItems, (item) => item.schoolExpenseAmount),
    schoolExpensePaid: sumMoney(schoolItems, (item) => item.paidAmount),
    schoolExpenseRemaining: sumMoney(schoolItems, (item) => item.remaining),
    managementExpense: sumMoney(managementItems, (item) => item.totalOutside),
    managementExpensePaid: sumMoney(managementItems, (item) => item.paidAmount),
    managementExpenseRemaining: sumMoney(
      managementItems,
      (item) => item.remaining,
    ),
    cashPolicy: sumMoney(
      cashPolicyItems,
      (item) => toNumber(item.cashPolicyAmount) + toNumber(item.otherAmount),
    ),
  };
};

/**
 * Năm học của kỳ: tháng 8–12 thuộc năm học bắt đầu từ năm đó, tháng 1–7 thuộc
 * năm học trước. Dòng tuỳ chỉnh (tháng ảo > 12) mang năm bắt đầu năm học.
 */
export const getPeriodSchoolYear = (period: ExpensePeriodInfo) => {
  if (!period.month || !period.year) return "";
  const startYear = period.month >= 8 ? period.year : period.year - 1;
  return `${startYear}-${startYear + 1}`;
};

/**
 * Kỳ thu chi là riêng từng trường, nên chọn "11/2026" nghĩa là tháng 11/2026
 * của mọi trường. Dòng tuỳ chỉnh (tháng ảo > 12) chỉ khớp đúng dòng đó.
 */
export const matchesPeriodFilter = (
  row: Pick<CashflowRow, "period">,
  schoolYear: string,
  selectedPeriod: ExpensePeriodInfo | null,
) => {
  if (schoolYear && getPeriodSchoolYear(row.period) !== schoolYear) {
    return false;
  }
  if (!selectedPeriod) return true;
  if (selectedPeriod.month > 12) return row.period.id === selectedPeriod.id;
  return (
    row.period.month === selectedPeriod.month &&
    row.period.year === selectedPeriod.year
  );
};

export const getPeriodLabel = (period: ExpensePeriodInfo) =>
  period.name ||
  `${String(period.month || "--").padStart(2, "0")}/${period.year || "--"}`;

/** Tháng 8 → 12 rồi 1 → 7, dòng tuỳ chỉnh xếp sau cùng năm học. */
const periodSortKey = (period: ExpensePeriodInfo) =>
  period.month > 12
    ? (period.year + 1) * 100 + 12 + period.month
    : period.year * 100 + period.month;

export const emptyFigures = (): CashflowFigures => ({
  revenue: 0,
  revenuePaid: 0,
  revenueRemaining: 0,
  schoolExpense: 0,
  schoolExpensePaid: 0,
  schoolExpenseRemaining: 0,
  managementExpense: 0,
  managementExpensePaid: 0,
  managementExpenseRemaining: 0,
  totalExpense: 0,
  expensePaid: 0,
  expenseRemaining: 0,
  cashPolicy: 0,
  balance: 0,
});

const ROW_KEYS = [
  "revenue",
  "revenuePaid",
  "revenueRemaining",
  "schoolExpense",
  "schoolExpensePaid",
  "schoolExpenseRemaining",
  "managementExpense",
  "managementExpensePaid",
  "managementExpenseRemaining",
  "cashPolicy",
] as const;

/** Cộng dồn các cột gốc rồi suy ra Tổng chi / Đã chi / Còn phải chi / Chênh lệch. */
export const sumFigures = (
  rows: Array<Pick<CashflowRow, (typeof ROW_KEYS)[number]>>,
): CashflowFigures => {
  const result = emptyFigures();
  ROW_KEYS.forEach((key) => {
    result[key] = sumMoney(rows, (row) => row[key]);
  });
  result.totalExpense = addMoney(result.schoolExpense, result.managementExpense);
  result.expensePaid = addMoney(
    result.schoolExpensePaid,
    result.managementExpensePaid,
  );
  result.expenseRemaining = addMoney(
    result.schoolExpenseRemaining,
    result.managementExpenseRemaining,
  );
  result.balance = addMoney(
    result.revenue,
    -result.totalExpense,
    -result.cashPolicy,
  );
  return result;
};

type BuildOptions = {
  policies: any[];
  restrictToPolicySchools: boolean;
  schoolYear: string;
  selectedPeriod: ExpensePeriodInfo | null;
  fallbackEmployee?: { id: number; name: string } | null;
};

/** Lọc theo bộ lọc của trang rồi nhóm Nhân viên → Trường → Kỳ. */
export const buildEmployeeCashflow = (
  rows: CashflowRow[],
  {
    policies,
    restrictToPolicySchools,
    schoolYear,
    selectedPeriod,
    fallbackEmployee,
  }: BuildOptions,
) => {
  const policiesBySchool = new Map<number, any[]>();
  policies.forEach((policy) => {
    const schoolId = toNumber(policy?.schoolId);
    if (!schoolId) return;
    policiesBySchool.set(schoolId, [
      ...(policiesBySchool.get(schoolId) || []),
      policy,
    ]);
  });

  const visibleRows = rows.filter(
    (row) =>
      (!restrictToPolicySchools || policiesBySchool.has(row.schoolId)) &&
      matchesPeriodFilter(row, schoolYear, selectedPeriod),
  );

  const rowsBySchool = new Map<number, CashflowRow[]>();
  visibleRows.forEach((row) => {
    rowsBySchool.set(row.schoolId, [
      ...(rowsBySchool.get(row.schoolId) || []),
      row,
    ]);
  });

  const groups = new Map<string, EmployeeCashflow>();
  const schoolsByGroup = new Map<string, SchoolCashflow[]>();

  rowsBySchool.forEach((schoolRows, schoolId) => {
    const schoolPolicies = policiesBySchool.get(schoolId) || [];
    const policy = schoolPolicies[0] || {};
    const policyEmployee =
      policy.employee && typeof policy.employee === "object"
        ? policy.employee
        : {};
    const employeeId = toNumber(
      policy.employeeId || policyEmployee.id || fallbackEmployee?.id,
    );
    const employeeName =
      policy.employeeName ||
      policy.consultantName ||
      policyEmployee.name ||
      fallbackEmployee?.name ||
      (employeeId ? `Nhân viên #${employeeId}` : "Chưa phân công");
    const subjectNames = [
      ...new Set<string>(
        schoolPolicies
          .map((item) => String(item.subjectName || "").trim())
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right, "vi"));

    const school: SchoolCashflow = {
      ...sumFigures(schoolRows),
      schoolId,
      schoolName:
        policy.schoolName || schoolRows[0].schoolName || `Trường #${schoolId}`,
      subjectNames,
      periods: [...schoolRows]
        .sort(
          (left, right) =>
            periodSortKey(left.period) - periodSortKey(right.period) ||
            left.schoolExpenseId - right.schoolExpenseId,
        )
        .map((row) => ({
          ...sumFigures([row]),
          key: row.schoolExpenseId,
          period: row.period,
        })),
    };

    const key = employeeId
      ? `employee-${employeeId}`
      : `employee-name-${employeeName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        ...emptyFigures(),
        key,
        employeeId,
        employeeName,
        schools: [],
      });
    }
    schoolsByGroup.set(key, [...(schoolsByGroup.get(key) || []), school]);
  });

  const employees = Array.from(groups.values())
    .map((group) => {
      const schools = (schoolsByGroup.get(group.key) || []).sort(
        (left, right) =>
          right.revenueRemaining - left.revenueRemaining ||
          left.schoolName.localeCompare(right.schoolName, "vi"),
      );
      return { ...group, ...sumFigures(schools), schools };
    })
    .sort((left, right) =>
      left.employeeName.localeCompare(right.employeeName, "vi"),
    );

  return {
    employees,
    totals: sumFigures(visibleRows),
    schoolCount: rowsBySchool.size,
    periodCount: visibleRows.length,
  };
};
