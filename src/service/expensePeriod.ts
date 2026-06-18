import api from "./api";

export const expensePeriodApi = {
    // GET ALL
    getAll: async (params?: any) => {
        const res = await api.get(
            `/expense-periods`,
            {
                params,
            },
        );

        return res.data;
    },

    // GET ONE
    getById: async (id: number) => {
        const res = await api.get(
            `/expense-periods/${id}`,
        );

        return res.data;
    },

    // CREATE
    create: async (data: {
        month: number;
        year: number;
        name?: string;
        status?: number;
    }) => {
        const res = await api.post(
            `/expense-periods`,
            data,
        );

        return res.data;
    },

    // UPDATE
    update: async (
        id: number,
        data: any,
    ) => {
        const res = await api.patch(
            `/expense-periods/${id}`,
            data,
        );

        return res.data;
    },

    // DELETE
    delete: async (id: number) => {
        const res = await api.delete(
            `/expense-periods/${id}`,
        );

        return res.data;
    },

    // LOCK
    lock: async (id: number) => {
        const res = await api.patch(
            `/expense-periods/${id}/lock`,
        );

        return res.data;
    },

    // OPEN
    open: async (id: number) => {
        const res = await api.patch(
            `/expense-periods/${id}/open`,
        );

        return res.data;
    },
};