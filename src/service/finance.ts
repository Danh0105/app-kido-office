import api from "./api";
import type {
  AvailableAdvance,
  FinanceBalanceRow,
  FinanceConfigOverview,
  FinanceDeductionRow,
  FinanceDelegation,
  FinanceDetail,
  FinanceListQuery,
  FinanceListResponse,
  FinanceMeta,
  FinanceRequestInput,
  FinanceSummary,
  SalaryAdvanceCheck,
  WorkflowStepInput,
} from "@/types/finance";

const BASE = "/financial-requests";

/** Bỏ tham số rỗng để backend không phải xử lý "" như một giá trị lọc. */
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );

/** Khoá chống gửi lặp cho thao tác ghi nhận tiền. */
export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type MoneyMovementPayload = {
  amount: number;
  date: string;
  method: "BANK_TRANSFER" | "CASH";
  cashAccountCode?: string;
  transactionRef?: string;
  note?: string;
  idempotencyKey: string;
};

export const financeApi = {
  meta: async () => (await api.get<FinanceMeta>(`${BASE}/meta`)).data,

  managers: async (companyId: number) =>
    (await api.get<{ id: number; name: string }[]>(`${BASE}/managers`, { params: { companyId } })).data,

  list: async (query: FinanceListQuery) =>
    (await api.get<FinanceListResponse>(BASE, { params: clean(query) })).data,

  get: async (id: number) => (await api.get<FinanceDetail>(`${BASE}/${id}`)).data,

  create: async (payload: FinanceRequestInput) =>
    (await api.post<FinanceDetail>(BASE, payload)).data,

  update: async (id: number, payload: FinanceRequestInput) =>
    (await api.patch<FinanceDetail>(`${BASE}/${id}`, payload)).data,

  remove: async (id: number) => (await api.delete(`${BASE}/${id}`)).data,

  copy: async (id: number) => (await api.post<FinanceDetail>(`${BASE}/${id}/copy`)).data,

  submit: async (id: number) => (await api.post<FinanceDetail>(`${BASE}/${id}/submit`)).data,

  withdraw: async (id: number, reason?: string) =>
    (await api.post<FinanceDetail>(`${BASE}/${id}/withdraw`, { reason })).data,

  approve: async (
    id: number,
    payload: {
      stepId: number;
      comment?: string;
      adjustments?: { itemId: number; approvedAmount: number; reason?: string }[];
    },
  ) => (await api.post<FinanceDetail>(`${BASE}/${id}/approve`, payload)).data,

  reject: async (id: number, stepId: number, comment: string) =>
    (await api.post<FinanceDetail>(`${BASE}/${id}/reject`, { stepId, comment })).data,

  returnForChanges: async (id: number, stepId: number, comment: string) =>
    (await api.post<FinanceDetail>(`${BASE}/${id}/return`, { stepId, comment })).data,

  skipStep: async (id: number, stepId: number, reason: string) =>
    (await api.post<FinanceDetail>(`${BASE}/${id}/steps/${stepId}/skip`, { reason })).data,

  cancel: async (id: number, reason: string) =>
    (await api.post<FinanceDetail>(`${BASE}/${id}/cancel`, { reason })).data,

  pdf: async (id: number, disposition: "inline" | "attachment" = "inline") =>
    (
      await api.get<Blob>(`${BASE}/${id}/pdf`, {
        params: { disposition },
        responseType: "blob",
      })
    ).data,

  uploadAttachments: async (
    id: number,
    files: File[],
    options: { kind?: string; itemId?: number; paymentId?: number; refundId?: number } = {},
  ) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    return (await api.post<FinanceDetail>(`${BASE}/${id}/attachments`, form)).data;
  },

  attachmentBlob: async (id: number, attachmentId: number) =>
    (
      await api.get<Blob>(`${BASE}/${id}/attachments/${attachmentId}/file`, {
        responseType: "blob",
      })
    ).data,

  removeAttachment: async (id: number, attachmentId: number) =>
    (await api.delete<FinanceDetail>(`${BASE}/${id}/attachments/${attachmentId}`)).data,

  recordPayment: async (id: number, payload: MoneyMovementPayload) =>
    (await api.post(`${BASE}/${id}/payments`, payload)).data as { id: number },

  voidPayment: async (id: number, paymentId: number, reason: string) =>
    (await api.post(`${BASE}/${id}/payments/${paymentId}/void`, { reason })).data,

  recordRefund: async (id: number, payload: MoneyMovementPayload) =>
    (await api.post(`${BASE}/${id}/refunds`, payload)).data as { id: number },

  voidRefund: async (id: number, refundId: number, reason: string) =>
    (await api.post(`${BASE}/${id}/refunds/${refundId}/void`, { reason })).data,

  confirmDeduction: async (
    id: number,
    deductionId: number,
    payload: { amount?: number; note?: string; idempotencyKey: string },
  ) => (await api.post(`${BASE}/${id}/deductions/${deductionId}/confirm`, payload)).data,

  availableAdvances: async (companyId: number, excludeSettlementId?: number) =>
    (
      await api.get<AvailableAdvance[]>(`${BASE}/advances/available`, {
        params: clean({ companyId, excludeSettlementId }),
      })
    ).data,

  salaryAdvanceCheck: async (params: {
    companyId: number;
    year: number;
    month: number;
    excludeRequestId?: number;
  }) =>
    (await api.get<SalaryAdvanceCheck>(`${BASE}/salary-advances/check`, { params: clean(params) })).data,

  deductions: async (params: {
    companyId?: number | "";
    employeeId?: number | "";
    year?: number | "";
    month?: number | "";
    status?: string;
  }) =>
    (await api.get<FinanceDeductionRow[]>(`${BASE}/salary-advances/deductions`, { params: clean(params) })).data,

  balances: async (params: { companyId?: number | ""; employeeId?: number | "" }) =>
    (
      await api.get<{
        rows: FinanceBalanceRow[];
        totals: Omit<FinanceBalanceRow, "employeeId" | "employeeName" | "departmentName" | "overdueCount">;
      }>(`${BASE}/balances`, { params: clean(params) })
    ).data,

  summary: async (params: Record<string, unknown>) =>
    (await api.get<FinanceSummary>(`${BASE}/reports/summary`, { params: clean(params) })).data,

  exportExcel: async (query: FinanceListQuery) =>
    (
      await api.get<Blob>(`${BASE}/export/excel`, {
        params: clean(query),
        responseType: "blob",
      })
    ).data,

  companyLogo: async (companyId: number) =>
    (await api.get<Blob>(`${BASE}/companies/${companyId}/logo`, { responseType: "blob" })).data,

  myDelegations: async () =>
    (
      await api.get<{ delegations: FinanceDelegation[]; employees: { id: number; name: string }[] }>(
        `${BASE}/delegations/mine`,
      )
    ).data,

  createDelegation: async (payload: {
    delegatorId?: number;
    delegateId: number;
    companyId?: number | null;
    requestType?: string | null;
    startsAt: string;
    endsAt: string;
    reason?: string | null;
  }) => (await api.post<FinanceDelegation>(`${BASE}/delegations`, payload)).data,

  revokeDelegation: async (id: number) =>
    (await api.post(`${BASE}/delegations/${id}/revoke`)).data,

  // ---- Thông báo của phân hệ (dùng API thông báo chung, lọc theo loại) ----
  notifications: async (page = 1, limit = 10) =>
    (
      await api.get("/notifications", {
        params: { type: "FINANCIAL_REQUEST", page, limit },
      })
    ).data as { data?: any[]; items?: any[] } | any[],

  markNotificationRead: async (id: number) =>
    (await api.patch(`/notifications/${id}/read`)).data,
};

