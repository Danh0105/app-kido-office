// Types & metadata for the "Đề xuất chi" (expense request) module.
// Không có DRAFT: tạo đề xuất là vào thẳng PENDING_APPROVAL.

export type ExpenseStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  // --- nhánh đề xuất tiền ---
  | "PAYMENT_ORDERED"
  | "CASH_RELEASED"
  | "CASH_RECEIVED"
  | "FUND_RETURNED"
  // --- nhánh đề xuất thiết bị ---
  | "STOCK_ISSUE_ORDERED"
  | "EQUIPMENT_RECEIVED"
  | "EQUIPMENT_RETURNED"
  // --- nhánh đề xuất sửa chữa ---
  | "REPAIR_ACCEPTED"
  | "REPAIR_REJECTED"
  // --- thiết bị mua từ nhà cung cấp (nhập kho) ---
  | "STOCK_IN_COMPLETED"
  // --- dùng chung cho cả hai nhánh ---
  | "SPENT"
  | "NOT_SPENT"
  | "REJECTED"
  | "WITHDRAWN";

/**
 * Đề xuất chi tách làm các loại, đi các nhánh khác nhau **sau khi được duyệt**
 * (tạo và duyệt là bước chung). Giám đốc/Sales Admin có thể chốt lại loại này
 * ngay khi duyệt:
 *
 * - `CASH`      → kế toán công nợ lên lệnh chi → thủ quỹ xuất tiền.
 * - `EQUIPMENT` → phòng kỹ thuật lên lệnh xuất kho → giao thiết bị.
 * - `REPAIR`    → phòng kỹ thuật cử người sửa chữa, không xuất kho.
 *
 * Đề xuất thiết bị còn chia theo nguồn (kho / nhà cung cấp) — xem
 * `EquipmentSource`.
 *
 * Đề xuất cũ (trước khi tách) backend đều trả `CASH`.
 */
export type ExpenseRequestKind = "CASH" | "EQUIPMENT" | "REPAIR";

/**
 * Nguồn thiết bị Giám đốc chọn khi duyệt đề xuất thiết bị:
 * - `STOCK`    → có sẵn trong kho: phòng kỹ thuật lên lệnh xuất kho.
 * - `SUPPLIER` → mua từ nhà cung cấp: Giám đốc lập phiếu nhập kho dự kiến,
 *                chỉ định người xử lý + người nghiệm thu; người xử lý lập
 *                phiếu nhập kho thật, người nghiệm thu xác nhận hoàn thành →
 *                SPENT (chạy về Quản lý thu chi).
 * Đề xuất thiết bị cũ để trống = `STOCK`.
 */
export type EquipmentSource = "STOCK" | "SUPPLIER";

export const EQUIPMENT_SOURCE_META: Record<
  EquipmentSource,
  { label: string; icon: string }
> = {
  STOCK: { label: "Có sẵn trong kho", icon: "🏬" },
  SUPPLIER: { label: "Từ nhà cung cấp", icon: "🚚" },
};

export type PaymentMethod = "CASH" | "BANK_TRANSFER";

/** Nguồn tiền dùng để chi: tiền sẵn có ở công ty hay tài khoản ngân hàng. */
export type FundSource = "COMPANY_CASH" | "BANK_ACCOUNT";

export type SaleAdminReviewStatus = "REVIEWED" | "REJECTED";

export type ExpenseAttachment = {
  id: number;
  fileUrl: string;
  fileName?: string;
  uploadedBy?: number;
  /** Action đã tạo ra tệp (VD "CONFIRM_CASH_RELEASED") — tệp cũ (trước khi thêm trường này) có thể rỗng. */
  action?: string;
  createdAt?: string;
};

/** Dữ liệu giám đốc chốt tại thời điểm duyệt, dùng để trình bày lịch sử. */
export type ExpenseApprovalSnapshot = {
  requestKind?: ExpenseRequestKind | string | null;
  amount?: number | string | null;
  assignedTechnicianId?: number | string | null;
  assignedTechnician?: {
    id?: number | string;
    name?: string;
    phone?: string;
  } | null;
  assignedTechnicianName?: string | null;
};

