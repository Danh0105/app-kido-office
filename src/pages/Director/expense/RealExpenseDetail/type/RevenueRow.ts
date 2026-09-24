export type RevenueRow = {
    subjectId: number;
    invoiceAmount: number;
    teacherUnitPrice?: number | string;
    taxUnitPrice?: number | string;
    csvcUnitPrice?: number | string;
    collectedDate: string;
    paidAmount: number;
    paymentDate: string;
    paymentType?: 'in_contract' | 'not_in_contract' | '';
    remainingOutsideExpense: number;
    payer: string;
    note: string;
};
