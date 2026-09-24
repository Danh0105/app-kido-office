import api from "./api";

/**
 * Danh mục môn học — danh sách option dùng chung (STEM, Kỹ năng sống…)
 * do sales admin quản lý.
 *
 * ⚠️ Khác với `/subjects` (môn học của từng trường, có hợp đồng / số HS / số tiết).
 * Xem `subject.api.ts`.
 */
export interface SubjectCatalog {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
    isActive: boolean;
    /** Số nhỏ hiện trước; backend đã sắp xếp sẵn nên FE giữ nguyên thứ tự trả về. */
    sortOrder: number;
    /** Số môn học của trường đang dùng môn này. */
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface SubjectCatalogPayload {
    name: string;
    code?: string | null;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
}

/** Role được phép ghi danh mục — khớp CATALOG_ADMIN_ROLES của backend. */
export const CATALOG_ADMIN_ROLES = ["saleadmin", "salesadmin_la"];

export const subjectCatalogApi = {
    /**
     * Mặc định chỉ trả môn đang dùng — đúng cho dropdown của nhân viên kinh doanh.
     * `includeInactive` chỉ dùng ở màn quản lý của sales admin.
     */
    list: async (params: {
        includeInactive?: boolean;
        search?: string;
    } = {}): Promise<SubjectCatalog[]> => {
        const res = await api.get(`/subject-catalogs`, {
            params: {
                includeInactive: params.includeInactive ? "true" : undefined,
                search: params.search?.trim() || undefined,
            },
        });
        return Array.isArray(res.data) ? res.data : [];
    },

    findOne: async (id: number): Promise<SubjectCatalog> => {
        const res = await api.get(`/subject-catalogs/${id}`);
        return res.data;
    },

    // 409 khi trùng tên hoặc trùng mã môn.
    create: async (data: SubjectCatalogPayload): Promise<SubjectCatalog> => {
        const res = await api.post(`/subject-catalogs`, data);
        return res.data;
    },

    update: async (
        id: number,
        data: Partial<SubjectCatalogPayload>,
    ): Promise<SubjectCatalog> => {
        const res = await api.patch(`/subject-catalogs/${id}`, data);
        return res.data;
    },

    /** Ngừng / bật lại một môn. Môn học cũ đang dùng môn này không bị ảnh hưởng. */
    setActive: async (id: number, isActive: boolean): Promise<SubjectCatalog> => {
        const res = await api.patch(`/subject-catalogs/${id}`, { isActive });
        return res.data;
    },

    // 409 kèm message gợi ý tắt thay vì xoá khi môn đang được trường sử dụng.
    remove: async (id: number): Promise<{ deleted: boolean; id: number }> => {
        const res = await api.delete(`/subject-catalogs/${id}`);
        return res.data;
    },
};
