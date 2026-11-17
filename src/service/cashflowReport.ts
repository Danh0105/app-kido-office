import api from "./api";

/**
 * Báo cáo tổng hợp thu chi — backend tính toàn bộ (số tiền về dạng chuỗi
 * "1234.00" để không mất độ chính xác); giao diện chỉ hiển thị.
 */

export type AccountType = "all" | "cash" | "bank";

export type CashflowFilters = {
  from: string;
  to: string;
  accountType?: AccountType;
  accountCode?: string;
  search?: string;
  excludeInternal?: boolean;
};

export type CashflowSummary = {
  range: { from: string; to: string };
  excludeInternal: boolean;
  /** null khi còn tài khoản trong phạm vi chưa có số dư gốc */
  openingTotal: string | null;
  closingTotal: string | null;
  verifiedOpeningTotal: string;
  verifiedClosingTotal: string;
  receipts: string;
  payments: string;
  voucherCount: number;
  unverifiedAccounts: string[];
  issueCount: number;
  warningCount: number;
};

export type CashAccountRow = {
  code: string;
  name: string;
  groupCode: "111" | "112";
  sortOrder: number;
  isActive: boolean;
  /** Số dư gốc đã đối chiếu, tại đầu ngày anchorDate */
  anchorBalance: string | null;
  anchorDate: string | null;
  opening: string | null;
  receipts: string;
  payments: string;
  closing: string | null;
  lineCount: number;
};

export type CashAccountGroup = {
  groupCode: "111" | "112";
  name: string;
  accounts: CashAccountRow[];
  subtotal: {
    opening: string | null;
    receipts: string;
    payments: string;
    closing: string | null;
    unverifiedAccounts: string[];
  };
};

export type LedgerSource = {
  type:
    | "INVOICE"
    | "SCHOOL_EXPENSE"
    | "MANAGEMENT_EXPENSE"
    /** Lương Giáo viên trường (bảng dưới Chi Ngoài, từ kỳ 11/2026). */
    | "SCHOOL_TEACHER"
    | "EXPENSE_REQUEST"
    | "FINANCIAL_REQUEST"
    | "OTHER_CASHFLOW"
    | "MANUAL_ENTRY"
    | "DAY_CLOSING";
  schoolExpenseId?: number;
  subjectId?: number | null;
  rowIndex?: number;
  /** Dòng Hóa Đơn / Chi Trường / Chi Ngoài (id trong bảng nguồn). */
  itemId?: number;
  suggestId?: number;
  requestId?: number;
  otherCashflowId?: number;
  /** Bút toán nhập tay — sửa/xoá ngay trên báo cáo. */
  manualEntryId?: number;
};

export type LedgerRow = {
  key: string;
  postingDate: string;
  documentDate: string | null;
  documentNo: string;
  invoiceNo: string | null;
  description: string;
  accountCode: string;
  receipt: string;
  payment: string;
  partnerCode: string | null;
  partnerName: string | null;
  isInternalTransfer: boolean;
  source: LedgerSource;
};

export type LedgerAccount = {
  code: string;
  name: string;
  isActive: boolean;
  opening: string | null;
  receipts: string;
  payments: string;
  closing: string | null;
};

export type LedgerResponse = {
  group: "111" | "112";
  title: string;
  range: { from: string; to: string };
  searchActive: boolean;
  accounts: LedgerAccount[];
  rows: LedgerRow[];
  page: number;
  limit: number;
  totalRows: number;
};

export type CashflowIssue = {
  key: string;
  kind: string;
  message: string;
  warningOnly: boolean;
  date: string | null;
  amount: string | null;
  accountCode: string | null;
  documentNo: string;
  description: string;
  source: LedgerSource;
};

export type UpdateCashAccountPayload = {
  name?: string;
  sortOrder?: number;
  openingBalance?: string | null;
  openingBalanceDate?: string | null;
  isActive?: boolean;
  note?: string | null;
};

export type CreateCashAccountPayload = Omit<UpdateCashAccountPayload, "name"> & {
  /** 111… (tiền mặt) hoặc 112… (ngân hàng) — nhóm suy từ đầu mã. */
  code: string;
  name: string;
};

/** IN = thu, OUT = chi, TRANSFER = chuyển nội bộ giữa hai tài khoản. */
export type ManualEntryKind = "IN" | "OUT" | "TRANSFER";

export type ManualEntryPayload = {
  kind: ManualEntryKind;
  entryDate: string;
  accountCode: string;
  counterAccountCode?: string | null;
  amount: string;
  documentNo?: string | null;
  description: string;
  partnerName?: string | null;
  note?: string | null;
};

export type ManualEntry = Required<ManualEntryPayload> & {
  id: number;
  displayDocumentNo: string;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
};

/** Xem trước khi xoá một dòng trên sổ: các khoản sẽ bị xoá (DELETE) hoặc gỡ khỏi sổ (UNPOST). */
export type SourceDeletionPlan = {
  type: LedgerSource["type"];
  id: number;
  mode: "DELETE" | "UNPOST";
  title: string;
  items: string[];
  warnings: string[];
  /** Không rỗng = không xoá được. */
  blockers: string[];
};

/** Số dư một tài khoản trong ngày chốt quỹ (null = chưa xác minh). */
export type DayClosingBalance = {
  code: string;
  name: string;
  groupCode: string;
  opening: string | null;
  receipts: string;
  payments: string;
  closing: string | null;
  lineCount: number;
};

