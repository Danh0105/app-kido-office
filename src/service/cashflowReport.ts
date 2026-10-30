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
  type: "INVOICE" | "SCHOOL_EXPENSE" | "MANAGEMENT_EXPENSE" | "EXPENSE_REQUEST" | "FINANCIAL_REQUEST";
  schoolExpenseId?: number;
  subjectId?: number | null;
  rowIndex?: number;
  suggestId?: number;
  financialRequestId?: number;
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
  openingBalance?: string | null;
  openingBalanceDate?: string | null;
  isActive?: boolean;
  note?: string | null;
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

  updateAccount: async (code: string, payload: UpdateCashAccountPayload) =>
    (await api.patch(`${BASE}/accounts/${encodeURIComponent(code)}`, payload)).data,

  /** Excel bám file mẫu — cùng bộ lọc, toàn bộ kết quả (không theo trang). */
  exportExcel: async (filters: CashflowFilters): Promise<Blob> =>
    (
      await api.get(`${BASE}/export`, {
        params: params(filters),
        responseType: "blob",
      })
    ).data,
};
