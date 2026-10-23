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
  /** Đã bấm "Xuất hóa đơn" — khóa dòng */
  invoiceLocked?: boolean;
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
  payer?: string;
  note?: string;
};

export type SaveSchoolExpensePayload = {
  subjectId: number;
  revenueItems: RevenueItemPayload[];
  schoolExpenseItems: SchoolExpenseItemPayload[];
  managementExpenseItems: ManagementExpenseItemPayload[];
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

export const schoolExpenseApi = {
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

  /** Sales admin xác nhận bảng "Chi Ngoài" → khoá chỉnh sửa (chỉ kế toán trưởng còn sửa được). */
  confirmManagementExpense: async (id: number) => {
    const res = await api.post(`/school-expenses/${id}/confirm-management-expense`);
    return res.data;
  },

  /** Kế toán trưởng mở khoá "Xác nhận đúng BBCS" */
  unconfirmManagementExpense: async (id: number) => {
    const res = await api.post(
      `/school-expenses/${id}/unconfirm-management-expense`,
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
    subjectId: number,
  ): Promise<RevenueEInvoice[]> => {
    const res = await api.get(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices`,
    );
    return res.data;
  },

  /** "Đẩy hóa đơn": gộp các dòng "Xuất HĐ Cty" chưa có hóa đơn thành 1 hóa đơn nháp Viettel */
  exportEInvoiceDrafts: async (
    id: number,
    subjectId: number,
  ): Promise<EInvoiceExportSummary> => {
    const res = await api.post(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices/drafts`,
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
    einvoiceId: number,
  ): Promise<{ rowIndexes: number[] }> => {
    const res = await api.delete(
      `/school-expenses/${id}/subjects/${subjectId}/einvoices/${einvoiceId}`,
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
