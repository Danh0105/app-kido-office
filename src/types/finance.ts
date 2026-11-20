export type FinanceRequestType =
  | "ADVANCE"
  | "SALARY_ADVANCE"
  | "SETTLEMENT"
  | "EXPENSE_PAYMENT"
  /** Điều chuyển tiền nội bộ: từ nguồn (TK 111/112) này sang nguồn khác. */
  | "INTERNAL_TRANSFER";

export type ApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PaymentStatus = "NONE" | "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type RecoveryStatus = "NONE" | "PENDING" | "PARTIAL" | "RECOVERED";
export type SettlementStatus =
  | "NONE"
  | "NOT_SETTLED"
  | "PARTIALLY_SETTLED"
  | "SETTLED"
  | "PENDING_PAYMENT"
  | "PENDING_REFUND"
  | "COMPLETED";
export type DeductionStatus = "NONE" | "NOT_DEDUCTED" | "DEDUCTING" | "DEDUCTED";
export type StepStatus =
  | "WAITING"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "SKIPPED"
  | "CANCELLED";
export type FinanceRole =
  | "MANAGER"
  | "CONTROLLER"
  | "ACCOUNTANT"
  | "CASHIER"
  | "DIRECTOR"
  | "ADMIN"
  | "VIEWER";
export type PaymentMethod = "BANK_TRANSFER" | "CASH";
export type InvoiceType = "VAT" | "NON_VAT" | "NONE";
export type AttachmentKind =
  | "DOCUMENT"
  | "INVOICE"
  | "PAYMENT_PROOF"
  | "REFUND_PROOF"
  | "ADJUSTMENT_EVIDENCE"
  | "CONTROL_EVIDENCE";
export type ApproverType = "DIRECT_MANAGER" | "ROLE" | "EMPLOYEE";
export type SignatureSlot = "MANAGER" | "CONTROLLER" | "ACCOUNTANT" | "DIRECTOR";
export type SelfApprovalMode = "BLOCK" | "SKIP_STEP" | "ALLOW";

export type FinanceCompany = {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  taxCode: string | null;
  address: string | null;
  hasLogo: boolean;
  formCodes: Record<string, string>;
};
export type FinancePayeeProfile = {
  payeeName: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  updatedAt: string;
};

export type FinanceMeta = {
  companies: FinanceCompany[];
  categories: { id: number; code: string; name: string; limitAmount: number | null }[];
  departments: { id: number; name: string }[];
  cashAccounts: { code: string; name: string; groupCode: string }[];
  me: {
    id: number;
    name: string;
    departmentId: number | null;
    departmentName: string | null;
    /** Công ty được xếp ở màn Phân quyền — đề nghị mới chọn sẵn (đổi được). */
    companyId: number | null;
    position: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    /** Thông tin nhận tiền tự lưu — điền sẵn trước tài khoản trong hồ sơ. */
    savedPayee: FinancePayeeProfile | null;
  };
  capabilities: {
    isAdmin: boolean;
    /** Vào được Cấu hình quy trình: quản trị phân hệ hoặc Nhân sự. */
    canConfigure: boolean;
    /** Quản lý tài khoản nhân viên: Nhân sự hoặc Giám đốc. */
    canManageEmployees: boolean;
    canViewAll: boolean;
    canApprove: boolean;
    canManagePayments: boolean;
    /** Lập phiếu Điều chuyển tiền nội bộ: Kế toán, Thủ quỹ, KTT, Giám đốc. */
    canCreateTransfer?: boolean;
    canViewReports: boolean;
    canConfirmDeductions: boolean;
    roles: FinanceRole[];
  };
};

export type FinanceListItem = {
  id: number;
  code: string;
  type: FinanceRequestType;
  title: string;
  companyId: number;
  companyName: string | null;
  requesterId: number;
  requesterName: string;
  departmentName: string | null;
  requestDate: string;
  totalAmount: number;
  approvedAmount: number | null;
  offsetAmount: number;
  paidAmount: number;
  recoveredAmount: number;
  payableRemaining: number;
  receivableRemaining: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  recoveryStatus: RecoveryStatus;
  settlementStatus: SettlementStatus;
  deductionStatus: DeductionStatus;
  settlementDueDate: string | null;
  overdue: boolean;
  currentStepName: string | null;
  canAct: boolean;
  isOwner: boolean;
  createdAt: string;
};

export type FinanceListResponse = {
  data: FinanceListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  totals: {
    totalAmount: number;
    approvedAmount: number;
    paidAmount: number;
    recoveredAmount: number;
  };
};

