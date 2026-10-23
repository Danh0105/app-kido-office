export type PaymentMethod = "cash" | "bank_transfer";
export type InvoiceType = "" | "company" | "student" | "none" | "other";

export type InputExpenseRow = {
    content: string;
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;

    unitPrice: number;

    invoiced: boolean;
    /** Đã bấm "Xuất hóa đơn" — khóa các cột nhập của Doanh Thu và Chi Trường (trừ Đã thu / Đã chi) */
    invoiceLocked: boolean;
    invoiceType: InvoiceType;
    invoiceOther: string;
    /** Số hóa đơn — chỉ nhập khi xuất HĐ công ty */
    invoiceNumber: string;
    invoiceDate: string;
    /** Đơn vị tính trên hóa đơn (vd: bộ, cái, gói...) */
    invoiceUnit: string;
    /** Ghi chú trên hóa đơn */
    invoiceNote: string;
    /** Ngày chi (bảng Hóa Đơn) */
    invoicePaymentDate: string;
    /** Khoản thu/chi — số hiệu tài khoản trong danh mục Nguồn thu chi */
    invoiceCashAccount: string;

    paidAmount: number;
    paymentMethod: "" | "cash" | "bank_transfer";
    paymentDate: string;
};
