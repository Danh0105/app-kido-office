import { PolicyStatus } from "@/pages/Director/enum/PolicyStatus";
import api from "./api";
import {
    DirectorPolicyUpdatePayload,
    DirectorPolicyUpdateResponse,
    PolicyDetail,
    PolicyFilterOptions,
    PolicyListResponse,
    PolicyPageResponse,
    PolicyContractFile,
    PolicyContractCategory,
} from "@/types/policy";

export const policiesApi = {
    /**
     * Upload một hoặc nhiều hợp đồng PDF. BE **nối vào danh sách** chứ không
     * ghi đè; response là policy đã lưu, có `contractFiles` (đầy đủ) và các
     * field `contractFileUrl/Name` cũ trỏ tới file mới nhất.
     */
    uploadContract: async (policyId: number, files: File | File[], category: PolicyContractCategory) => {
        const formData = new FormData();
        for (const file of Array.isArray(files) ? files : [files]) {
            formData.append("files", file);
        }
        formData.append("category", category);
        const res = await api.post(`/policies/${policyId}/contract`, formData);
        return res.data as { contractFiles?: PolicyContractFile[]; contractFileUrl?: string | null; contractFileName?: string | null };
    },
    /** Xoá một hợp đồng khỏi chính sách (theo `PolicyContractFile.id`). */
    removeContract: async (policyId: number, fileId: string) => {
        const res = await api.delete(`/policies/${policyId}/contract/${fileId}`);
        return res.data as { contractFiles?: PolicyContractFile[]; contractFileUrl?: string | null; contractFileName?: string | null };
    },
    // Contract của tab "Tất cả chính sách" — POLICY-ADMIN-LIST-API.md §3.
    // Không nhận `keyword`/`catalogId`: endpoint này không hỗ trợ tìm kiếm, và
    // lọc môn học đi theo `subjectId` (bản ghi môn thật), không phải danh mục.
    getAll: async (params: {
        page?: number; limit?: number; status?: string; schoolId?: number;
        subjectId?: number; schoolYear?: string; employeeId?: number;
        fromDate?: string; toDate?: string;
    } = {}): Promise<PolicyPageResponse> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) => value !== "" && value !== undefined && value !== null && value !== 0,
            ),
        );
        const res = await api.get(`/policies/all`, { params: cleanParams });
        return res.data;
    },

    getAdminAll: async (params: Record<string, string | number | undefined> = {}): Promise<PolicyListResponse> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) => value !== "" && value !== undefined && value !== null,
            ),
        );
        const res = await api.get(`/policies/admin/all`, { params: cleanParams });
        return res.data;
    },

    getFilterOptions: async (): Promise<PolicyFilterOptions> => {
        const res = await api.get(`/policies/filter-options`);
        return res.data;
    },
    getBySubject: async (subjectId: number) => {
        const res = await api.get(`/policies/subject/${subjectId}`);
        return res.data;
    },

    findOne: async (id: number): Promise<PolicyDetail> => {
        const res = await api.get(`/policies/${id}`);
        return res.data;
    },

    create: async (data: any) => {
        const res = await api.post(`/policies`, data);
        return res.data;
    },

    getHistory: async (subjectId: number) => {
        const res = await api.get(`/policies/history`, {
            params: { subjectId }
        });
        return res.data;
    },

    getHistoryByPolicy: async (policyId: number) => {
        const res = await api.get(`/policies/history/policy/${policyId}`);
        return res.data;
    },

    // ⚠️ Backend chưa có route này — gọi vào sẽ 404 (xem scripts/check-api-routes.mjs).
    rollback: async (historyId: number) => {
        const res = await api.post(`/policies/rollback/${historyId}`);
        return res.data;
    },

    adminUpdateStatusNote: async (
        id: number,
        data: {
            status: PolicyStatus;
            note?: string;
            userId?: number;
            name?: string;
            subjectId?: number;
        }
    ) => {
        const res = await api.patch(`/policies/${id}/admin-update`, data);
        return res.data;
    },

    update: async (id: number, data: any) => {
        const res = await api.patch(`/policies/${id}`, data);
        return res.data;
    },

    directorUpdate: async (
        id: number,
        data: DirectorPolicyUpdatePayload,
    ): Promise<DirectorPolicyUpdateResponse> => {
        const res = await api.patch(`/policies/${id}/director-update`, data);
        return res.data;
    },

    remove: async (id: number) => {
        const res = await api.delete(`/policies/${id}`);
        return res.status === 204 ? true : res.data;
    },

    getByCurrentHistoryId: async (historyId: number) => {
        const res = await api.get(`/policies/by-history/${historyId}`);
        return res.data;
    },
    getStatsAdvanced: async (params: {
        employeeId: number;
        fromDate?: string;
        toDate?: string;
        allStatuses?: boolean;
    }) => {
        console.log("Fetching policy stats with params:", params); // Debug log
        const res = await api.get(`/policies/stats`, { params });
        return res.data;
    },
    getStatsBySchool: async (params: {
        schoolId: number;
        subjectId?: number;
        schoolYear?: string;
    }) => {
        const res = await api.get(`/policies/stats/school`, { params });
        return res.data;
    },
};
