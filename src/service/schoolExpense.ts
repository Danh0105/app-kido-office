import api from "./api";

export type RevenueItemPayload = {
  rowIndex: number;
  subjectId: number;
  content?: string;
  totalPeriods: number;
  studentCount: number;
  monthsCount: number;
  unitPrice: number;
  invoiced?: boolean;
  invoiceType?: string;
  invoiceOther?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  /** ĐVT trên hóa đơn */
  invoiceUnit?: string;
  /** Ngày chi (bảng Hóa Đơn) */
  invoicePaymentDate?: string;
  /** Khoản thu/chi — số hiệu tài khoản Nguồn thu chi */
  invoiceCashAccount?: string;
  /** Ghi chú (bảng Hóa Đơn) */
  invoiceNote?: string;
  /** Đã bấm "Xuất hóa đơn" — khóa dòng */
  invoiceLocked?: boolean;
  /** "Tổng thanh toán công ty" nhập tay; null = tự tính. */
  companyPaymentTotal?: number | null;
  paidAmount: number;
  paymentMethod?: string;
  paymentDate?: string;
};

export type SchoolExpenseItemPayload = {
  rowIndex: number;
  subjectId: number;
  totalPeriods: number;
  studentCount: number;
  monthsCount: number;
  teacherUnitPrice: number;
  taxUnitPrice: number;
  csvcUnitPrice: number;
  paidAmount: number;
  expenseDate?: string;
  /** Hình thức chi */
  paymentType?: "in_contract" | "not_in_contract";
  payer?: string;
  note?: string;
};

export type ManagementExpenseItemPayload = {
  rowIndex: number;
  subjectId: number;
  totalPeriods: number;
  studentCount: number;
  monthsCount: number;
  ql1UnitPrice: number;
  ql1Tax?: number;
  ql2UnitPrice: number;
  ql2Tax?: number;
  otherCosts?: Array<{
    id?: string | number;
    name?: string;
    unitPrice: number;
    tax: number;
  }>;
  invoiceAmount?: number;
  paidAmount: number;
  expenseDate?: string;
  /** Nguồn chi — số hiệu tài khoản Nguồn thu chi */
  cashAccount?: string;
  payer?: string;
  note?: string;
};

/** 1 dòng bảng Giáo viên trường gửi lên khi "Lưu tất cả" (server tự tính tiền). */
export type SchoolTeacherItemPayload = {
  id?: number;
  rowIndex: number;
  /** Giáo viên trong danh sách giáo viên của trường. */
  schoolTeacherId?: number | null;
  /** Chỉ dòng thêm riêng (sau dòng Doanh Thu cuối). */
  content?: string;
  totalPeriods?: number;
  studentCount?: number;
  monthsCount?: number;
  unitPrice: number;
  /** Thuế TNCN nhập tay; null = server tự tính. */
  pitAmount?: number | null;
  expenseDate?: string;
  cashAccount?: string;
  note?: string;
};

export type SaveSchoolExpensePayload = {
  subjectId: number;
  revenueItems: RevenueItemPayload[];
  schoolExpenseItems: SchoolExpenseItemPayload[];
  managementExpenseItems: ManagementExpenseItemPayload[];
  /** Có từ kỳ 11/2026 — kèm thì Chi Trường bỏ phần Giáo viên trường. */
  schoolTeacherItems?: SchoolTeacherItemPayload[];
};

/** Giáo viên của trường (không phải giáo viên Kido) nhận lương ở bảng Giáo viên trường. */
export type SchoolTeacher = {
  id: number;
  schoolId: number;
  name: string;
  bankAccount: string | null;
  bankName: string | null;
  taxCode: string | null;
  note: string | null;
  isActive: boolean;
};

export type SchoolTeacherInput = {
  schoolId?: number;
  name?: string;
  bankAccount?: string;
  bankName?: string;
  taxCode?: string;
  note?: string;
  isActive?: boolean;
};

export type SchoolTeacherItem = {
  id: number;
  rowIndex: number;
  schoolTeacherId: number | null;
  content: string | null;
  totalPeriods: number;
  studentCount: number;
  monthsCount: number;
  unitPrice: number;
  amount: number;
  pitRate: number;
  pitAmount: number;
  /** Thuế TNCN kế toán nhập tay (giữ đúng pitAmount); false = tự tính. */
  pitManual?: boolean;
  netAmount: number;
  expenseDate: string | null;
  cashAccount: string | null;
  note: string | null;
  paid: boolean;
  /** Đã trả theo Đề xuất Chi GV trường: Ngày chi / Nguồn chi khoá, hiện mã. */
  suggestCodes?: string;
};

