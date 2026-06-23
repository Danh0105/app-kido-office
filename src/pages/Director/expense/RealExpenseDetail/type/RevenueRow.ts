export type RevenueRow = {
    subjectId: number;
    invoiceAmount: number;
    teacherUnitPrice?: number | string;
    taxUnitPrice?: number | string;
    csvcUnitPrice?: number | string;
    collectedDate: string;
    paidAmount: number;
    paymentDate: string;
    remainingOutsideExpense: number;
    payer: string;
    note: string;
};
