import api from "./api";

const BASE_URL = "https://sales.kidoedu.vn";

export const schoolApi = {
    getAll: async (params?: any) => {
        const res = await api.get(`/schools`, {
            params,
        });
    
        return res.data;
    },

    getByEmployee: async (employeeId: number) => {
        const res = await api.get(`/schools`, {
            params: { employeeId }
        });
        return res.data;
    },

    // ✅ SEARCH SCHOOL
    search: async (keyword: string) => {
        const res = await api.get(`/schools/search/${keyword}`);
        return res.data;
    },

    create: async (data: any) => {
        const res = await api.post(`/schools`, data);
        return res.data;
    },

    update: async (id: number, data: any) => {
        const res = await api.put(`/schools/${id}`, data);
        return res.data;
    },

    updateStatus: async (id: number, status: number) => {
        const res = await api.patch(`/schools/${id}/status`, { status });
        return res.data;
    },

    getByEmployeeRegion: async (employeeRegionId: number) => {
        const res = await api.get(`/schools/employee-region/${employeeRegionId}`);
        return res.data;
    },

    getWithoutEmployeeRegion: async () => {
        const res = await api.get(`/schools/no-employee-region`);
        return res.data;
    },

    getByEmployeeAndWard: async (
        employeeId: number,
        wardId: number
    ) => {
        const res = await api.get(`/schools/by-employee-ward`, {
            params: { employeeId, wardId },
        });

        return res.data;
    },
};