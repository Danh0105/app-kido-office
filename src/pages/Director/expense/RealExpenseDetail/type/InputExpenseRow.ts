export type PaymentMethod = "cash" | "bank_transfer";

export type InputExpenseRow = {
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;

    unitPrice: number;

    invoiced: boolean;
    invoiceDate: string;

    paidAmount: number;
    paymentMethod: "" | "cash" | "bank_transfer";
    paymentDate: string;
};