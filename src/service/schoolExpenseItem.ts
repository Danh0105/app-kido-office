import api from "./api";

export const schoolExpenseItemApi = {
    getAll: async (params: { schoolExpenseId: number; subjectId?: number }) => {
        const res = await api.get("/school-expense-items", { params });
        return res.data;
    },
    create: async (data: any) => {
        const res = await api.post("/school-expense-items", data);
        return res.data;
    },
    update: async (id: number, data: any) => {
        const res = await api.patch(`/school-expense-items/${id}`, data);
        return res.data;
    },
    delete: async (id: number) => {
        const res = await api.delete(`/school-expense-items/${id}`);
        return res.data;
    },
};