export type SchoolTeacherApproval = {
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string;
};

export type SchoolTeacherItemsResponse = {
  /** Kỳ từ 11/2026 mới có bảng Giáo viên trường. */
  applies: boolean;
  schoolId: number | null;
  /** Giáo viên đang dùng của trường (+ người đã ngừng nhưng còn trên bảng). */
  teachers: SchoolTeacher[];
  /** Thù lao của từng giáo viên ở các môn khác cùng bảng thu chi (tính ngưỡng thuế). */
  otherSubjectGross: Record<number, number>;
  items: SchoolTeacherItem[];
  approval: SchoolTeacherApproval | null;
};

export type SchoolTeacherPayrollActivity = {
  itemId: number;
  subjectId: number;
  subjectName: string;
  rowIndex: number;
  className: string | null;
  totalPeriods: number;
  studentCount: number;
  monthsCount: number;
  unitPrice: number;
  amount: number;
  pitRate: number;
  pitAmount: number;
  netAmount: number;
  expenseDate: string | null;
  cashAccount: string | null;
  paid: boolean;
};

export type SchoolTeacherPayrollTeacher = {
  /** null = các dòng chưa chọn giáo viên. */
  teacherId: number | null;
  name: string | null;
  bankAccount: string | null;
  bankName: string | null;
  taxCode: string | null;
  classes: string[];
  activities: SchoolTeacherPayrollActivity[];
  gross: number;
  tax: number;
  net: number;
  paidNet: number;
};

export type SchoolTeacherPayrollSheet = {
  schoolExpenseId: number;
  schoolId: number;
  schoolName: string;
  period: { id: number; month: number; year: number; name: string | null };
  approvals: {
    subjectId: number;
    approvedByName: string | null;
    approvedAt: string;
  }[];
  teachers: SchoolTeacherPayrollTeacher[];
  totals: {
    teacherCount: number;
    unassignedRows: number;
    gross: number;
    tax: number;
    net: number;
    paidNet: number;
  };
};

export type SchoolTeacherPayrollReport = {
  sheets: SchoolTeacherPayrollSheet[];
  totals: {
    sheetCount: number;
    teacherCount: number;
    gross: number;
    tax: number;
    net: number;
    paidNet: number;
  };
};

/** Danh sách giáo viên trường + báo cáo Lương giáo viên trường. */
export const schoolTeacherApi = {
  list: async (schoolId: number): Promise<SchoolTeacher[]> => {
    const res = await api.get(`/school-teachers`, { params: { schoolId } });
    return res.data;
  },
  create: async (data: SchoolTeacherInput): Promise<SchoolTeacher> => {
    const res = await api.post(`/school-teachers`, data);
    return res.data;
  },
  update: async (
    id: number,
    data: SchoolTeacherInput
  ): Promise<SchoolTeacher> => {
    const res = await api.patch(`/school-teachers/${id}`, data);
    return res.data;
  },
  /** Ngừng dùng — không xoá để kỳ cũ vẫn hiện tên. */
  deactivate: async (id: number): Promise<SchoolTeacher> => {
    const res = await api.delete(`/school-teachers/${id}`);
    return res.data;
  },
  payrollReport: async (params: {
    year?: number;
    month?: number;
    schoolId?: number;
    schoolExpenseId?: number;
  }): Promise<SchoolTeacherPayrollReport> => {
    const res = await api.get(`/school-teacher-payroll`, { params });
    return res.data;
  },
};

