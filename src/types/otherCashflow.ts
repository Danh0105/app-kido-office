export type CashflowDirection = "IN" | "OUT";

/** Thương mại chỉ cho Thu: đơn đặt hàng/hợp đồng có dòng hàng + chi phí, đi luồng công nợ. */
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

export type OtherCashflowContract = {
  id: number;
  code: string;
  direction: CashflowDirection;
  form: OtherCashflowForm;
  title: string;
  documentNo: string | null;
  partnerName: string;
  schoolId: number | null;
  school: { id: number; name: string } | null;
  amount: number;
  recordedAmount: number;
  remainingAmount: number;
  costAmount: number;
  paidCostAmount: number;
  remainingCostAmount: number;
  grossProfit: number;
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

export type OtherCashflowItem = {
  id: number;
  lineNo: number;
  itemCode: string;
  itemName: string;
  unit: string | null;
  /** numeric dạng chuỗi, VD "2.5000" */
  quantity: string;
  unitPrice: string;
  amount: number;
};

export type OtherCashflowCost = {
  id: number;
  lineNo: number;
  description: string;
  payee: string | null;
  amount: number;
  paidAmount: number;
};

/** Phiếu thu (tiền hàng) / lệnh chi (chi phí) do kế toán công nợ lập. */
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

export type OtherCashflowItemInput = {
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type OtherCashflowCostInput = {
  description: string;
  payee: string;
  amount: number;
};

export type OtherCashflowInput = {
  direction: CashflowDirection;
  form: OtherCashflowForm;
  title: string;
  documentNo: string;
  partnerName: string;
  schoolId: number | null;
  /** Thương mại: backend tính lại từ dòng hàng. */
  amount: number;
  items: OtherCashflowItemInput[];
  costs: OtherCashflowCostInput[];
  signedDate: string | null;
  expectedDate: string | null;
  note: string;
};