export type FinanceListQuery = {
  scope?: "mine" | "approvals" | "all" | "payments";
  type?: FinanceRequestType | "";
  companyId?: number | "";
  departmentId?: number | "";
  requesterId?: number | "";
  approvalStatus?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number | "";
  amountMax?: number | "";
  code?: string;
  q?: string;
  overdue?: "true" | "false" | "";
  sort?: "requestDate" | "createdAt" | "totalAmount" | "code";
  order?: "ASC" | "DESC";
  page?: number;
  limit?: number;
};

export type FinanceItem = {
  id: number;
  lineNo: number;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  amount: number;
  approvedAmount: number | null;
  adjustmentReason: string | null;
  adjustedByName: string | null;
  adjustedAt: string | null;
  incurredDate: string | null;
  invoiceNumber: string | null;
  invoiceType: InvoiceType | null;
  supplierName: string | null;
  /** NCC nhận tiền của dòng; null = người đề nghị. */
  supplierId: number | null;
  note: string | null;
  overLimit: boolean;
  attachmentCount: number;
};

/** Nhà cung cấp nhận tiền chuyển khoản (phiếu Thanh toán chi phí). */
export type FinanceSupplier = {
  id: number;
  lineNo: number;
  name: string;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  note: string | null;
};

/** Người nhận tiền của phiếu: người đề nghị hoặc một NCC. */
export type FinanceRecipient = {
  /** null = người đề nghị. */
  supplierId: number | null;
  kind: "REQUESTER" | "SUPPLIER";
  name: string;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  /** Tổng các dòng gán cho người nhận (số được duyệt nếu đã điều chỉnh). */
  amount: number;
  paidAmount: number;
  /** Còn phải chi — chỉ > 0 khi phiếu đã duyệt. */
  remaining: number;
};

