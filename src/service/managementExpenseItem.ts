import api from "./api";

export const managementExpenseItemApi = {
    getAll: async (params: { schoolExpenseId: number; subjectId?: number }) => {
        const res = await api.get("/management-expense-items", { params });
        return res.data;
    },
    create: async (data: any) => {
        const res = await api.post("/management-expense-items", data);
        return res.data;
    },
    update: async (id: number, data: any) => {
        const res = await api.patch(`/management-expense-items/${id}`, data);
        return res.data;
    },
    delete: async (id: number) => {
        const res = await api.delete(`/management-expense-items/${id}`);
        return res.data;
    },
};
