import api from "./api";
import type {
  CashflowDirection,
  OrderKind,
  OtherCashflowDetail,
  OtherCashflowEntry,
  OtherCashflowForm,
  OtherCashflowInput,
  OtherCashflowListResponse,
  OtherCashflowStatus,
} from "@/types/otherCashflow";

const BASE = "/other-cashflows";

export type OtherCashflowListQuery = {
  status?: OtherCashflowStatus | "";
  form?: OtherCashflowForm | "";
  search?: string;
  page?: number;
  limit?: number;
};

/** Thu trên tổng phải thu (`IN`) hoặc chi một khoản chi (`OUT` + `costId`). */
export type RecordEntryPayload = {
  flow: CashflowDirection;
  costId?: number;
  date: string;
  amount: number;
  cashAccountCode: string;
  note?: string;
  idempotencyKey: string;
};

/** Bỏ tham số rỗng để backend không phải xử lý "" như một giá trị lọc. */
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );

export const otherCashflowApi = {
  list: async (query: OtherCashflowListQuery) =>
    (await api.get<OtherCashflowListResponse>(BASE, { params: clean(query) })).data,

  get: async (id: number) => (await api.get<OtherCashflowDetail>(`${BASE}/${id}`)).data,

  create: async (payload: OtherCashflowInput) =>
    (await api.post<OtherCashflowDetail>(BASE, payload)).data,

  update: async (id: number, payload: Partial<OtherCashflowInput>) =>
    (await api.patch<OtherCashflowDetail>(`${BASE}/${id}`, payload)).data,

  cancel: async (id: number, reason: string) =>
    (await api.post<OtherCashflowDetail>(`${BASE}/${id}/cancel`, { reason })).data,

  review: async (id: number, decision: "APPROVED" | "REJECTED", note?: string) =>
    (await api.post<OtherCashflowDetail>(`${BASE}/${id}/review`, { decision, note })).data,

  recordEntry: async (id: number, payload: RecordEntryPayload) =>
    (await api.post<OtherCashflowEntry>(`${BASE}/${id}/entries`, payload)).data,

  /** Kế toán công nợ lập phiếu thu / lệnh chi (đơn Thương mại). */
  createOrder: async (
    id: number,
    payload: { kind: OrderKind; costId?: number; amount: number; dueDate?: string | null; note?: string },
  ) => (await api.post<OtherCashflowDetail>(`${BASE}/${id}/orders`, payload)).data,

  cancelOrder: async (id: number, orderId: number, reason: string) =>
    (await api.post<OtherCashflowDetail>(`${BASE}/${id}/orders/${orderId}/cancel`, { reason })).data,

  /** Thủ quỹ thu/chi theo phiếu — số tiền đúng bằng phiếu. */
  executeOrder: async (
    id: number,
    orderId: number,
    payload: { date: string; cashAccountCode: string; note?: string; idempotencyKey: string },
  ) => (await api.post<OtherCashflowEntry>(`${BASE}/${id}/orders/${orderId}/execute`, payload)).data,

  voidEntry: async (id: number, entryId: number, reason: string) =>
    (await api.post<OtherCashflowDetail>(`${BASE}/${id}/entries/${entryId}/void`, { reason })).data,

  uploadAttachments: async (id: number, files: File[], entryId?: number) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (entryId) form.append("entryId", String(entryId));
    return (await api.post<OtherCashflowDetail>(`${BASE}/${id}/attachments`, form)).data;
  },

  attachmentBlob: async (id: number, attachmentId: number) =>
    (
      await api.get<Blob>(`${BASE}/${id}/attachments/${attachmentId}/file`, {
        responseType: "blob",
      })
    ).data,

  removeAttachment: async (id: number, attachmentId: number) =>
    (await api.delete<OtherCashflowDetail>(`${BASE}/${id}/attachments/${attachmentId}`)).data,
};