/** Người được ghi vào lịch sử (tên/SĐT chụp tại thời điểm thực hiện bước). */
export type ExpenseLogPerson = {
  id: number;
  name?: string | null;
  phone?: string | null;
};

/**
 * Thông tin của từng bước backend lưu vào `SuggestHistory.data` lúc thực hiện
 * — để Lịch sử hiện đúng số liệu của lần đó, không lấy số liệu hiện tại.
 * Log cũ (trước khi có trường này) là `{}`.
 */
export type ExpenseLogDetails = {
  // APPROVE
  requestKind?: ExpenseRequestKind | null;
  amount?: number | null;
  equipmentSource?: "STOCK" | "SUPPLIER" | null;
  handover?: ExpenseLogPerson | null;
  supporters?: ExpenseLogPerson[];
  // APPROVE (nhà cung cấp) + CREATE_STOCK_IN_RECEIPT
  stockIn?: {
    code?: string | null;
    warehouseReceiptCode?: string | null;
    items?: {
      name: string;
      quantity: number;
      unit?: string | null;
      unitPrice?: number | null;
      warehouseItemId?: number | null;
    }[];
    total?: number | null;
    note?: string | null;
    handler?: ExpenseLogPerson | null;
    acceptor?: ExpenseLogPerson | null;
  } | null;
  // CREATE/EDIT_PAYMENT_ORDER
  paymentOrder?: {
    code?: string | null;
    amount?: number | null;
    paymentMethod?: PaymentMethod | null;
  } | null;
  // CONFIRM_CASH_RELEASED
  fundSource?: FundSource | null;
  // CREATE_STOCK_ISSUE_ORDER
  stockIssueOrder?: {
    code?: string | null;
    items?: { name: string; quantity: number; unit?: string | null; note?: string | null }[];
    warehouse?: string | null;
    expectedDeliveryDate?: string | null;
  } | null;
  // Mọi bước: ai giữ bước kế tiếp (người cụ thể hoặc bộ phận) + người nghiệm thu.
  next?: {
    people?: ExpenseLogPerson[];
    departments?: string[];
  } | null;
  acceptor?: ExpenseLogPerson | null;
  // DECLINE_ASSIGNMENT / REPLACE_ASSIGNMENT / REASSIGN_REPAIR
  assignment?: {
    role?: "HANDOVER" | "SUPPORT";
    from?: ExpenseLogPerson | null;
    fromReason?: string | null;
    to?: ExpenseLogPerson | null;
  } | null;
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
  /** Hỗ trợ các tên wrapper phổ biến của snapshot log từ backend. */
  details?: ExpenseApprovalSnapshot | null;
  metadata?: ExpenseApprovalSnapshot | null;
  meta?: ExpenseApprovalSnapshot | null;
  snapshot?: ExpenseApprovalSnapshot | null;
  payload?: ExpenseApprovalSnapshot | null;
  /** Thông tin của bước tại thời điểm thực hiện (xem `ExpenseLogDetails`). */
  data?: ExpenseLogDetails | null;
};

export type PaymentOrder = {
  id: number;
  code: string;
  amount: number;
  paymentMethod: PaymentMethod;
  fundSource?: FundSource;
  note?: string | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
};

/** Một dòng thiết bị trong lệnh xuất kho. */
export type StockIssueItem = {
  name: string;
  quantity: number;
  unit?: string | null;
  note?: string | null;
  /** Nếu chọn từ thiết bị có sẵn trong kho — kho sẽ tự trừ tồn. */
  warehouseItemId?: number | null;
};

/** Một dòng thiết bị kinh doanh mong muốn khi tạo đề xuất thiết bị. */
export type RequestedEquipmentItem = {
  name: string;
  quantity: number;
  unit?: string | null;
  warehouseItemId?: number | null;
};

