import api from "./api";

export const revenueItemApi = {
    getAll: async (params: { schoolExpenseId: number; subjectId?: number }) => {
        const res = await api.get("/revenue-items", { params });
        return res.data;
    },
    create: async (data: any) => {
        const res = await api.post("/revenue-items", data);
        return res.data;
    },
    update: async (id: number, data: any) => {
        const res = await api.patch(`/revenue-items/${id}`, data);
        return res.data;
    },
    delete: async (id: number) => {
        const res = await api.delete(`/revenue-items/${id}`);
        return res.data;
    },
};
