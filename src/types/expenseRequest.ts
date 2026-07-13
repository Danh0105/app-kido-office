// Types & metadata for the "Đề xuất chi" (expense request) module.
// Không có DRAFT: tạo đề xuất là vào thẳng PENDING_APPROVAL.

export type ExpenseStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PAYMENT_ORDERED"
  | "CASH_RELEASED"
  | "CASH_RECEIVED"
  | "SPENT"
  | "NOT_SPENT"
  | "FUND_RETURNED"
  | "REJECTED";

export type PaymentMethod = "CASH" | "BANK_TRANSFER";

export type SaleAdminReviewStatus = "REVIEWED" | "REJECTED";

export type ExpenseAttachment = {
  id: number;
  fileUrl: string;
  fileName?: string;
  uploadedBy?: number;
  createdAt?: string;
};

export type ExpenseLog = {
  id: number;
  action: string;
  fromStatus?: ExpenseStatus | null;
  toStatus?: ExpenseStatus | null;
  note?: string | null;
  reason?: string | null;
  userId?: number;
  actorName?: string;
  actor?: { id: number; name?: string; roles?: string[] };
  createdAt?: string;
  snapshotAt?: string;
};

export type PaymentOrder = {
  id: number;
  code: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
};

export type ExpenseCreator = {
  id: number;
  name?: string;
  phone?: string;
  email?: string;
  department?: { id?: number; name?: string } | string;
  departmentName?: string;
  roles?: string[];
};

export type ExpenseRequest = {
  id: number;
  code: string;
  content: string; // tiêu đề/nội dung (dùng chung cột suggest.content)
  description?: string;
  amount: number;
  expectedPaymentDate?: string;
  participants?: string; // thành phần tham gia
  schoolId?: number;
  school?: { id: number; name: string };
  schoolYear?: string;
  status: ExpenseStatus;
  isOverdue?: boolean;
  rejectReason?: string;
  notSpentReason?: string;
  createdBy?: number | string | ExpenseCreator;
  creator?: ExpenseCreator;
  approvedBy?: number;
  approvedAt?: string;
  cashReleasedBy?: number;
  cashReleasedAt?: string | null;
  cashReceivedAt?: string | null;
  spentAt?: string | null;
  fundReturnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  paymentOrder?: PaymentOrder | null;
  logs?: ExpenseLog[];
  attachments?: ExpenseAttachment[];
  // Kiểm duyệt song song của Sales Admin (cố vấn, không chặn giám đốc duyệt).
  saleadminReviewStatus?: SaleAdminReviewStatus | null;
  saleadminNote?: string | null;
  saleadminReviewedBy?: number | null;
  saleadminReviewedAt?: string | null;
};

