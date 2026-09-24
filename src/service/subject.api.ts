import api from "./api";
import type { SubjectCatalog } from "./subjectCatalog.api";
import { stripRateFields } from "@/pages/Teaching/lib";

export interface Subject {
    id: number;
    /** Tên môn — backend lấy theo danh mục khi tạo/đổi môn. */
    name: string;
    code?: string;
    /** Môn trong danh mục. `null` với dữ liệu cũ chưa map được → hiển thị `name`. */
    catalogId?: number | null;
    catalog?: SubjectCatalog | null;
    schoolId: number;
    classCount?: number;
    studentCount?: number;
    totalLessons?: number;
    contractNumber?: string;
    contractDuration?: number;
    appendixDuration?: number;
    startDate?: string;
    schoolYear?: string;
    /** Đơn giá mỗi tiết dạy môn này tại trường này — chỉ Nhân sự khai được. */
    ratePerPeriod?: number | null;
    policyCount?: number;
    createdAt?: string;
    school?: {
        id: number;
        name?: string;
    };
}

export const subjectApi = {
    getAll: async (): Promise<Subject[]> => {
        const res = await api.get<Subject[]>(`/subjects`);
        return res.data;
    },

    getBySchool: async (schoolId: number) => {
        const res = await api.get(`/subjects`, {
            params: { schoolId }
        });
        return res.data;
    },

    getBySchoolYear: async (
        schoolYear: string,
        schoolId: number
    ) => {
        const res = await api.get(
            `/subjects/school/${encodeURIComponent(schoolYear)}`,
            {
                params: { schoolId },
            }
        );

        return res.data;
    },

    findOne: async (id: number) => {
        const res = await api.get(`/subjects/${id}`);
        return res.data;
    },

    create: async (data: any) => {
        const res = await api.post(`/subjects`, stripRateFields(data));
        return res.data;
    },

    update: async (id: number, data: any) => {
        const res = await api.put(
            `/subjects/${id}`,
            stripRateFields(data)
        );

        return res.data;
    },

    remove: async (id: number) => {
        const res = await api.delete(
            `/subjects/${id}`
        );

        return res.status === 204
            ? true
            : res.data;
    },

    /**
     * Lọc trường theo môn.
     * Ưu tiên `catalogId` (khớp chính xác theo danh mục); `name` là đường cũ,
     * lọc gần đúng theo tên, chỉ dùng cho dữ liệu chưa map danh mục.
     */
    getBySubject: async (params?: {
        schoolYear?: string;
        catalogId?: number;
        name?: string;
    }) => {
        const res = await api.get(
            `/subjects/by-subject`,
            { params }
        );

        return res.data;
    },

    /**
     * Áp cùng một đơn giá cho nhiều môn học (mỗi phần tử là môn của một
     * trường) cùng lúc — dùng khi nhiều trường dạy cùng môn và Nhân sự thoả
     * cùng một mức giá, khỏi phải sửa từng trường một qua `update()`.
     */
    bulkUpdateRate: async (data: {
        subjectIds: number[];
        ratePerPeriod: number;
    }): Promise<Subject[]> => {
        const res = await api.patch(`/subjects/bulk-rate`, data);
        return res.data;
    },

    getFinanceBySchool: async (
        schoolId: number,
        schoolYear?: string,
    ) => {
        const res = await api.get(
            `/subjects/finance/${schoolId}`,
            {
                params: {
                    schoolYear,
                },
            },
        );

        return res.data;
    },
};
