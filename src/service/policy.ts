import { PolicyStatus } from "@/pages/Director/enum/PolicyStatus";
import api from "./api";

export const policiesApi = {
    getBySubject: async (subjectId: number) => {
        const res = await api.get(`/policies/subject/${subjectId}`);
        return res.data;
    },

    findOne: async (id: number) => {
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