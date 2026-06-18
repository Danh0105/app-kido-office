export type ExpenseRow = {
    subjectId: string;
    totalPeriods: string;
    studentCount: string;
    invoiceAmount: string;
    collectedDate: string;
    totalOutsideExpense: string;
    paidAmount: string;
    remainingOutsideExpense: string;
    paymentDate: string;
    payer: string;
    note: string;
  };
  
  export type CashPolicyRow = {
    payer: string;
    cashPolicyAmount: string;
    otherAmount: string;
    paymentDate: string;
    note: string;
  };