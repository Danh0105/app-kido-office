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

export type PolicyData = Record<string, any>;

export type PolicyDiffValue = {
    old: any;
    new: any;
};

export type PolicyDiff = {
    [fieldName: string]: PolicyDiffValue | PolicyDiff;
};

export type PolicyHistoryEntry = {
    id: number;
    policyId?: number;
    action: string;
    updatedBy?: string | { id?: number; name?: string };
    updatedByName?: string;
    oldData?: PolicyData | null;
    newData?: PolicyData | null;
    diff?: PolicyDiff | null;
    note?: string | null;
    status?: string | number;
    createdAt: string;
};

export type DirectorPolicyUpdatePayload = {
    employeeId: number;
    data: PolicyData;
    note?: string;
    durationMonths?: number;
};

export type DirectorPolicyUpdateResponse = {
    policy: {
        id: number;
        subjectId: number;
        data: PolicyData;
        status: string;
        note?: string | null;
        currentHistoryId?: number;
        durationMonths?: number;
        createdAt?: string;
        createdBy?: number | { id?: number; name?: string };
        employeeId?: number;
    };
    histories: PolicyHistoryEntry[];
};
