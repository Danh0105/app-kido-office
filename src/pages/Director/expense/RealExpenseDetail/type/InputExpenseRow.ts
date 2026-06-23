export type PaymentMethod = "cash" | "bank_transfer";
export type InvoiceType = "" | "company" | "student" | "none" | "other";

export type InputExpenseRow = {
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;

    unitPrice: number;

    invoiced: boolean;
    invoiceType: InvoiceType;
    invoiceOther: string;
    invoiceDate: string;

    paidAmount: number;
    paymentMethod: "" | "cash" | "bank_transfer";
    paymentDate: string;
};
