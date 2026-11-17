/**
 * Tiện ích thuần cho phần "Lương GV CTV" của Quản lý thu chi (không import
 * alias `@/` để chạy được bằng `node --test`).
 */

export type MonthOption = { month: number; year: number };

const pad = (value: number) => String(value).padStart(2, "0");

/** Ngày cuối tháng dạng YYYY-MM-DD. */
const lastDayOfMonth = (month: number, year: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Khoảng ngày của một tháng dương lịch (tháng 1–12). */
export const monthRange = (month: number, year: number) => ({
  fromDate: `${year}-${pad(month)}-01`,
  toDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(month, year))}`,
});

/** Năm bắt đầu của năm học "YYYY-YYYY"; sai định dạng → null. */
export const schoolYearStart = (schoolYear: string) => {
  const year = Number(schoolYear?.match(/^(\d{4})/)?.[1] || 0);
  return year > 0 ? year : null;
};

/** Năm học chứa tháng đó: năm học bắt đầu từ tháng 8. */
export const schoolYearOf = (month: number, year: number) => {
  const start = month >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
};

/** 12 tháng của năm học theo thứ tự 8 → 12 rồi 1 → 7. */
export const schoolYearMonths = (schoolYear: string): MonthOption[] => {
  const start = schoolYearStart(schoolYear);
  if (!start) return [];
  return [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7].map((month) => ({
    month,
    year: month >= 8 ? start : start + 1,
  }));
};

/** Cả năm học: 01/08 năm đầu → 31/07 năm sau. */
export const schoolYearRange = (schoolYear: string) => {
  const start = schoolYearStart(schoolYear);
  if (!start) return null;
  return { fromDate: `${start}-08-01`, toDate: `${start + 1}-07-31` };
};

/**
 * Kỳ thu chi → tháng dương lịch để lấy chấm công. Dòng tuỳ chỉnh (tháng > 12)
 * không gắn với tháng nào → null.
 */
export const periodMonth = (
  period: { month?: unknown; year?: unknown } | null | undefined,
): MonthOption | null => {
  const month = Number(period?.month);
  const year = Number(period?.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2000) return null;
  return { month, year };
};

export const monthLabel = ({ month, year }: MonthOption) =>
  `${pad(month)}/${year}`;

export const formatPayrollMoney = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("vi-VN");
};

/** Đơn giá tiết: một mức → "100.000"; nhiều mức → "80.000 – 100.000". */
export const formatRateRange = (
  minRate: number | null | undefined,
  maxRate: number | null | undefined,
) => {
  if (minRate === null || minRate === undefined) {
    return maxRate === null || maxRate === undefined
      ? "—"
      : formatPayrollMoney(maxRate);
  }
  if (maxRate === null || maxRate === undefined || maxRate === minRate) {
    return formatPayrollMoney(minRate);
  }
  return `${formatPayrollMoney(minRate)} – ${formatPayrollMoney(maxRate)}`;
};

/** Cảnh báo ngắn của một dòng: buổi thiếu đơn giá, buổi chưa chấm công. */
export const payrollWarnings = (row: {
  missingRateSessions?: number;
  uncheckedSessions?: number;
}) => {
  const warnings: string[] = [];
  if (Number(row.missingRateSessions) > 0) {
    warnings.push(`${row.missingRateSessions} buổi thiếu đơn giá`);
  }
  if (Number(row.uncheckedSessions) > 0) {
    warnings.push(`${row.uncheckedSessions} buổi chưa chấm công`);
  }
  return warnings;
};

/** Lọc trường theo từ khoá (không phân biệt dấu, hoa thường). */
export const normalizeSearch = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
