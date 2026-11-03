/** Chiều tiền của một lần thu/chi (và của hợp đồng lập trước khi gộp thu chi). */
export type CashflowDirection = "IN" | "OUT";

/** Thông thường: thủ quỹ thu/chi trực tiếp. Thương mại: qua kế toán công nợ (phiếu thu / lệnh chi). */
export type OtherCashflowForm = "STANDARD" | "COMMERCIAL";

export type OrderKind = "RECEIPT" | "PAYMENT";
export type OrderStatus = "PENDING" | "EXECUTED" | "CANCELLED";

export type OtherCashflowStatus =
  | "PENDING"
  | "REJECTED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Hợp đồng gồm nhiều khoản thu + nhiều khoản chi. `amount` = tổng phải thu gồm
 * thuế, `costAmount` = tổng phải chi gồm thuế; `profit` = thu chưa thuế − chi
 * chưa thuế (backend tính).
 */
export type OtherCashflowContract = {
  id: number;
  code: string;
  /** Chỉ hợp đồng lập trước khi gộp thu chi. */
  direction: CashflowDirection | null;
  form: OtherCashflowForm;
  title: string;
  documentNo: string | null;
  partnerName: string;
  schoolId: number | null;
  school: { id: number; name: string } | null;
  amount: number;
  incomeVatAmount: number;
  incomeNetAmount: number;
  recordedAmount: number;
  remainingAmount: number;
  costAmount: number;
  costVatAmount: number;
  costNetAmount: number;
  paidCostAmount: number;
  remainingCostAmount: number;
  /** VAT đầu ra − đầu vào (âm = được khấu trừ). */
  vatPayable: number;
  profit: number;
  signedDate: string | null;
  expectedDate: string | null;
  note: string | null;
  status: OtherCashflowStatus;
  createdById: number;
  createdByName: string | null;
  submittedAt: string;
  reviewedById: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Tiền của một khoản: `amount` chưa thuế, `totalAmount` gồm thuế; `vatRate` null = không thuế. */
type LineMoney = {
  id: number;
  lineNo: number;
  itemCode: string | null;
  unit: string | null;
  /** numeric dạng chuỗi, VD "2.5000" */
  quantity: string;
  unitPrice: string;
  amount: number;
  vatRate: number | null;
  vatAmount: number;
  totalAmount: number;
};

/** Khoản thu. */
export type OtherCashflowItem = LineMoney & { itemName: string };

/** Khoản chi — `paidAmount` đã chi trên `totalAmount`. */
export type OtherCashflowCost = LineMoney & {
  description: string;
  payee: string | null;
  paidAmount: number;
};

/** Phiếu thu (tổng phải thu) / lệnh chi (một khoản chi) do kế toán công nợ lập. */
export type OtherCashflowOrder = {
  id: number;
  kind: OrderKind;
  costId: number | null;
  amount: number;
  dueDate: string | null;
  note: string | null;
  status: OrderStatus;
  createdById: number;
  createdByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string;
};

export type OtherCashflowEntry = {
  id: number;
  contractId: number;
  flow: CashflowDirection;
  orderId: number | null;
  costId: number | null;
  entryDate: string;
  amount: number;
  cashAccountCode: string;
  note: string | null;
  status: "RECORDED" | "VOIDED";
  recordedById: number;
  recordedByName: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: string;
};

export type OtherCashflowAttachment = {
  id: number;
  contractId: number;
  entryId: number | null;
  kind: "CONTRACT" | "EVIDENCE";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: number;
  uploadedByName: string | null;
  createdAt: string;
};

export type OtherCashflowEvent = {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  note: string | null;
  changes: Record<string, unknown> | null;
  createdAt: string;
};

export type OtherCashflowPermissions = {
  canEdit: boolean;
  canReview: boolean;
  canCancel: boolean;
  canRecord: boolean;
  canCreateOrder: boolean;
  canCancelOrder: boolean;
  canExecuteOrder: boolean;
  canVoidEntry: boolean;
  canUploadContract: boolean;
  canDeleteContractFile: boolean;
  canManageEvidence: boolean;
};

export type OtherCashflowDetail = OtherCashflowContract & {
  items: OtherCashflowItem[];
  costs: OtherCashflowCost[];
  orders: OtherCashflowOrder[];
  entries: OtherCashflowEntry[];
  attachments: OtherCashflowAttachment[];
  events: OtherCashflowEvent[];
  permissions: OtherCashflowPermissions;
};

export type OtherCashflowListResponse = {
  data: OtherCashflowContract[];
  total: number;
  page: number;
  limit: number;
  counts: Record<OtherCashflowStatus, number>;
  meta: {
    canCreate: boolean;
    canApprove: boolean;
    canRecord: boolean;
    canManageDebt: boolean;
    canViewAll: boolean;
  };
};

type LineInput = {
  itemCode: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: number | null;
};

export type OtherCashflowItemInput = LineInput & { itemName: string };

export type OtherCashflowCostInput = LineInput & { description: string; payee: string };

/** Số tiền hợp đồng do backend tính từ các khoản. */
export type OtherCashflowInput = {
  form: OtherCashflowForm;
  title: string;
  documentNo: string;
  partnerName: string;
  schoolId: number | null;
  items: OtherCashflowItemInput[];
  costs: OtherCashflowCostInput[];
  signedDate: string | null;
  expectedDate: string | null;
  note: string;
};
