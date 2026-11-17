import { calculateRevenueQuantity } from "@/utils/revenueAmount";

/**
 * Lương giáo viên trường (bảng "Giáo viên trường" dưới Chi Ngoài) — khớp backend
 * (src/school-teacher-expense/school-teacher.ts):
 * - từ kỳ tháng 11/2026 tiền Giáo viên trường tách khỏi Chi Trường;
 * - Thành tiền = Đơn giá × (Số HS, không có thì Số tiết) × Số tháng;
 * - Thuế TNCN 10% khi tổng thù lao tháng của giáo viên (mọi môn) từ 5.000.000đ;
 * - Còn lại phải chi = Thành tiền − Thuế TNCN; đủ Ngày chi + Nguồn chi = đã trả.
 */
export const SCHOOL_TEACHER_SPLIT_FROM = { year: 2026, month: 11 };
/** Thuế TNCN theo giáo viên: tổng thù lao tháng (mọi môn) từ 5 triệu thì 10%. */
export const SCHOOL_TEACHER_PIT_THRESHOLD = 5_000_000;
export const SCHOOL_TEACHER_PIT_RATE = 10;

/** Ai được bấm "Duyệt lương" — khớp backend. */
export const SCHOOL_TEACHER_APPROVE_ROLES = [
  "director",
  "director_la",
  "ketoan_truong",
];

export const schoolTeacherSplitApplies = (
  period: { year?: number | null; month?: number | null } | null | undefined,
) => {
  const year = Number(period?.year);
  const month = Number(period?.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !year) return false;
  return (
    year * 100 + month >=
    SCHOOL_TEACHER_SPLIT_FROM.year * 100 + SCHOOL_TEACHER_SPLIT_FROM.month
  );
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Thành tiền = Đơn giá × (Số HS, không có thì Số tiết) × Số tháng. */
export const calculateSchoolTeacherAmount = (
  quantityInput: {
    totalPeriods?: number | string;
    studentCount?: number | string;
    monthsCount?: number | string;
  },
  unitPriceValue: unknown,
) => {
  const quantity = calculateRevenueQuantity(quantityInput);
  const unitPrice = Number(unitPriceValue || 0);
  return { quantity, unitPrice, amount: round2(unitPrice * quantity) };
};

/**
 * Thuế từng dòng của môn đang sửa — khớp backend `allocateSchoolTeacherTax`:
 * cộng Thành tiền theo giáo viên (kèm thù lao ở môn khác cùng bảng thu chi),
 * từ ngưỡng thì 10% mỗi dòng; dòng chưa chọn giáo viên xét riêng.
 */
export const calculateSchoolTeacherTax = (
  rows: { schoolTeacherId?: number | null; amount: number }[],
  otherSubjectGross: Record<number, number> = {},
) => {
  const gross = new Map<number, number>();
  rows.forEach((row) => {
    if (!row.schoolTeacherId) return;
    gross.set(row.schoolTeacherId, (gross.get(row.schoolTeacherId) ?? 0) + row.amount);
  });
  return rows.map((row) => {
    const teacherGross = row.schoolTeacherId
      ? (gross.get(row.schoolTeacherId) ?? 0) +
        Number(otherSubjectGross[row.schoolTeacherId] || 0)
      : row.amount;
    const pitRate =
      teacherGross >= SCHOOL_TEACHER_PIT_THRESHOLD ? SCHOOL_TEACHER_PIT_RATE : 0;
    const pitAmount = Math.round((row.amount * pitRate) / 100);
    return { teacherGross, pitRate, pitAmount, netAmount: round2(row.amount - pitAmount) };
  });
};
