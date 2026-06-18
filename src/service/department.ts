import api from "./api";

export const departmentApi = {
    findAll: async () => {
        const res = await api.get(`/departments`);
        return res.data;
    },

    findOne: async (id: number) => {
        const res = await api.get(`/departments/${id}`);
        return res.data;
    },

    create: async (data: {
        name: string;
        description?: string;
    }) => {
        const res = await api.post(`/departments`, data);
        return res.data;
    },

    update: async (
        id: number,
        data: {
            name?: string;
            description?: string;
        }
    ) => {
        const res = await api.patch(`/departments/${id}`, data);
        return res.data;
    },

    remove: async (id: number) => {
        const res = await api.delete(`/departments/${id}`);
        return res.status === 204 ? true : res.data;
    },
};