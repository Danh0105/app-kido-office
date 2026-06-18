import api from "./api";

export const wardApi = {
    getAll: async (province_id?: number) => {
        const res = await api.get(`/wards`, {
            params: province_id ? { province_id } : {},
        });
        return res.data;
    },

    getById: async (id: number) => {
        const res = await api.get(`/wards/${id}`);
        return res.data;
    },

    create: async (data: { name: string; province_id: number }) => {
        const res = await api.post(`/wards`, data);
        return res.data;
    },

    update: async (
        id: number,
        data: { name?: string; province_id?: number }
    ) => {
        const res = await api.patch(`/wards/${id}`, data);
        return res.data;
    },

    delete: async (id: number) => {
        const res = await api.delete(`/wards/${id}`);
        return res.data;
    },

    // 👉 lấy ward theo province (dùng dropdown)
    getByProvince: async (provinceId: number) => {
        const res = await api.get(`/wards`, {
            params: { province_id: provinceId },
        });
        return res.data;
    },
    getByEmployee: async (
        employeeId: number,
        provinceId?: number,
    ) => {
        const res = await api.get(
            `/wards/employee/${employeeId}`,
            {
                params: provinceId
                    ? { provinceId }
                    : {},
            },
        );

        return res.data;
    },
    revokeWard(
        employeeId: number,
        wardId: number,
    ) {
        return api.delete(
            `/wards/revoke/ward/${employeeId}/${wardId}`
        );
    }
};