export type ExpenseListResponse = {
  data: ExpenseRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExpenseListQuery = {
  status?: ExpenseStatus;
  createdBy?: number;
  schoolId?: number;
  schoolYear?: string;
  fromDate?: string;
  toDate?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
};

// Danh sách đề xuất chi gom nhóm theo nhân viên (page/limit phân trang theo nhân viên).
export type ExpenseEmployeeGroup = {
  employeeId: number;
  employee: { id: number; name?: string; phone?: string };
  total: number;
  totalAmount: number;
  requests: ExpenseRequest[];
};

export type ExpenseGroupedByEmployeeResponse = {
  data: ExpenseEmployeeGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExpenseNotificationScope = "general" | "overdue" | "all";

export type ExpenseNotificationTab = "unread" | "read";

export type ExpenseNotificationMeta = {
  suggestType?: "EXPENSE_REQUEST" | string;
  suggestId?: number;
  suggestCode?: string;
  employeeId?: number;
  employeeName?: string;
  employeePhone?: string;
  kind?: string;
  status?: ExpenseStatus | string;
  daysLate?: number;
};

export type ExpenseNotification = {
  id: number;
  receiverId?: number;
  senderId?: number;
  type: "SUGGEST" | string;
  entityId?: number;
  title?: string;
  message?: string;
  isRead: boolean;
  createdAt?: string;
  meta?: ExpenseNotificationMeta;
};

export type ExpenseNotificationSummary = {
  general: { total: number; unread: number };
  overdue: { total: number; unread: number };
};

export type ExpenseNotificationEmployeeGroup = {
  employeeId: number;
  employeeName?: string;
  phone?: string;
  total: number;
  unreadCount: number;
  latestAt?: string;
};

export type ExpenseNotificationListResponse = {
  scope: ExpenseNotificationScope;
  data: ExpenseNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExpenseNotificationGroupedResponse = {
  scope: ExpenseNotificationScope;
  data: ExpenseNotificationEmployeeGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExpenseNotificationQuery = {
  scope?: ExpenseNotificationScope;
  tab?: ExpenseNotificationTab;
  employeeId?: number;
  page?: number;
  limit?: number;
};

// Visual metadata for each status: Vietnamese label + Tailwind badge classes.
export const STATUS_META: Record<
  ExpenseStatus,
  { label: string; badge: string; done?: boolean }
> = {
  PENDING_APPROVAL: { label: "Chờ duyệt", badge: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Đã duyệt", badge: "bg-blue-100 text-blue-700" },
  PAYMENT_ORDERED: { label: "Đã lên lệnh chi", badge: "bg-purple-100 text-purple-700" },
  CASH_RELEASED: { label: "Đã xuất tiền", badge: "bg-orange-100 text-orange-700" },
  CASH_RECEIVED: { label: "Đã nhận tiền", badge: "bg-lime-100 text-lime-700" },
  SPENT: { label: "Đã chi ✓", badge: "bg-green-100 text-green-700", done: true },
  NOT_SPENT: { label: "Chưa chi", badge: "bg-amber-100 text-amber-700" },
  FUND_RETURNED: { label: "Đã hoàn quỹ", badge: "bg-green-100 text-green-700" },
  REJECTED: { label: "Từ chối ✗", badge: "bg-red-100 text-red-700", done: true },
};

export const STATUS_LABEL = (s?: string) =>
  (s && STATUS_META[s as ExpenseStatus]?.label) || s || "";

// Timeline action labels (best-effort mapping of backend log action codes).
export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tạo đề xuất",
  CREATE_EXPENSE_REQUEST: "Tạo đề xuất",
  SUBMIT: "Gửi duyệt",
  APPROVE: "Duyệt",
  APPROVED: "Duyệt",
  APPROVE_EXPENSE_REQUEST: "Duyệt đề xuất",
  REJECT: "Từ chối",
  REJECTED: "Từ chối",
  REJECT_EXPENSE_REQUEST: "Từ chối đề xuất",
  PAYMENT_ORDER: "Lên lệnh chi",
  PAYMENT_ORDERED: "Lên lệnh chi",
  CREATE_PAYMENT_ORDER: "Lên lệnh chi",
  CASH_RELEASE: "Xuất tiền",
  CASH_RELEASED: "Xuất tiền",
  CONFIRM_CASH_RELEASED: "Xác nhận xuất tiền",
  CASH_RECEIVE: "Nhận tiền",
  CASH_RECEIVED: "Nhận tiền",
  CONFIRM_CASH_RECEIVED: "Xác nhận nhận tiền",
  CONFIRM_SPENT: "Xác nhận đã chi",
  SPENT: "Xác nhận đã chi",
  CONFIRM_NOT_SPENT: "Xác nhận chưa chi",
  NOT_SPENT: "Xác nhận chưa chi",
  FUND_RETURN: "Nhận lại quỹ",
  FUND_RETURNED: "Nhận lại quỹ",
  CONFIRM_FUND_RETURNED: "Xác nhận hoàn quỹ",
  REMINDER: "Báo động",
  OVERDUE: "Quá hạn",
  SALE_ADMIN_REVIEW: "Sales Admin kiểm duyệt đạt",
  SALE_ADMIN_REJECT: "Sales Admin từ chối chính sách",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};
