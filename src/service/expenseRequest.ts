import api from "./api";
import type {
  ExpenseGroupedByEmployeeResponse,
  ExpenseNotificationGroupedResponse,
  ExpenseNotificationListResponse,
  ExpenseNotificationQuery,
  ExpenseNotificationSummary,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseRequest,
  PaymentMethod,
  PaymentOrder,
  SaleAdminReviewStatus,
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

  // ---- SALES ADMIN: kiểm duyệt song song (cố vấn, không chặn giám đốc) ----
  saleAdminReview: async (
    id: number,
    data: { status: SaleAdminReviewStatus; note?: string },
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/sale-admin-review`, data);
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

  // Danh sách gom nhóm theo nhân viên (page/limit phân trang theo nhân viên).
  groupedByEmployee: async (
    query: ExpenseListQuery = {},
  ): Promise<ExpenseGroupedByEmployeeResponse> => {
    const res = await api.get(`${BASE}/grouped-by-employee`, { params: query });
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

// EXPENSE_REQUEST notifications (dedicated bell/page endpoints).
export const expenseNotificationApi = {
  getSummary: async (): Promise<ExpenseNotificationSummary> => {
    const res = await api.get(`/notifications/expense/summary`);
    return res.data;
  },

  getGroupedByEmployee: async (
    query: ExpenseNotificationQuery = {},
  ): Promise<ExpenseNotificationGroupedResponse> => {
    const res = await api.get(`/notifications/expense/grouped-by-employee`, {
      params: query,
    });
    return res.data;
  },

  getAll: async (
    page = 1,
    limit = 20,
    tab?: "unread" | "read",
    query: ExpenseNotificationQuery = {},
  ): Promise<ExpenseNotificationListResponse> => {
    const res = await api.get(`/notifications/expense`, {
      params: { ...query, page, limit, tab },
    });
    return res.data;
  },

  markAsRead: async (id: number): Promise<{ success: boolean }> => {
    const res = await api.patch(`/notifications/expense/${id}/read`);
    return res.data;
  },

  markAllAsRead: async (
    query: Pick<ExpenseNotificationQuery, "scope" | "employeeId"> = {},
  ): Promise<{ success: boolean }> => {
    const res = await api.patch(`/notifications/expense/read-all`, undefined, {
      params: query,
    });
    return res.data;
  },
};