/** Lệnh xuất kho của đề xuất thiết bị — đối ứng `PaymentOrder` ở nhánh tiền. */
export type StockIssueOrder = {
  id: number;
  code: string; // XK-YYYYMM-xxxx
  items: StockIssueItem[];
  warehouse?: string | null;
  expectedDeliveryDate?: string | null;
  note?: string | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
};

/** Một dòng thiết bị trong phiếu nhập kho của đề xuất thiết bị từ nhà cung cấp. */
export type StockInItem = {
  name: string;
  quantity: number;
  unit?: string | null;
  /** Đơn giá mua — tổng tiền phiếu thành số tiền đề xuất. */
  unitPrice?: number | null;
  note?: string | null;
  /** Thiết bị đã có mã trong kho; để trống = kho tạo thiết bị mới khi nhập. */
  warehouseItemId?: number | null;
};

/**
 * Phiếu nhập kho của đề xuất thiết bị từ nhà cung cấp: Giám đốc lập bản dự kiến
 * (`draftItems`) khi duyệt, người xử lý chốt bản thật (`items`) khi nhập kho.
 */
export type StockInOrder = {
  id: number;
  code: string; // NK-YYYYMM-xxxx
  draftItems: StockInItem[];
  draftNote?: string | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
  items?: StockInItem[] | null;
  note?: string | null;
  warehouseReceiptId?: number | null;
  warehouseReceipt?: { id: number; code: string } | null;
  stockedBy?: number | null;
  stocker?: { id: number; name?: string } | null;
  stockedAt?: string | null;
};

type EmployeeRef = { id: number; name?: string; phone?: string };

/** Vai trò người được giao việc: người bàn giao hoặc người hỗ trợ. */
export type AssignmentRole = "HANDOVER" | "SUPPORT";

/** DECLINED = đã từ chối, chờ Giám đốc chọn người thay; REPLACED = đã được thay. */
export type AssignmentStatus = "ASSIGNED" | "DECLINED" | "REPLACED";