/** 1 dòng hàng trên hóa đơn điện tử — ứng với 1 dòng doanh thu (rowIndex). */
export type RevenueEInvoiceLine = {
  rowIndex: number;
  itemName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

/** Hóa đơn điện tử (nháp Viettel) gộp các dòng doanh thu "Xuất HĐ Cty" của môn. */
export type RevenueEInvoice = {
  id: number;
  status: "DRAFT_CREATED" | "FAILED";
  lines: RevenueEInvoiceLine[];
  /** Tổng tiền hóa đơn. */
  amount: string;
  buyerName: string;
  buyerTaxCode: string;
  errorCode: string | null;
  errorMessage: string | null;
  /** Lần gần nhất Viettel nhận nháp thành công. */
  draftedAt: string | null;
  exportedByName: string | null;
  updatedAt: string;
};

export type EInvoiceExportResult = {
  /** Dòng doanh thu nằm trên hóa đơn. */
  rowIndexes: number[];
  amount: number | null;
  /** changed: đã có nháp nhưng số liệu dòng đổi sau đó — phải sửa nháp trên portal Viettel. */
  status: "created" | "unchanged" | "changed" | "error";
  message?: string;
};

export type EInvoiceExportSummary = {
  /** Hóa đơn nháp gộp các dòng chưa có hóa đơn — null khi không có dòng mới. */
  draft: EInvoiceExportResult | null;
  /** Hóa đơn nháp đã tạo từ trước, so với dữ liệu hiện tại. */
  existing: EInvoiceExportResult[];
  /** Dòng "Xuất HĐ Cty" không đưa vào hóa đơn (thành tiền 0). */
  skipped: Array<{ rowIndex: number; itemName: string; message: string }>;
};

export type AccountingCashflowSummaryItem = {
  schoolExpenseId: number;
  school: { id: number; name: string };
  period: { id: number; name: string | null; month: number; year: number };
  finalized: boolean;
  revenue: { expected: number; collected: number; receivable: number };
  expense: {
    expected: number;
    paid: number;
    payable: number;
    school: { expected: number; paid: number; payable: number };
    management: { expected: number; paid: number; payable: number };
  };
  cashPolicy: number;
  /**
   * Tổng hợp bảng Hóa Đơn (Tổng thanh toán công ty): total = issued (đã xuất —
   * dòng đã khoá Xuất hóa đơn hoặc có số HĐ) + notIssued + noInvoice (dòng
   * "Không xuất HĐ"). Server cũ chưa có thì không có trường này.
   */
  invoice?: {
    total: number;
    issued: number;
    notIssued: number;
    noInvoice: number;
    /** Đã thu theo Hóa Đơn: Số tiền thu/chi của dòng chọn "Thu" (server từ 14/11). */
    collected?: number;
  };
  /** Số liệu theo môn; khoản không có subject_id vẫn nằm ở tổng cấp phiếu. */
  subjects?: Array<{
    subject: { id: number; name: string };
    quantity: { students: number; periods: number };
    revenue: { expected: number; collected: number; receivable: number };
    expense: {
      expected: number;
      paid: number;
      payable: number;
      school: { expected: number; paid: number; payable: number };
      management: { expected: number; paid: number; payable: number };
    };
    invoice: {
      total: number;
      issued: number;
      notIssued: number;
      noInvoice: number;
      collected?: number;
    };
    breakdown: {
      school: { expected: number; paid: number };
      outside: { expected: number; paid: number };
      schoolTeacher: number;
      companyTeacher: number;
      annualPolicy: number;
      other: number;
      profit: number;
    };
  }>;
  projectedBalance: number;
  projectedBalanceAfterPolicy: number;
  cashBalance: number;
};

export type AccountingCashflowSummary = {
  totals: {
    expectedRevenue: number;
    collectedRevenue: number;
    receivable: number;
    expectedExpense: number;
    paidExpense: number;
    payable: number;
    cashPolicy: number;
    projectedBalance: number;
    projectedBalanceAfterPolicy: number;
    cashBalance: number;
  };
  count: number;
  items: AccountingCashflowSummaryItem[];
};

export const schoolExpenseApi = {
  getCashflowSummary: async (params?: {
    year?: number;
    month?: number;
    schoolId?: number;
    subjectId?: number;
    finalized?: boolean;
  }): Promise<AccountingCashflowSummary> => {
    const res = await api.get(`/accounting/cashflow-summary`, { params });
    return res.data;
  },

  // GET ALL
  getAll: async (params?: any) => {
    const res = await api.get(`/school-expenses`, {
      params,
    });

    return res.data;
  },

  // GET ONE
  getById: async (id: number) => {
    const res = await api.get(`/school-expenses/${id}`);

    return res.data;
  },

  // CREATE
  create: async (data: { schoolId: number; periodId: number }) => {
    const res = await api.post(`/school-expenses`, data);

    return res.data;
  },

  // UPDATE
  update: async (id: number, data: any) => {
    const res = await api.patch(`/school-expenses/${id}`, data);

    return res.data;
  },

  // DELETE
  delete: async (id: number) => {
    const res = await api.delete(`/school-expenses/${id}`);

    return res.data;
  },
  saveAll: async (id: number, data: SaveSchoolExpensePayload) => {
    const res = await api.post(`/school-expenses/${id}/save-all`, data);
    return res.data;
  },

  getSchoolTeacherItems: async (
    id: number,
    subjectId: number
  ): Promise<SchoolTeacherItemsResponse> => {
    const res = await api.get(`/school-expenses/${id}/school-teacher-items`, {
      params: { subjectId },
    });
    return res.data;
  },

  /** "Duyệt lương" bảng Giáo viên trường của một môn (Giám đốc / Kế toán trưởng). */
  approveSchoolTeacher: async (
    id: number,
    subjectId: number
  ): Promise<SchoolTeacherItemsResponse> => {
    const res = await api.post(
      `/school-expenses/${id}/school-teacher-items/approve`,
      { subjectId }
    );
    return res.data;
  },

  getSummary: async (id: number, subjectId?: number) => {
    const res = await api.get(`/school-expenses/${id}/summary`, {
      params: subjectId ? { subjectId } : {},
    });
    return res.data;
  },

  getItems: async (id: number, subjectId?: number) => {
    const res = await api.get(`/school-expenses/${id}/items`, {
      params: subjectId ? { subjectId } : {},
    });
    return res.data;
  },

  getHistory: async (id: number, params?: { subjectId?: number }) => {
    const res = await api.get(`/school-expenses/${id}/history`, { params });
    return res.data;
  },

  /**
   * Sales admin xác nhận bảng "Chi Ngoài" của MỘT MÔN → khoá chỉnh sửa môn đó
   * (chỉ kế toán trưởng còn sửa được).
   */
  confirmManagementExpense: async (id: number, subjectId: number) => {
    const res = await api.post(
      `/school-expenses/${id}/confirm-management-expense`,
      { subjectId }
    );
    return res.data;
  },

  /** Kế toán trưởng mở khoá "Xác nhận đúng BBCS" của MỘT MÔN. */
  unconfirmManagementExpense: async (id: number, subjectId: number) => {
    const res = await api.post(
      `/school-expenses/${id}/unconfirm-management-expense`,
      { subjectId }
    );
    return res.data;
  },

  /** Kế toán trưởng "Kết thúc" kỳ thu chi — khoá toàn bộ */
  finalize: async (id: number) => {
    const res = await api.post(`/school-expenses/${id}/finalize`);
    return res.data;
  },

  /** Kế toán trưởng mở lại kỳ thu chi đã kết thúc */
  reopen: async (id: number) => {
    const res = await api.post(`/school-expenses/${id}/reopen`);
    return res.data;
  },

  /** Trạng thái hóa đơn điện tử của các dòng doanh thu trong 1 môn */
  getEInvoices: async (
    id: number,
    subjectId: number
  ): Promise<RevenueEInvoice[]> => {
    const res = await api.get(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices`
    );
    return res.data;
  },

  /** "Đẩy hóa đơn": gộp các dòng "Xuất HĐ Cty" chưa có hóa đơn thành 1 hóa đơn nháp Viettel */
  exportEInvoiceDrafts: async (
    id: number,
    subjectId: number
  ): Promise<EInvoiceExportSummary> => {
    const res = await api.post(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices/drafts`
    );
    return res.data;
  },

  /**
   * KTT "Bỏ liên kết nháp" sau khi đã xóa hóa đơn nháp trên portal Viettel —
   * các dòng của hóa đơn được mở khóa và đẩy lại được.
   */
  unlinkEInvoice: async (
    id: number,
    subjectId: number,
    einvoiceId: number
  ): Promise<{ rowIndexes: number[] }> => {
    const res = await api.delete(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices/${einvoiceId}`
    );
    return res.data;
  },

  checkExisted: async (schoolId: number, periodId: number) => {
    const res = await api.get(`/school-expenses/check-existed`, {
      params: {
        schoolId,
        periodId,
      },
    });

    return res.data;
  },
};
