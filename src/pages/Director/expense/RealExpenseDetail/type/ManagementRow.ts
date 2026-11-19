export type ManagementRow = {
  /** id dòng đã lưu — dòng mới thêm chưa có */
  id?: number;
  /** Nội dung riêng — chỉ dùng cho dòng thêm riêng (sau dòng Doanh Thu cuối). */
  content?: string;
  /** Thêm khi bảng đã khoá BBCS, chưa lưu: chỉ nhập được Nội dung + cột chi. */
  addedWhileLocked?: boolean;
  /** Số lượng riêng — chỉ dùng cho dòng thêm riêng (sau dòng Doanh Thu cuối). */
  totalPeriods?: number;
  studentCount?: number;
  monthsCount?: number;
  ql1UnitPrice?: number | string;
  ql1Tax?: number | string;
  ql2UnitPrice?: number | string;
  ql2Tax?: number | string;
  otherCostUnitPrices?: Record<string, number | string>;
  otherCostTaxes?: Record<string, number | string>;
  totalOutsideExpense: number;
  paidAmount: number;
  remainingOutsideExpense: number;
  paymentDate: string;
  /** Nguồn chi — số hiệu tài khoản trong danh mục Nguồn thu chi */
  cashAccount: string;
  payer: string;
  note: string;
  /** Mã đề xuất chi đã ghi Đã chi vào dòng — ô Ngày chi / Nguồn chi / Đã chi khoá. */
  suggestCodes?: string;
  /** Phần Đã chi do đề xuất chi ghi vào. */
  suggestPaidAmount?: number;
  /** Đề xuất chi trả từ nhiều nguồn chi: số tiền từng nguồn. */
  suggestSources?: { cashAccount: string | null; amount: number }[];
};
