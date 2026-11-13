/** Hiển thị số tiền (backend trả chuỗi "1234.50"); null = chưa xác minh. */
export const formatMoney = (value: string | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** Ô Thu/Chi của sổ: 0 để trống cho dễ đọc như sổ giấy. */
export const formatCell = (value: string | null | undefined) =>
  value === null || value === undefined || Number(value) === 0
    ? ""
    : formatMoney(value);

/** YYYY-MM-DD → DD/MM/YYYY */
export const formatDate = (value: string | null | undefined) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export type PeriodMode = "range" | "month" | "quarter" | "year";

const pad = (value: number) => String(value).padStart(2, "0");

const lastDayOfMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Ngày hôm nay theo giờ Việt Nam (ngày hạch toán của hệ thống). */
export const todayVN = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function periodRange(
  mode: Exclude<PeriodMode, "range">,
  year: number,
  index: number,
): { from: string; to: string } {
  if (mode === "year") {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const startMonth = mode === "quarter" ? (index - 1) * 3 + 1 : index;
  const endMonth = mode === "quarter" ? startMonth + 2 : index;
  return {
    from: `${year}-${pad(startMonth)}-01`,
    to: `${year}-${pad(endMonth)}-${pad(lastDayOfMonth(year, endMonth))}`,
  };
}

export const ISSUE_KIND_LABELS: Record<string, string> = {
  MISSING_ACCOUNT: "Chưa chọn tài khoản",
  MISSING_DATE: "Thiếu ngày",
  MISSING_AMOUNT: "Thiếu số tiền",
  MISSING_DIRECTION: "Chưa chọn Thu/Chi",
  UNKNOWN_ACCOUNT: "Sai mã tài khoản",
  GROUP_ONLY: "Chỉ có nhóm nguồn tiền",
  RECEIPT_NOT_POSTED: "Đã thu chưa ghi tài khoản",
  SUPERSEDED_RELEASE: "Xuất tiền bị thay thế",
  DUPLICATE: "Bản ghi trùng",
  SUSPICIOUS_AMOUNT: "Số tiền bất thường",
  CLOSED_DAY_CHANGED: "Ngày đã chốt bị đổi",
};

/** Ngày kế tiếp (YYYY-MM-DD). */
export const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Dòng nguồn xoá được từ sổ: (loại, id chứng từ / dòng gốc). */
export const deletableSource = (source: {
  type: string;
  requestId?: number;
  suggestId?: number;
  otherCashflowId?: number;
  manualEntryId?: number;
  itemId?: number;
}) => {
  const id =
    source.type === "FINANCIAL_REQUEST"
      ? source.requestId
      : source.type === "EXPENSE_REQUEST"
        ? source.suggestId
        : source.type === "OTHER_CASHFLOW"
          ? source.otherCashflowId
          : source.type === "MANUAL_ENTRY"
            ? source.manualEntryId
            : source.itemId;
  return id ? { type: source.type, id } : null;
};

/** Đường dẫn tuyệt đối theo gốc app (HashRouter) tới chứng từ gốc để mở xem. */
export const sourceHref = (source: {
  type: string;
  schoolExpenseId?: number;
  suggestId?: number;
  requestId?: number;
  otherCashflowId?: number;
}) => {
  if (source.type === "FINANCIAL_REQUEST" && source.requestId) {
    return `/#/director/finance/requests/${source.requestId}`;
  }
  if (source.type === "EXPENSE_REQUEST" && source.suggestId) {
    return `/#/director/expense-requests/${source.suggestId}`;
  }
  if (source.type === "OTHER_CASHFLOW" && source.otherCashflowId) {
    return `/#/director/other-cashflows?contract=${source.otherCashflowId}`;
  }
  if (source.schoolExpenseId) {
    return `/#/director/real-expense-detail/${source.schoolExpenseId}`;
  }
  return null;
};
