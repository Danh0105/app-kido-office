export type RevenueAmountInput = {
  totalPeriods?: number | string | null;
  studentCount?: number | string | null;
  monthsCount?: number | string | null;
  unitPrice?: number | string | null;
};

export type RevenuePolicyData = {
  mode?: string | null;
  periods?: number | string | null;
  fee?: number | string | null;
  giaovien?: number | string | null;
  thue?: number | string | null;
  tax?: number | string | null;
  csvc?: number | string | null;
};

export type RevenuePolicySubject = {
  studentCount?: number | string | null;
  policies?: Array<{ data?: RevenuePolicyData | null }> | null;
};

/** Đơn giá trên dòng Chi Trường, cột nào chưa có thì lấy theo chính sách. */
export type SchoolUnitPriceInput = {
  teacherUnitPrice?: number | string | null;
  giaovien?: number | string | null;
  taxUnitPrice?: number | string | null;
  thue?: number | string | null;
  tax?: number | string | null;
  csvcUnitPrice?: number | string | null;
  csvc?: number | string | null;
  paymentType?: string | null;
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

/** Có số học sinh thì lấy số học sinh, nếu không thì lấy số tiết — chưa nhân số tháng. */
export function revenueBaseQuantity(row: RevenueAmountInput): number {
  const students = Number(row.studentCount || 0);
  const periods = Number(row.totalPeriods || 0);

  return students > 0 ? students : periods;
}

/**
 * Số lượng tính doanh thu/hóa đơn:
 * - có số học sinh thì lấy số học sinh;
 * - nếu không có học sinh thì lấy số tiết;
 * - nhân với số tháng của dòng.
 */
export function calculateRevenueQuantity(row: RevenueAmountInput): number {
  return revenueBaseQuantity(row) * Number(row.monthsCount || 0);
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

/** Tổng đơn giá Chi trường (CSVC + giáo viên + thuế) của 1 dòng — không nhân HS/tháng. */
export function schoolUnitPriceOf(
  row?: SchoolUnitPriceInput | null,
  policyData?: RevenuePolicyData | null,
): number {
  const teacherUnitPrice = Number(
    row?.teacherUnitPrice ?? row?.giaovien ?? policyData?.giaovien ?? 0,
  );
  const taxUnitPrice = Number(
    row?.taxUnitPrice ??
      row?.thue ??
      row?.tax ??
      policyData?.thue ??
      policyData?.tax ??
      0,
  );
  const csvcUnitPrice = Number(
    row?.csvcUnitPrice ?? row?.csvc ?? policyData?.csvc ?? 0,
  );
  return teacherUnitPrice + taxUnitPrice + csvcUnitPrice;
}

/**
 * Đơn giá trên hóa đơn công ty của 1 dòng, tuỳ row.paymentType (Hình thức chi):
 * - 'not_in_contract' (Không có trong HĐ): = Đơn giá trên doanh thu (không trừ CSVC/GV/thuế).
 * - 'in_contract' hoặc rỗng/chưa chọn (mặc định, giữ hành vi cũ): = Đơn giá trên doanh thu - (ĐG CSVC + ĐG GV + ĐG thuế).
 */
export function companyPaymentOf(
  revenueUnitPrice: number,
  row?: SchoolUnitPriceInput | null,
  policyData?: RevenuePolicyData | null,
): number {
  if (row?.paymentType === "not_in_contract") {
    return revenueUnitPrice;
  }
  return revenueUnitPrice - schoolUnitPriceOf(row, policyData);
}

/**
 * Thành tiền của 1 dòng đã lưu trên bảng Hóa Đơn: Số lượng × đơn giá công ty.
 * Giống màn nhập liệu: chưa lưu đơn giá hoặc số lượng thì lấy theo chính sách.
 */
export function invoiceAmountOfSavedRow(
  revenue: RevenueAmountInput,
  school?: SchoolUnitPriceInput | null,
  subject?: RevenuePolicySubject | null,
): number {
  const policyData = subject?.policies?.[0]?.data;
  const hasSavedQuantity =
    Number(revenue.totalPeriods || 0) > 0 ||
    Number(revenue.studentCount || 0) > 0;
  const quantity = calculateRevenueQuantity({
    ...(hasSavedQuantity
      ? revenue
      : revenueQuantityDefaultsFromPolicy(subject)),
    monthsCount: revenue.monthsCount,
  });
  const unitPrice =
    Number(revenue.unitPrice || 0) || Number(policyData?.fee || 0);

  return quantity * companyPaymentOf(unitPrice, school, policyData);
}
