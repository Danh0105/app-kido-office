export type ManagementRow = {
  ql1UnitPrice?: number | string;
  ql1Tax?: number | string;
  ql2UnitPrice?: number | string;
  ql2Tax?: number | string;
  otherCostUnitPrices?: Record<string, number | string>;
  otherCostTaxes?: Record<string, number | string>;
  totalOutsideExpense: number;
  paidAmount: number;
  remainingOutsideExpense: number;
  paymentDate: string;
  payer: string;
  note: string;
};
