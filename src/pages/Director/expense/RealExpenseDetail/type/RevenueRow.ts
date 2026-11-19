export type RevenueRow = {
    /** id dòng Chi Trường đã lưu — dòng mới thêm chưa có */
    id?: number;
    subjectId: number;
    invoiceAmount: number;
    teacherUnitPrice?: number | string;
    taxUnitPrice?: number | string;
    csvcUnitPrice?: number | string;
    collectedDate: string;
    paidAmount: number;
    paymentDate: string;
    paymentType?: 'in_contract' | 'not_in_contract' | '';
    /** Nguồn chi — số hiệu tài khoản trong danh mục Nguồn thu chi */
    cashAccount?: string;
    remainingOutsideExpense: number;
    payer: string;
    note: string;
    /** Mã Đề xuất Chi Trường đã ghi Đã chi vào dòng — Ngày chi / Nguồn chi / Đã chi khoá. */
    suggestCodes?: string;
    /** Phần Đã chi do đề xuất ghi vào. */
    suggestPaidAmount?: number;
    /** Đề xuất chi trả từ nhiều nguồn chi: số tiền từng nguồn. */
    suggestSources?: { cashAccount: string | null; amount: number }[];
};
