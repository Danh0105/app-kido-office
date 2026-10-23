export type RevenueAmountInput = {
  totalPeriods?: number | string | null;
  studentCount?: number | string | null;
  monthsCount?: number | string | null;
  unitPrice?: number | string | null;
};

export type RevenuePolicySubject = {
  studentCount?: number | string | null;
  policies?: Array<{
    data?: {
      mode?: string | null;
      periods?: number | string | null;
    } | null;
  }> | null;
};

/**
 * Giá trị mặc định của dòng doanh thu lấy từ chính sách đã duyệt:
 * - HP/TIẾT: lấy tổng số tiết trong chính sách;
 * - HP/HS: lấy số học sinh đã khai cho môn tại trường.
 */
export function revenueQuantityDefaultsFromPolicy(
  subject?: RevenuePolicySubject | null,
): { totalPeriods: number; studentCount: number } {
  const policyData = subject?.policies?.[0]?.data;

  if (policyData?.mode === "TIET") {
    return {
      totalPeriods: Number(policyData.periods || 0),
      studentCount: 0,
    };
  }

  return {
    totalPeriods: 0,
    studentCount: Number(subject?.studentCount || 0),
  };
}

/**
 * Số lượng tính doanh thu/hóa đơn:
 * - có số học sinh thì lấy số học sinh;
 * - nếu không có học sinh thì lấy số tiết;
 * - nhân với số tháng của dòng.
 */
export function calculateRevenueQuantity(row: RevenueAmountInput): number {
  const students = Number(row.studentCount || 0);
  const periods = Number(row.totalPeriods || 0);
  const months = Number(row.monthsCount || 0);
  const baseQuantity = students > 0 ? students : periods;

  return baseQuantity * months;
}

/**
 * Có số học sinh thì tính theo học sinh; nếu không thì tính theo số tiết.
 * Khi cả hai cùng có giá trị, số học sinh được ưu tiên để khớp backend.
 */
export function calculateRevenueAmount(row: RevenueAmountInput): number {
  const price = Number(row.unitPrice || 0);

  return calculateRevenueQuantity(row) * price;
}

/**
 * Người dùng nhập ô "Số tiết": chỉ đổi số tiết.
 *
 * Không suy ra HS từ số tiết (kiểu `số tiết / 4 × số lớp`), không ghi đè và
 * không xoá HS đã nhập tay. Muốn tính theo số tiết thì người dùng tự xoá HS
 * hoặc đặt HS = 0 — khi đó `calculateRevenueQuantity` dùng số tiết.
 */
export function applyPeriodsInput<T extends RevenueAmountInput>(
  row: T,
  value: number | string | null | undefined,
): T {
  return { ...row, totalPeriods: Number(value || 0) };
}
