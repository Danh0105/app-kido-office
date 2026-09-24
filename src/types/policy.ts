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
    /**
     * Mặc định mọi % chính sách (QL1/QL2/TG/chi phí khác) tính trên học phí.
     * Một số chính sách phải trừ 2% thuế trước rồi mới tính % trên học phí
     * sau thuế → bật cờ này. Xem `policyPercentBase`.
     */
    percentAfterTax?: boolean;
};

/** Thuế trừ trước khi tính % chính sách (2%). */
export const POLICY_TAX_RATE = 0.02;

/** Mẫu số để quy tiền → % chính sách: học phí, hoặc học phí sau thuế 2% nếu bật cờ. */
export const policyPercentBase = (row: { fee?: number | string; percentAfterTax?: boolean } | null | undefined): number => {
    const fee = Number(row?.fee || 0);
    return row?.percentAfterTax ? fee * (1 - POLICY_TAX_RATE) : fee;
};

export type PolicyStatusValue =
    | "DRAFT"
    | "PENDING"
    | "SALE_ADMIN_APPROVED"
    | "DIRECTOR_APPROVED"
    | "REJECTED";

export type PolicyData = Record<string, unknown>;

/** 3 nhóm file đính kèm của một Policy. File cũ không có `category` -> coi như "CONTRACT". */
export type PolicyContractCategory = "CONTRACT" | "BBCS" | "HANDOVER_IMAGE";

export const POLICY_CONTRACT_CATEGORIES: PolicyContractCategory[] = [
    "CONTRACT",
    "BBCS",
    "HANDOVER_IMAGE",
];

export const POLICY_CONTRACT_CATEGORY_LABELS: Record<PolicyContractCategory, string> = {
    CONTRACT: "Hợp đồng đính kèm",
    BBCS: "BBCS đính kèm (cũ)",
    HANDOVER_IMAGE: "Hình ảnh bàn giao",
};

/** Một file hợp đồng PDF trong `contractFiles` — một chính sách có thể kèm nhiều file. */
export type PolicyContractFile = {
    id: string;
    url: string;
    originalName: string;
    size: number;
    uploadedById: number;
    uploadedByName?: string | null;
    uploadedAt: string;
    category?: PolicyContractCategory;
};

export type PolicyPageItem = {
    policyId: number;
    policyStatus: PolicyStatusValue;
    policyCreatedAt: string;
    schoolId: number;
    schoolName: string;
    subjectId: number;
    subjectName: string;
    schoolYear: string | null;
    employeeId: number | null;
    employeeName: string | null;
};

export type PolicyPageResponse = {
    data: PolicyPageItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type PolicyListItem = {
    policyId: number;
    status: PolicyStatusValue;
    createdAt: string;
    updatedAt: string;
    employeeId: number | null;
    employeeName: string | null;
    schoolId: number;
    schoolName: string;
    subjectId: number;
    subjectName: string;
    schoolYear: string | null;
    contractNumber: string | null;
    studentCount: number | null;
    totalLessons: number | null;
    policyData: PolicyData | null;
    currentHistoryId: number | null;
};

export type PolicyListResponse = {
    data: PolicyListItem[];
    meta: {
        page: number; limit: number; total: number; totalPages: number;
        hasNextPage: boolean; hasPreviousPage: boolean;
    };
};

export type PolicyFilterOptions = {
    statuses: Array<{ value: PolicyStatusValue; label: string }>;
    schools: Array<{ id: number; name: string }>;
    subjects: Array<{ id: number; name: string }>;
    schoolYears: string[];
    employees: Array<{ id: number; name: string | null }>;
};

export type PolicyDetail = {
    id: number;
    subjectId: number;
    subject: Record<string, unknown>;
    data: PolicyData;
    createdAt: string;
    updatedAt: string;
    status: PolicyStatusValue;
    note: string | null;
    currentHistoryId: number | null;
    durationMonths: number | null;
};

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
    status: "DIRECTOR_APPROVED";
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