export type ExpenseAssignment = {
  id: number;
  suggestId: number;
  employeeId: number;
  employee?: EmployeeRef | null;
  role: AssignmentRole;
  status: AssignmentStatus;
  declineReason?: string | null;
  declinedAt?: string | null;
  replacedById?: number | null;
  assignedBy?: number;
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
  /** Trống trong lúc chờ Giám đốc phân loại. */
  requestKind?: ExpenseRequestKind | null;
  content: string; // tiêu đề/nội dung (dùng chung cột suggest.content)
  description?: string;
  amount?: number;
  expectedPaymentDate?: string;
  participants?: string; // thành phần tham gia
  /** Kinh doanh tự đánh dấu: đề xuất này nên trừ vào chính sách liên quan (chỉ để hiển thị). */
  deductPolicy?: boolean;
  schoolId?: number;
  school?: {
    id: number;
    name: string;
    ward?: {
      id: number;
      name: string;
      province_id?: number | null;
      province?: { id: number; name: string } | null;
    } | null;
  };
  wardId?: number;
  ward?: {
    id: number;
    name: string;
    province_id?: number | null;
    province?: { id: number; name: string } | null;
  };
  schoolYear?: string;
  status: ExpenseStatus;
  isOverdue?: boolean;
  rejectReason?: string;
  notSpentReason?: string;
  /** Ghi chú chung của Giám đốc/Sales Admin khi duyệt đề xuất (không bắt buộc). */
  approveNote?: string | null;
  createdBy?: number | string | ExpenseCreator;
  createdByUser?: ExpenseCreator;
  creator?: ExpenseCreator;
  approvedBy?: number;
  approvedAt?: string;
  /** Nhân viên phòng kỹ thuật được chỉ định phụ trách (chỉ có ý nghĩa với EQUIPMENT/REPAIR). */
  assignedTechnicianId?: number | null;
  assignedTechnician?: { id: number; name?: string; phone?: string } | null;
  cashReleasedBy?: number;
  cashReleasedAt?: string | null;
  cashReceivedAt?: string | null;
  spentAt?: string | null;
  fundReturnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Chỉ có ở đề xuất tiền; đề xuất thiết bị luôn `null`. */
  paymentOrder?: PaymentOrder | null;
  /** Chỉ có ở đề xuất thiết bị; đề xuất tiền luôn `null`. */
  stockIssueOrder?: StockIssueOrder | null;
  /** Người bàn giao + người hỗ trợ (kể cả người đã từ chối / đã được thay). */
  assignments?: ExpenseAssignment[];
  /** Nguồn thiết bị (chỉ đề xuất thiết bị); trống = kho. */
  equipmentSource?: EquipmentSource | null;
  /** Chỉ có ở đề xuất thiết bị từ nhà cung cấp. */
  stockInOrder?: StockInOrder | null;
  /** Người xử lý phiếu nhập kho — Giám đốc chỉ định khi duyệt thiết bị từ nhà cung cấp. */
  stockInHandlerId?: number | null;
  stockInHandler?: EmployeeRef | null;
  /** Người nghiệm thu bàn giao — xác nhận hoàn thành đề xuất thiết bị từ nhà cung cấp. */
  acceptorId?: number | null;
  acceptor?: EmployeeRef | null;
  /** Thiết bị kinh doanh mong muốn khi tạo đề xuất — chỉ tham khảo. */
  requestedItems?: RequestedEquipmentItem[] | null;
  equipmentReceivedAt?: string | null;
  equipmentReturnedBy?: number | null;
  equipmentReturnedAt?: string | null;
  technicalRespondedBy?: number | null;
  technicalRespondedAt?: string | null;
  technicalRejectReason?: string | null;
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
  requestKind?: ExpenseRequestKind;
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
  STOCK_ISSUE_ORDERED: {
    label: "Đã lên lệnh xuất kho",
    badge: "bg-violet-100 text-violet-700",
  },
  EQUIPMENT_RECEIVED: {
    label: "Đã nhận thiết bị",
    badge: "bg-sky-100 text-sky-700",
  },
  EQUIPMENT_RETURNED: {
    label: "Đã nhập lại kho",
    badge: "bg-teal-100 text-teal-700",
  },
  REPAIR_ACCEPTED: {
    label: "Kỹ thuật đã nhận việc ✓",
    badge: "bg-green-100 text-green-700",
    done: true,
  },
  REPAIR_REJECTED: {
    label: "Kỹ thuật từ chối ✗",
    badge: "bg-red-100 text-red-700",
    done: true,
  },
  STOCK_IN_COMPLETED: {
    label: "Đã nhập kho, chờ nghiệm thu",
    badge: "bg-cyan-100 text-cyan-700",
  },
  SPENT: { label: "Đã chi ✓", badge: "bg-green-100 text-green-700", done: true },
  NOT_SPENT: { label: "Chưa chi", badge: "bg-amber-100 text-amber-700" },
  FUND_RETURNED: { label: "Đã hoàn quỹ", badge: "bg-green-100 text-green-700" },
  REJECTED: { label: "Từ chối ✗", badge: "bg-red-100 text-red-700", done: true },
  WITHDRAWN: { label: "Đã rút", badge: "bg-gray-100 text-gray-600", done: true },
};

/**
 * Nhãn của loại đề xuất. `short` dùng cho badge cạnh mã đề xuất, `label` dùng
 * ở chỗ cần gọi đủ tên (form tạo, tiêu đề danh sách).
 */
export const KIND_META: Record<
  ExpenseRequestKind,
  { label: string; short: string; icon: string; badge: string }
> = {
  CASH: {
    label: "Đề xuất tiền",
    short: "Tiền",
    icon: "💰",
    badge: "bg-emerald-100 text-emerald-700",
  },
  EQUIPMENT: {
    label: "Đề xuất thiết bị",
    short: "Thiết bị",
    icon: "🧰",
    badge: "bg-indigo-100 text-indigo-700",
  },
  REPAIR: {
    label: "Đề xuất sửa chữa",
    short: "Sửa chữa",
    icon: "🔧",
    badge: "bg-amber-100 text-amber-700",
  },
};

