import api from "./api";
import type {
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseRequest,
  PaymentMethod,
  PaymentOrder,
} from "@/types/expenseRequest";

const BASE = "/expense-requests";

// Build a multipart body from a plain object.
// `file` -> single `file` field (create); `files` -> repeated `files` fields.
const buildFormData = (data: Record<string, any>) => {
  const fd = new FormData();

  Object.keys(data).forEach((key) => {
    if (key === "files" || key === "file") return;
    const value = data[key];
    if (value !== undefined && value !== null && value !== "") {
      fd.append(key, value as any);
    }
  });

  if (data.file instanceof File) fd.append("file", data.file);

  const files: File[] = data.files || [];
  files.forEach((file) => fd.append("files", file));

  return fd;
};

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

// Resolve an attachment/file url served by the backend into an absolute url.
export const resolveFileUrl = (fileUrl?: string) => {
  if (!fileUrl) return "";
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
};

export type CreateExpensePayload = {
  content: string; // tiêu đề/nội dung
  description?: string;
  amount: number;
  expectedPaymentDate: string;
  participants?: string; // thành phần tham gia
  schoolId: number; // trường liên quan (bắt buộc với phiếu mới)
  schoolYear: string; // năm học của trường (bắt buộc với phiếu mới)
  file?: File; // đề xuất chỉ đính kèm 1 file
};

export type PaymentOrderPayload = {
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
};

export const expenseRequestApi = {
  // ---- SALES: tạo (vào thẳng PENDING_APPROVAL) ----
  create: async (data: CreateExpensePayload): Promise<ExpenseRequest> => {
    const res = await api.post(BASE, buildFormData(data), multipart);
    return res.data;
  },

  // ---- DIRECTOR: approve / reject ----
  approve: async (id: number): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/approve`);
    return res.data;
  },

  reject: async (id: number, reason: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/reject`, { reason });
    return res.data;
  },

  // ---- KẾ TOÁN CÔNG NỢ: payment order (response bọc { suggest, paymentOrder }) ----
  createPaymentOrder: async (
    id: number,
    data: PaymentOrderPayload,
  ): Promise<{ suggest: ExpenseRequest; paymentOrder: PaymentOrder }> => {
    const res = await api.post(`${BASE}/${id}/payment-order`, data);
    return res.data;
  },

  // ---- THỦ QUỸ: cash released / fund returned ----
  cashReleased: async (
    id: number,
    data: { note?: string; files?: File[] },
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/cash-released`,
      buildFormData(data),
      multipart,
    );
    return res.data;
  },

  fundReturned: async (id: number, note?: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/fund-returned`, { note });
    return res.data;
  },

  // ---- SALES (chủ đề xuất): xác nhận ----
  cashReceived: async (id: number, note?: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/cash-received`, { note });
    return res.data;
  },

  confirmSpent: async (
    id: number,
    data: { note?: string; files?: File[] },
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/confirm-spent`,
      buildFormData(data),
      multipart,
    );
    return res.data;
  },

  confirmNotSpent: async (id: number, reason: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/confirm-not-spent`, { reason });
    return res.data;
  },

  // ---- QUERY ----
  list: async (query: ExpenseListQuery = {}): Promise<ExpenseListResponse> => {
    const res = await api.get(BASE, { params: query });
    return res.data;
  },

  getById: async (id: number): Promise<ExpenseRequest> => {
    const res = await api.get(`${BASE}/${id}`);
    return res.data;
  },

  myTasks: async (): Promise<ExpenseRequest[]> => {
    const res = await api.get(`${BASE}/my-tasks`);
    return res.data;
  },

  // ---- REMINDER SETTINGS ----
  getReminderSettings: async (): Promise<{ remindBeforeDays: number }> => {
    const res = await api.get(`${BASE}/reminder-settings`);
    return res.data;
  },

  updateReminderSettings: async (
    remindBeforeDays: number,
  ): Promise<{ remindBeforeDays: number }> => {
    const res = await api.patch(`${BASE}/reminder-settings`, { remindBeforeDays });
    return res.data;
  },
};

// EXPENSE_REQUEST notifications (uses the shared /notifications endpoint).
export const expenseNotificationApi = {
  getAll: async (page = 1, limit = 20, tab?: "unread" | "read") => {
    const res = await api.get(`/notifications`, {
      params: { type: "EXPENSE_REQUEST", page, limit, tab },
    });
    return res.data;
  },
};
