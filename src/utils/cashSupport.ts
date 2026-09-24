// Mốc mặc định cố định — khớp với MoneyForm (form nhập chính sách của nhân viên).
const DEFAULT_STUDENTS = 1000;
const DEFAULT_MONTHS = 9;
const DEFAULT_PERIODS = 36;

const toNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * "Thành tiền" THỰC TẾ NHẬP của 1 dòng hỗ trợ tiền mặt (httienmat) — đúng công
 * thức ô "Thực tế nhập" ở MoneyForm. Đây là số chạy về Quản lý thu chi, không
 * phải "Số tiền" chính sách gốc.
 * - HP/HS:   Số tiền / Số năm khấu hao / 1.000 / 9  × Số HS thực × Số tháng
 * - HP/TIẾT: Số tiền / Số năm khấu hao / 1.000 / 36 × Số HS thực × Số tiết thực
 */
export const getCashSupportActualAmount = (item: any, mode?: string) => {
  const money = toNumber(item?.money ?? item?.amount);
  const depreciationYears = toNumber(item?.depreciationYears ?? 1);
  if (money <= 0 || depreciationYears <= 0) return 0;

  const depreciatedMoney = money / depreciationYears;
  const realStudents = toNumber(item?.realStudents) || toNumber(item?.students);

  if (mode === "TIET") {
    const realPeriods = toNumber(item?.realPeriods) || toNumber(item?.periods);
    return realStudents > 0 && realPeriods > 0
      ? Math.round(
          (depreciatedMoney / DEFAULT_STUDENTS / DEFAULT_PERIODS) *
            realStudents *
            realPeriods,
        )
      : 0;
  }

  const months = toNumber(item?.months);
  return realStudents > 0 && months > 0
    ? Math.round(
        (depreciatedMoney / DEFAULT_STUDENTS / DEFAULT_MONTHS) *
          realStudents *
          months,
      )
    : 0;
};

/** Tổng thành tiền thực tế của toàn bộ hỗ trợ tiền mặt trong 1 chính sách. */
export const getCashSupportActualTotal = (policyData: any) => {
  const items = Array.isArray(policyData?.httienmat) ? policyData.httienmat : [];

  return items.reduce(
    (total: number, item: any) =>
      total + getCashSupportActualAmount(item, policyData?.mode),
    0,
  );
};
