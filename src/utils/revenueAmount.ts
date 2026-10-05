export type RevenueAmountInput = {
  totalPeriods?: number | string | null;
  studentCount?: number | string | null;
  monthsCount?: number | string | null;
  unitPrice?: number | string | null;
};

/**
 * Có số học sinh thì tính theo học sinh; nếu không thì tính theo số tiết.
 * Khi cả hai cùng có giá trị, số học sinh được ưu tiên để khớp backend.
 */
export function calculateRevenueAmount(row: RevenueAmountInput): number {
  const students = Number(row.studentCount || 0);
  const periods = Number(row.totalPeriods || 0);
  const months = Number(row.monthsCount || 0);
  const price = Number(row.unitPrice || 0);
  const baseQuantity = students > 0 ? students : periods;

  return baseQuantity * months * price;
}