/**
 * `SPENT` / `NOT_SPENT` dùng chung cho cả hai nhánh (để thống kê không phải
 * phân nhánh) nhưng đọc khác nhau: tiền thì "đã chi", thiết bị thì "đã bàn
 * giao". Vì vậy nhãn phải tra kèm `requestKind`.
 */
const KIND_STATUS_LABEL: Partial<
  Record<ExpenseStatus, Record<ExpenseRequestKind, string>>
> = {
  SPENT: {
    CASH: "Đã chi ✓",
    EQUIPMENT: "Đã bàn giao ✓",
    REPAIR: "Đã sửa xong ✓",
  },
  NOT_SPENT: {
    CASH: "Chưa chi",
    EQUIPMENT: "Chưa dùng",
    REPAIR: "Chưa sửa",
  },
};

export const statusLabel = (
  status?: string,
  kind: ExpenseRequestKind = "CASH",
) => {
  if (!status) return "";
  const byKind = KIND_STATUS_LABEL[status as ExpenseStatus]?.[kind];
  return byKind || STATUS_META[status as ExpenseStatus]?.label || status;
};

export const STATUS_LABEL = (s?: string) => statusLabel(s);

// Timeline action labels (best-effort mapping of backend log action codes).
export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tạo đề xuất",
  CREATE_EXPENSE_REQUEST: "Tạo đề xuất",
  UPDATE: "Sửa đề xuất",
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
  // --- nhánh đề xuất thiết bị ---
  CREATE_STOCK_ISSUE_ORDER: "Lên lệnh xuất kho",
  STOCK_ISSUE_ORDER: "Lên lệnh xuất kho",
  STOCK_ISSUE_ORDERED: "Lên lệnh xuất kho",
  CONFIRM_EQUIPMENT_RECEIVED: "Xác nhận đã nhận thiết bị",
  EQUIPMENT_RECEIVED: "Xác nhận đã nhận thiết bị",
  CONFIRM_EQUIPMENT_RETURNED: "Xác nhận đã nhập lại kho",
  EQUIPMENT_RETURNED: "Xác nhận đã nhập lại kho",
  ACCEPT_REPAIR: "Nhận việc sửa chữa",
  REPAIR_ACCEPTED: "Nhận việc sửa chữa",
  REJECT_REPAIR: "Từ chối việc sửa chữa",
  REPAIR_REJECTED: "Từ chối việc sửa chữa",
  FUND_RETURNED: "Nhận lại quỹ",
  // --- thiết bị từ nhà cung cấp ---
  CREATE_STOCK_IN_RECEIPT: "Lập phiếu nhập kho",
  STOCK_IN_COMPLETED: "Lập phiếu nhập kho",
  CONFIRM_STOCK_IN_ACCEPTED: "Nghiệm thu bàn giao, hoàn thành",
  // --- giao việc ---
  DECLINE_ASSIGNMENT: "Từ chối nhận việc",
  REPLACE_ASSIGNMENT: "Chọn người thay thế",
  CONFIRM_FUND_RETURNED: "Xác nhận hoàn quỹ",
  REMINDER: "Báo động",
  OVERDUE: "Quá hạn",
  SALE_ADMIN_REVIEW: "Sales Admin kiểm duyệt đạt",
  SALE_ADMIN_REJECT: "Sales Admin từ chối chính sách",
  WITHDRAW: "Rút đề xuất",
  WITHDRAWN: "Rút đề xuất",
  WITHDRAW_EXPENSE_REQUEST: "Rút đề xuất",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

export const FUND_SOURCE_LABEL: Record<FundSource, string> = {
  COMPANY_CASH: "Tiền sẵn có ở công ty",
  BANK_ACCOUNT: "Tài khoản ngân hàng",
};
