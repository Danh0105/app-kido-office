import api from "./api";
import type {
  CashflowItemsResponse,
  CashflowSource,
  ExpenseCashflowItemsResponse,
  ManagementExpenseSection,
  ExpenseGroupedByEmployeeResponse,
  ExpenseNotificationGroupedResponse,
  ExpenseNotificationListResponse,
  ExpenseNotificationQuery,
  ExpenseNotificationSummary,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseRequest,
  EquipmentSource,
  ExpenseRequestKind,
  PaymentMethod,
  PaymentOrder,
  PolicySupport,
  SaleAdminReviewStatus,
  StockInItem,
  StockInOrder,
  StockIssueItem,
  StockIssueOrder,
} from "@/types/expenseRequest";

const BASE = "/expense-requests";

// Build a multipart body from a plain object.
// `file` -> single `file` field (create); `files` -> repeated `files` fields.
const buildFormData = (data: Record<string, any>) => {
  const fd = new FormData();

  Object.keys(data).forEach((key) => {
    if (key === "files" || key === "file") return;
    const value = data[key];
    if (value === undefined || value === null || value === "") return;
    // Mảng/đối tượng (VD: `items` của đề xuất thiết bị) phải gửi dạng JSON —
    // multer/class-transformer parse lại bằng JSON.parse ở BE.
    fd.append(key, typeof value === "object" ? JSON.stringify(value) : value);
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
  expectedPaymentDate: string;
  participants?: string; // thành phần tham gia
  /** Có trường = đề xuất theo trường; để trống = đề xuất theo xã/phường. */
  schoolId?: number;
  schoolYear?: string;
  /** Chi tháng gửi danh sách trường ở `monthlyItems` (gửi dạng JSON). */
  isMonthlyExpense?: boolean;
  /** Bảng nguồn: Chi Ngoài (mặc định) / Chi Trường / GV trường. */
  cashflowSource?: CashflowSource;
  subjectId?: number;
  /** Chi Ngoài / Chi Trường / Chi GV trường: kỳ đã có của trường... */
  expensePeriodId?: number;
  /** ...hoặc tạo kỳ tháng mới (1–12) + năm cho trường. */
  periodMonth?: number;
  periodYear?: number;
  monthlyItems?: {
    schoolId: number;
    schoolYear?: string;
    /** Chi Ngoài / Chi Trường. */
    subjectId?: number;
    expensePeriodId: number;
    /** Chi GV trường. */
    schoolTeacherId?: number;
  }[];
  wardId?: number;
  /** Kinh doanh tự đánh dấu: đề xuất này nên trừ vào chính sách liên quan (chỉ để hiển thị). */
  deductPolicy?: boolean;
  file?: File; // đề xuất chỉ đính kèm 1 file
};

/** Sửa đề xuất đã gửi duyệt — trường bỏ trống giữ nguyên. */
export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export type PaymentOrderPayload = {
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
};

/**
 * Giám đốc/Sales Admin có thể chốt lại số tiền, loại đề xuất và chỉ định nhân
 * viên phòng kỹ thuật phụ trách ngay khi duyệt. Loại là bắt buộc vì nhân viên
 * không còn chọn loại lúc tạo đề xuất.
 */
export type ApproveExpensePayload = {
  amount?: number;
  /** Chi tháng đã cố định là CASH nên Giám đốc không cần gửi lại loại. */
  requestKind?: ExpenseRequestKind;
  /** Người bàn giao — chỉ khi requestKind là EQUIPMENT (lấy từ kho) hoặc REPAIR. */
  assignedTechnicianId?: number;
  /** Người hỗ trợ người bàn giao; bỏ trống = không có người hỗ trợ. */
  supporterIds?: number[];
  /** Ghi chú chung của Giám đốc/Sales Admin khi duyệt (không bắt buộc). */
  note?: string;
  /** Chi tháng: các dòng trường được duyệt; bỏ trống = duyệt tất cả. */
  approvedItemIds?: number[];
  /** Nguồn thiết bị khi requestKind = EQUIPMENT; bỏ trống = kho. */
  equipmentSource?: EquipmentSource;
  // --- chỉ khi equipmentSource = SUPPLIER ---
  /** Phiếu nhập kho dự kiến — tối thiểu 1 dòng. */
  stockInItems?: StockInItem[];
  stockInNote?: string;
  /** Nhân viên xử lý phiếu nhập kho. */
  stockInHandlerId?: number;
  /** Người nghiệm thu bàn giao — khác người xử lý. */
  acceptorId?: number;
};

export type StockInReceiptPayload = {
  items: StockInItem[];
  note?: string;
};

export type StockIssueOrderPayload = {
  /** Tối thiểu 1 dòng; mỗi dòng cần `name` và `quantity` nguyên > 0. */
  items: StockIssueItem[];
  warehouse?: string;
  /** YYYY-MM-DD */
  expectedDeliveryDate?: string;
  note?: string;
};

export const expenseRequestApi = {
  // ---- SALES: chi Năm chờ duyệt; chi tháng chờ Kế toán nhập số tiền ----
  create: async (data: CreateExpensePayload): Promise<ExpenseRequest> => {
    const res = await api.post(BASE, buildFormData(data), multipart);
    return res.data;
  },

  // ---- SALES: chủ đơn sửa ở mọi trạng thái; lưu xong luôn gửi duyệt lại từ đầu ----
  update: async (
    id: number,
    data: UpdateExpensePayload
  ): Promise<ExpenseRequest> => {
    const res = await api.patch(
      `${BASE}/${id}`,
      buildFormData(data),
      multipart
    );
    return res.data;
  },

  // ---- DIRECTOR: approve / reject ----
  approve: async (
    id: number,
    data?: ApproveExpensePayload
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/approve`, data || {});
    return res.data;
  },

  // ---- Quy trình Kế toán: Chi Ngoài / Chi Trường / Chi GV trường ----
  /** Kế toán nhập xong số liệu bảng ở QL thu chi: chốt số tiền, gửi Kế toán trưởng. */
  submitToChief: async (id: number, note?: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/submit-to-chief`, { note });
    return res.data;
  },

  chiefApprove: async (id: number, note?: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/chief-approve`, { note });
    return res.data;
  },

  chiefReject: async (id: number, reason: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/chief-reject`, { reason });
    return res.data;
  },

  /** Hỗ trợ tiền mặt / thiết bị trong chính sách đã duyệt của trường (Chi Năm). */
  policySupport: async (
    schoolId: number,
    schoolYear: string
  ): Promise<PolicySupport> => {
    const res = await api.get(`${BASE}/policy-support`, {
      params: { schoolId, schoolYear },
    });
    return res.data;
  },

  reject: async (id: number, reason: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/reject`, { reason });
    return res.data;
  },

  // ---- SALES: chủ đơn tự rút khi còn chờ Kế toán hoặc chờ duyệt ----
  withdraw: async (id: number, reason?: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/withdraw`, { reason });
    return res.data;
  },

  // ---- DIRECTOR: xoá hẳn đề xuất — chỉ khi chưa phát sinh dòng tiền ----
  remove: async (id: number): Promise<{ message: string }> => {
    const res = await api.delete(`${BASE}/${id}`);
    return res.data;
  },

  // ---- SALES ADMIN: kiểm duyệt song song (cố vấn, không chặn giám đốc) ----
  saleAdminReview: async (
    id: number,
    data: { status: SaleAdminReviewStatus; note?: string }
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/sale-admin-review`, data);
    return res.data;
  },

  // ---- KẾ TOÁN CÔNG NỢ: payment order (response bọc { suggest, paymentOrder }) ----
  createPaymentOrder: async (
    id: number,
    data: PaymentOrderPayload
  ): Promise<{ suggest: ExpenseRequest; paymentOrder: PaymentOrder }> => {
    const res = await api.post(`${BASE}/${id}/payment-order`, data);
    return res.data;
  },

  // ---- KẾ TOÁN CÔNG NỢ: sửa lệnh chi đã lập — các bước sau phải làm lại ----
  editPaymentOrder: async (
    id: number,
    data: PaymentOrderPayload
  ): Promise<{ suggest: ExpenseRequest; paymentOrder: PaymentOrder }> => {
    const res = await api.post(`${BASE}/${id}/payment-order/edit`, data);
    return res.data;
  },

  // ---- Xoá 1 tệp đính kèm đã up (VD gỡ chứng từ up nhầm trước khi nộp) ----
  deleteAttachment: async (id: number, attachmentId: number): Promise<void> => {
    await api.delete(`${BASE}/${id}/attachments/${attachmentId}`);
  },

  // ---- PHÒNG KỸ THUẬT: lệnh xuất kho / nhận lại thiết bị ----
  // Lập lệnh khi đang ở EQUIPMENT_RETURNED sẽ THAY lệnh cũ (quan hệ 1-1),
  // timeline vẫn giữ đủ lịch sử.
  createStockIssueOrder: async (
    id: number,
    data: StockIssueOrderPayload
  ): Promise<{ suggest: ExpenseRequest; stockIssueOrder: StockIssueOrder }> => {
    const res = await api.post(`${BASE}/${id}/stock-issue-order`, data);
    return res.data;
  },

  equipmentReturned: async (
    id: number,
    note?: string
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/equipment-returned`, { note });
    return res.data;
  },

  // ---- THIẾT BỊ TỪ NHÀ CUNG CẤP: người xử lý (do Giám đốc chỉ định) lập phiếu nhập kho ----
  createStockInReceipt: async (
    id: number,
    data: StockInReceiptPayload
  ): Promise<{ suggest: ExpenseRequest; stockInOrder: StockInOrder }> => {
    const res = await api.post(`${BASE}/${id}/stock-in-receipt`, data);
    return res.data;
  },

  // ---- THIẾT BỊ TỪ NHÀ CUNG CẤP: người nghiệm thu xác nhận hoàn thành → về QL thu chi ----
  stockInAccept: async (
    id: number,
    data: { note?: string; files?: File[] }
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/stock-in-accept`,
      buildFormData(data),
      multipart
    );
    return res.data;
  },

  // ---- NGƯỜI BÀN GIAO / NGƯỜI HỖ TRỢ: từ chối việc được giao, lý do về Giám đốc ----
  declineAssignment: async (
    id: number,
    reason: string
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/assignments/decline`, { reason });
    return res.data;
  },

  // ---- GIÁM ĐỐC/SALES ADMIN: chọn người thay thế cho người đã từ chối ----
  replaceAssignment: async (
    id: number,
    assignmentId: number,
    employeeId: number
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/assignments/${assignmentId}/replace`,
      { employeeId }
    );
    return res.data;
  },

  // ---- PHÒNG KỸ THUẬT: phản hồi đề xuất sửa chữa ----
  repairAccept: async (id: number): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/repair-accept`);
    return res.data;
  },

  repairReject: async (id: number, reason: string): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/repair-reject`, { reason });
    return res.data;
  },

  // ---- GIÁM ĐỐC/SALES ADMIN: chỉ định người khác sau khi bị từ chối ----
  repairReassign: async (
    id: number,
    assignedTechnicianId: number
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/repair-reassign`, {
      assignedTechnicianId,
    });
    return res.data;
  },

  // ---- SALES (chủ đề xuất): xác nhận đã nhận thiết bị ----
  equipmentReceived: async (
    id: number,
    note?: string
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/equipment-received`, { note });
    return res.data;
  },

  // ---- THỦ QUỸ: cash released / fund returned ----
  cashReleased: async (
    id: number,
    data: { cashAccount: string; note?: string; files?: File[] }
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/cash-released`,
      buildFormData(data),
      multipart
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
    data: { note?: string; files?: File[] }
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/confirm-spent`,
      buildFormData(data),
      multipart
    );
    return res.data;
  },

  /** Chi tháng nhiều trường: chọn trường đã chi, phần dư hoàn quỹ. */
  confirmPartiallySpent: async (
    id: number,
    data: { spentItemIds: number[]; reason: string; files?: File[] }
  ): Promise<ExpenseRequest> => {
    const res = await api.post(
      `${BASE}/${id}/confirm-partially-spent`,
      buildFormData(data),
      multipart
    );
    return res.data;
  },

  remainderReturned: async (
    id: number,
    note?: string
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/remainder-returned`, { note });
    return res.data;
  },

  confirmNotSpent: async (
    id: number,
    reason: string
  ): Promise<ExpenseRequest> => {
    const res = await api.post(`${BASE}/${id}/confirm-not-spent`, { reason });
    return res.data;
  },

  // Tắt/bật nhắc quá hạn cho riêng đề xuất này — không ảnh hưởng đề xuất khác.
  muteOverdueAlert: async (
    id: number
  ): Promise<{ id: number; overdueAlertMuted: boolean }> => {
    const res = await api.post(`${BASE}/${id}/mute-overdue-alert`);
    return res.data;
  },

  unmuteOverdueAlert: async (
    id: number
  ): Promise<{ id: number; overdueAlertMuted: boolean }> => {
    const res = await api.post(`${BASE}/${id}/unmute-overdue-alert`);
    return res.data;
  },

  // ---- QUERY ----
  list: async (query: ExpenseListQuery = {}): Promise<ExpenseListResponse> => {
    const res = await api.get(BASE, { params: query });
    return res.data;
  },

  // Danh sách gom nhóm theo nhân viên (page/limit phân trang theo nhân viên).
  groupedByEmployee: async (
    query: ExpenseListQuery = {}
  ): Promise<ExpenseGroupedByEmployeeResponse> => {
    const res = await api.get(`${BASE}/grouped-by-employee`, { params: query });
    return res.data;
  },

  getById: async (id: number): Promise<ExpenseRequest> => {
    const res = await api.get(`${BASE}/${id}`);
    return res.data;
  },

  /**
   * Màn tạo đề xuất Chi Ngoài / Chi Trường / Chi GV trường: khoản ở các trường
   * mình phụ trách kèm Phải chi / Đã chi / Còn lại / trạng thái.
   */
  cashflowItems: async (query: {
    source: CashflowSource;
    schoolId?: number;
    year?: number;
    month?: number;
    excludeSuggestId?: number;
  }): Promise<CashflowItemsResponse> => {
    const res = await api.get(`${BASE}/cashflow-items`, { params: query });
    return res.data;
  },

  /** Khoản của một đề xuất chi tháng với số hiện tại ở QL thu chi. */
  getCashflowItems: async (id: number): Promise<ExpenseCashflowItemsResponse> => {
    const res = await api.get(`${BASE}/${id}/cashflow-items`);
    return res.data;
  },

  /** Bảng Chi Ngoài chỉ đọc của đề xuất — cùng quyền đọc với Quản lý thu chi. */
  getManagementExpense: async (
    id: number,
  ): Promise<{
    sections: ManagementExpenseSection[];
    /** Tổng Còn chi — số tiền lệnh chi tháng sẽ lập khi Giám đốc duyệt. */
    remainingTotal?: number;
    /** Còn chi của từng dòng trường (id dòng) — Giám đốc bỏ bớt trường. */
    items?: { id: number; amount: number }[];
  }> => {
    const res = await api.get(`${BASE}/${id}/management-expense`);
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
    remindBeforeDays: number
  ): Promise<{ remindBeforeDays: number }> => {
    const res = await api.patch(`${BASE}/reminder-settings`, {
      remindBeforeDays,
    });
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
    query: ExpenseNotificationQuery = {}
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
    query: ExpenseNotificationQuery = {}
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
    query: Pick<ExpenseNotificationQuery, "scope" | "employeeId"> = {}
  ): Promise<{ success: boolean }> => {
    const res = await api.patch(`/notifications/expense/read-all`, undefined, {
      params: query,
    });
    return res.data;
  },
};