export type DayClosing = {
  id: number;
  date: string;
  status: "CLOSED" | "REOPENED";
  /** MANUAL = bấm End of Day; AUTO = tự chốt sau 0h. */
  mode: "MANUAL" | "AUTO";
  closedByName: string | null;
  closedAt: string;
  reopenedByName: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  lineCount: number;
  totals: { receipts: string | null; payments: string | null; closing: string | null };
  balances: DayClosingBalance[];
};

export type DayClosingStatus = {
  today: string;
  /** Mọi ngày ≤ ngày này đã chốt quỹ (khoá trên sổ). */
  lockedThrough: string | null;
  todayClosed: boolean;
  latest: DayClosing | null;
};

const BASE = "/reports/cashflow";

const params = (filters: CashflowFilters, extra: Record<string, unknown> = {}) => {
  const result: Record<string, unknown> = { from: filters.from, to: filters.to, ...extra };
  if (filters.accountType && filters.accountType !== "all") result.accountType = filters.accountType;
  if (filters.accountCode) result.accountCode = filters.accountCode;
  if (filters.search?.trim()) result.search = filters.search.trim();
  if (filters.excludeInternal) result.excludeInternal = true;
  return result;
};

export const cashflowReportApi = {
  summary: async (filters: CashflowFilters): Promise<CashflowSummary> =>
    (await api.get(`${BASE}/summary`, { params: params(filters) })).data,

  accounts: async (
    filters: CashflowFilters,
  ): Promise<{ range: { from: string; to: string }; groups: CashAccountGroup[] }> =>
    (await api.get(`${BASE}/accounts`, { params: params(filters) })).data,

  ledger: async (
    group: "cash" | "bank",
    filters: CashflowFilters,
    page: number,
    limit: number,
  ): Promise<LedgerResponse> =>
    (await api.get(`${BASE}/${group}`, { params: params(filters, { page, limit }) })).data,

  issues: async (
    filters: CashflowFilters,
  ): Promise<{ range: { from: string; to: string }; issues: CashflowIssue[] }> =>
    (await api.get(`${BASE}/issues`, { params: params(filters) })).data,

  createAccount: async (payload: CreateCashAccountPayload) =>
    (await api.post(`${BASE}/accounts`, payload)).data,

  updateAccount: async (code: string, payload: UpdateCashAccountPayload) =>
    (await api.patch(`${BASE}/accounts/${encodeURIComponent(code)}`, payload)).data,

  deleteAccount: async (code: string) =>
    (await api.delete(`${BASE}/accounts/${encodeURIComponent(code)}`)).data,

  manualEntry: async (id: number): Promise<ManualEntry> =>
    (await api.get(`${BASE}/manual-entries/${id}`)).data,

  createManualEntry: async (payload: ManualEntryPayload): Promise<ManualEntry> =>
    (await api.post(`${BASE}/manual-entries`, payload)).data,

  updateManualEntry: async (id: number, payload: Partial<ManualEntryPayload>): Promise<ManualEntry> =>
    (await api.patch(`${BASE}/manual-entries/${id}`, payload)).data,

  deleteManualEntry: async (id: number) =>
    (await api.delete(`${BASE}/manual-entries/${id}`)).data,

  sourceDeletionPlan: async (type: LedgerSource["type"], id: number): Promise<SourceDeletionPlan> =>
    (await api.get(`${BASE}/sources/${type}/${id}/deletion`)).data,

  deleteSource: async (type: LedgerSource["type"], id: number): Promise<SourceDeletionPlan> =>
    (await api.delete(`${BASE}/sources/${type}/${id}`)).data,

  dayClosingStatus: async (): Promise<DayClosingStatus> =>
    (await api.get(`${BASE}/day-closings/status`)).data,

  /** Lịch sử chốt quỹ trong khoảng ngày, gồm cả các lần đã mở lại. */
  dayClosings: async (from: string, to: string): Promise<DayClosing[]> =>
    (await api.get(`${BASE}/day-closings`, { params: { from, to } })).data,

  /** Các ngày sẽ chốt (mặc định tới hết hôm nay) + số dư từng tài khoản. */
  dayClosingPreview: async (
    date?: string,
  ): Promise<{ lockedThrough: string | null; days: { date: string; balances: DayClosingBalance[] }[] }> =>
    (await api.get(`${BASE}/day-closings/preview`, { params: date ? { date } : {} })).data,

  /** End of Day: chốt quỹ hôm nay (và các ngày chưa chốt trước đó). */
  closeDay: async (date?: string): Promise<{ lockedThrough: string; closed: DayClosing[] }> =>
    (await api.post(`${BASE}/day-closings`, date ? { date } : {})).data,

  reopenDay: async (reason: string): Promise<{ reopened: DayClosing; lockedThrough: string | null }> =>
    (await api.post(`${BASE}/day-closings/reopen`, { reason })).data,

  /** Excel bám file mẫu — cùng bộ lọc, toàn bộ kết quả (không theo trang). */
  exportExcel: async (filters: CashflowFilters): Promise<Blob> =>
    (
      await api.get(`${BASE}/export`, {
        params: params(filters),
        responseType: "blob",
      })
    ).data,
};