export const financeConfigApi = {
  overview: async () => (await api.get<FinanceConfigOverview>(`${BASE}/config`)).data,

  createCompany: async (payload: Record<string, unknown>) =>
    (await api.post(`${BASE}/config/companies`, payload)).data,

  updateCompany: async (id: number, payload: Record<string, unknown>) =>
    (await api.patch(`${BASE}/config/companies/${id}`, payload)).data,

  uploadLogo: async (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post(`${BASE}/config/companies/${id}/logo`, form)).data;
  },

  createCategory: async (payload: Record<string, unknown>) =>
    (await api.post(`${BASE}/config/categories`, payload)).data,

  updateCategory: async (id: number, payload: Record<string, unknown>) =>
    (await api.patch(`${BASE}/config/categories/${id}`, payload)).data,

  createWorkflow: async (payload: Record<string, unknown> & { steps: WorkflowStepInput[] }) =>
    (await api.post(`${BASE}/config/workflows`, payload)).data,

  updateWorkflow: async (
    id: number,
    payload: Record<string, unknown> & { steps: WorkflowStepInput[] },
  ) => (await api.patch(`${BASE}/config/workflows/${id}`, payload)).data,

  createAssignment: async (payload: Record<string, unknown>) =>
    (await api.post(`${BASE}/config/assignments`, payload)).data,

  removeAssignment: async (id: number) =>
    (await api.delete(`${BASE}/config/assignments/${id}`)).data,

  savePolicy: async (payload: Record<string, unknown>) =>
    (await api.put(`${BASE}/config/policies`, payload)).data,
};
