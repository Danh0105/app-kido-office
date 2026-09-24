import api from "./api";

/** Một môn của năm cũ và những gì được tạo cho năm mới. */
export type RolloverItem = {
    fromSubjectId: number;
    name: string;
    catalogId: number | null;
    /** Số chính sách **đã duyệt** của năm cũ sẽ được sao chép. */
    approvedPolicies: number;
    /** null khi chỉ xem trước hoặc môn bị bỏ qua. */
    toSubjectId: number | null;
    status: "COPIED" | "SKIPPED";
    reason?: string;
};

export type RolloverResult = {
    dryRun: boolean;
    schoolId: number;
    schoolName: string;
    fromYear: string;
    toYear: string;
    subjectsCopied: number;
    subjectsSkipped: number;
    policiesCopied: number;
    items: RolloverItem[];
};

type RolloverInput = {
    schoolId: number;
    fromYear: string;
    toYear: string;
    /** Id môn **của năm nguồn** cần áp. Bỏ trống = áp toàn bộ môn của năm đó. */
    subjectIds?: number[];
};

/**
 * Áp môn học + chính sách đã duyệt của năm học cũ sang năm học mới.
 *
 * Backend tạo bản ghi môn của năm mới theo thông tin môn năm cũ, rồi sao chép
 * chính sách **đã được giám đốc duyệt** sang ở trạng thái `DRAFT` — vẫn phải đi
 * lại quy trình duyệt của năm mới.
 */
export const schoolYearRolloverApi = {
    /** Xem trước: môn nào được tạo, bao nhiêu chính sách đi theo, môn nào bị bỏ qua. */
    preview: async (input: RolloverInput): Promise<RolloverResult> => {
        const res = await api.post(`/school-year-rollover/preview`, input);
        return res.data;
    },

    /** Chạy thật. `dryRun: false` phải gửi tường minh, mặc định của backend là xem trước. */
    apply: async (input: RolloverInput): Promise<RolloverResult> => {
        const res = await api.post(`/school-year-rollover`, {
            ...input,
            dryRun: false,
        });
        return res.data;
    },
};