export type FinanceAttachment = {
  id: number;
  kind: AttachmentKind;
  itemId: number | null;
  paymentId: number | null;
  refundId: number | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: number;
  uploadedByName: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type FinanceStep = {
  id: number;
  round: number;
  stepOrder: number;
  name: string;
  signatureSlot: SignatureSlot | null;
  approverType: ApproverType;
  approverRole: FinanceRole | null;
  status: StepStatus;
  canAdjustAmounts: boolean;
  skippable: boolean;
  candidates: { id: number; name: string }[];
  actedById: number | null;
  actedByName: string | null;
  onBehalfOfName: string | null;
  actedAt: string | null;
  comment: string | null;
  activatedAt: string | null;
};

export type FinanceMovement = {
  id: number;
  amount: number;
  /** Lần chi: chuyển cho NCC nào (null = người đề nghị). Không có ở hoàn trả. */
  supplierId?: number | null;
  recipientName?: string;
  date: string;
  method: PaymentMethod;
  cashAccountCode: string | null;
  transactionRef: string | null;
  note: string | null;
  status: "RECORDED" | "VOIDED";
  recordedByName: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
};

export type FinanceAllocation = {
  advanceId: number;
  code: string;
  title: string;
  requestDate: string;
  paidAmount: number;
  allocatedElsewhere: number;
  available: number;
  amount: number;
  appliedAt: string | null;
  advanceSettlementStatus: SettlementStatus;
};

export type FinanceDeduction = {
  id: number;
  periodYear: number;
  periodMonth: number;
  plannedAmount: number;
  deductedAmount: number | null;
  status: "PLANNED" | "DEDUCTED" | "CANCELLED";
  payrollId: number | null;
  deductedAt: string | null;
  deductedByName: string | null;
  note: string | null;
};

export type FinanceAudit = {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  comment: string | null;
  changes: Record<string, unknown> | null;
  createdAt: string;
};

export type FinancePermissions = {
  isOwner: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canWithdraw: boolean;
  actionableStepId: number | null;
  canApprove: boolean;
  canAdjust: boolean;
  /** Đang chờ cấp Bộ phận kiểm soát của mình — được đính kèm chứng từ kiểm soát. */
  isControlStep: boolean;
  canSkip: boolean;
  canRecordPayment: boolean;
  canRecordRefund: boolean;
  canVoidMoney: boolean;
  canConfirmDeduction: boolean;
  canCancel: boolean;
  canUploadDocuments: boolean;
  canUploadPaymentProof: boolean;
  canSeeBank: boolean;
  canCreateSettlement: boolean;
};

export type FinanceDetail = {
  id: number;
  code: string;
  type: FinanceRequestType;
  company: FinanceCompany | null;
  companyId: number;
  requesterId: number;
  requesterName: string;
  requesterCode: string | null;
  requesterPosition: string | null;
  departmentId: number | null;
  departmentName: string | null;
  directManagerId: number | null;
  directManagerName: string | null;
  requestDate: string;
  title: string;
  purpose: string | null;
  projectName: string | null;
  expectedUseDate: string | null;
  settlementDueDate: string | null;
  location: string | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  salaryYear: number | null;
  salaryMonth: number | null;
  expectedSalary: number | null;
  deductionStartYear: number | null;
  deductionStartMonth: number | null;
  deductionPeriods: number | null;
  payeeName: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  paymentMethod: PaymentMethod | null;
  paymentAccountCode: string | null;
  paymentAccountName: string | null;
  /** Điều chuyển tiền nội bộ: nguồn chuyển / nguồn nhận. */
  transferFromAccountCode?: string | null;
  transferToAccountCode?: string | null;
  paymentNote: string | null;
  suppliers: FinanceSupplier[];
  recipients: FinanceRecipient[];
  totalAmount: number;
  approvedAmount: number | null;
  offsetAmount: number;
  paidAmount: number;
  recoveredAmount: number;
  settledAmount: number;
  deductedAmount: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  recoveryStatus: RecoveryStatus;
  settlementStatus: SettlementStatus;
  deductionStatus: DeductionStatus;
  workflowName: string | null;
  isSequential: boolean;
  currentRound: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  copiedFromId: number | null;
  version: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  summary: {
    totalAmount: number;
    approvedTotal: number;
    offsetAmount: number;
    difference: number | null;
    payableDue: number;
    payableRemaining: number;
    receivableDue: number;
    receivableRemaining: number;
    advanceOutstanding: number | null;
    salaryOutstanding: number | null;
    amountInWords: string;
    approvedInWords: string;
    overdue: boolean;
    daysToDue: number | null;
  };
  items: FinanceItem[];
  attachments: FinanceAttachment[];
  steps: FinanceStep[];
  payments: FinanceMovement[];
  refunds: FinanceMovement[];
  allocations: FinanceAllocation[];
  settlements: {
    settlementId: number;
    code: string;
    requestDate: string;
    approvalStatus: ApprovalStatus;
    settlementStatus: SettlementStatus;
    amount: number;
    appliedAt: string | null;
  }[];
  deductions: FinanceDeduction[];
  audit: FinanceAudit[];
  warnings: string[];
  permissions: FinancePermissions;
};

export type FinanceItemInput = {
  id?: number;
  description: string;
  categoryId?: number | null;
  unit?: string | null;
  quantity: string;
  unitPrice: string;
  incurredDate?: string | null;
  invoiceNumber?: string | null;
  invoiceType?: InvoiceType | null;
  supplierName?: string | null;
  /** Vị trí NCC trong `suppliers` của cùng payload; null = người đề nghị. */
  supplierIndex?: number | null;
  note?: string | null;
};

export type FinanceSupplierInput = {
  id?: number;
  name: string;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  note?: string | null;
};

export type FinanceRequestInput = {
  type?: FinanceRequestType;
  companyId?: number;
  version?: number;
  requestDate?: string;
  title?: string;
  purpose?: string | null;
  projectName?: string | null;
  expectedUseDate?: string | null;
  settlementDueDate?: string | null;
  location?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  directManagerId?: number | null;
  salaryYear?: number;
  salaryMonth?: number;
  requestedAmount?: number;
  /** Điều chuyển tiền nội bộ: nguồn chuyển / nguồn nhận (số hiệu TK 111/112). */
  transferFromAccountCode?: string | null;
  transferToAccountCode?: string | null;
  deductionStartYear?: number;
  deductionStartMonth?: number;
  deductionPeriods?: number;
  payeeName?: string | null;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  paymentNote?: string | null;
  items?: FinanceItemInput[];
  suppliers?: FinanceSupplierInput[];
  allocations?: { advanceId: number; amount: number }[];
};

export type AvailableAdvance = {
  id: number;
  code: string;
  title: string;
  requestDate: string;
  settlementDueDate: string | null;
  paidAmount: number;
  settledAmount: number;
  allocatedElsewhere: number;
  available: number;
  currentAllocation: number;
};

export type SalaryAdvanceCheck = {
  expectedSalary: number | null;
  countInPeriod: number;
  pendingCount: number;
  approvedInPeriod: number;
  requestedInPeriod: number;
  policy: {
    maxPerMonth: number | null;
    maxAmount: number | null;
    maxPercent: number | null;
    maxDeductionPeriods: number;
  };
};

export type FinanceSummary = {
  kpis: {
    totalRequested: number;
    totalApproved: number;
    totalPaid: number;
    advanceOutstanding: number;
    settledInPeriod: number;
    payableToEmployees: number;
    receivable: number;
    salaryAdvanceOutstanding: number;
    pendingCount: number;
    overdueAdvanceCount: number;
  };
  charts: {
    byMonth: { month: string; requested: number; approved: number; paid: number }[];
    byCompany: { name: string; value: number }[];
    byDepartment: { name: string; value: number }[];
    byCategory: { name: string; value: number }[];
    byType: { name: string; value: number }[];
    advanceVsSettlement: { month: string; advancePaid: number; settled: number }[];
    statusCounts: { status: ApprovalStatus; label: string; count: number }[];
  };
};

export type FinanceBalanceRow = {
  employeeId: number;
  employeeName: string;
  departmentName: string | null;
  advanceOutstanding: number;
  advanceOverdue: number;
  overdueCount: number;
  receivable: number;
  payable: number;
  salaryAdvanceOutstanding: number;
};

export type FinanceDeductionRow = {
  id: number;
  requestId: number;
  requestCode: string;
  companyId: number;
  employeeId: number;
  employeeName: string;
  departmentName: string | null;
  periodYear: number;
  periodMonth: number;
  plannedAmount: number;
  deductedAmount: number | null;
  status: "PLANNED" | "DEDUCTED" | "CANCELLED";
  payrollId: number | null;
  deductedAt: string | null;
  deductedByName: string | null;
  canConfirm: boolean;
};

export type WorkflowStepInput = {
  name: string;
  signatureSlot?: SignatureSlot | null;
  approverType: ApproverType;
  approverRole?: FinanceRole | null;
  approverEmployeeId?: number | null;
  minAmount?: number | null;
  canAdjustAmounts?: boolean;
  skippable?: boolean;
};

export type FinanceWorkflow = {
  id: number;
  name: string;
  companyId: number | null;
  requestType: FinanceRequestType | null;
  isActive: boolean;
  isSequential: boolean;
  selfApprovalMode: SelfApprovalMode;
  allowWithdraw: boolean;
  description: string | null;
  steps: (WorkflowStepInput & { id: number; stepOrder: number })[];
};

export type FinancePolicy = {
  id: number;
  scopeKey: string;
  salaryAdvanceMaxPerMonth: number | null;
  salaryAdvanceMaxAmount: number | null;
  salaryAdvanceMaxPercent: number | null;
  maxDeductionPeriods: number;
  advanceDueDays: number;
  reminderDaysBefore: number;
  expenseOverLimitMode: "WARN" | "BLOCK";
};

export type FinanceDelegation = {
  id: number;
  delegatorId: number;
  delegatorName: string;
  delegateId: number;
  delegateName: string;
  companyId: number | null;
  requestType: FinanceRequestType | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  revokedAt: string | null;
  canRevoke?: boolean;
};

export type FinanceConfigOverview = {
  /** Người đang đăng nhập — để ẩn thao tác backend không cho với chính mình. */
  me: { id: number };
  companies: (FinanceCompany & { phone: string | null; email: string | null; isActive: boolean })[];
  categories: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    limitAmount: number | null;
    sortOrder: number;
    isActive: boolean;
  }[];
  workflows: FinanceWorkflow[];
  assignments: {
    id: number;
    employeeId: number;
    employeeName: string;
    role: FinanceRole;
    companyId: number | null;
    companyName: string | null;
    departmentId: number | null;
    departmentName: string | null;
    approvalLimit: number | null;
    isActive: boolean;
    note: string | null;
  }[];
  implicitRoles: Record<string, FinanceRole[]>;
  policies: FinancePolicy[];
  delegations: FinanceDelegation[];
  employees: {
    id: number;
    name: string;
    departmentId: number | null;
    departmentName: string | null;
    /** Công ty nhân viên thuộc về (xếp cùng phòng ban). */
    companyId: number | null;
    companyName: string | null;
  }[];
  /** `managers`: quản lý trực tiếp của riêng phòng ban, theo thứ tự ưu tiên chọn sẵn. */
  departments: { id: number; name: string; managers?: { id: number; name: string }[] }[];
  /** Giám đốc / nhân sự — được tạo tài khoản đăng nhập. */
  canCreateAccount?: boolean;
};

export type FinanceAccountInput = {
  name: string;
  phone: string;
  email?: string | null;
  password: string;
  departmentId: number;
};
