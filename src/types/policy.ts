// types/policy.type.ts
export type OtherCost = {
    id: string;
    name: string;
    percent: number;
    tax: number;
};

export type RowType = {
    id: number;
    name: string;
    qlCsvc: number;
    tax: number;
    teacher: number;
    totalPercent: number;
    company: number;
    ql1Percent: number;
    ql1Tax: number;
    ql2Percent: number;
    ql2Tax: number;
    tgPercent: number;
    tgTax: number;
    total: number;
    fee: number;
    otherCosts?: OtherCost[];
    durationMonths?: number;
};