import api from "./api";

export const provinceApi = {
    getAll: async () => {
        const res = await api.get(`/provinces`);
        return res.data;
    },

    getById: async (id: number) => {
        const res = await api.get(`/provinces/${id}`);
        return res.data;
    },

    create: async (data: { name: string }) => {
        const res = await api.post(`/provinces`, data);
        return res.data;
    },

    update: async (id: number, data: { name?: string }) => {
        const res = await api.patch(`/provinces/${id}`, data);
        return res.data;
    },

    delete: async (id: number) => {
        const res = await api.delete(`/provinces/${id}`);
        return res.data;
    },
    getProvincesByEmployee: async (employeeId: number) => {
        const res = await api.get(`/provinces/provinces-by-employee/${employeeId}`);
        return res.data;
    },

    getAvailableProvinces: async (employeeId: number) => {
        const res = await api.get(`/provinces/available-provinces/${employeeId}`);
        return res.data;
    },
    handoverRegion(data: any) {
        return api.post(
            '/provinces/handover',
            data,
        );
    },
    revokeProvince(
        employeeId: number,
        provinceId: number,
    ) {
        return api.delete(
            `/provinces/revoke/province/${employeeId}/${provinceId}`
        );
    }
};