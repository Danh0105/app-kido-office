import api from "./api";

export const cashPolicyItemApi = {
    // GET ALL
    getAll: async (params?: any) => {
        const res = await api.get(
            `/cash-policy-items`,
            {
                params,
            },
        );

        return res.data;
    },

    // GET ONE
    getById: async (id: number) => {
        const res = await api.get(
            `/cash-policy-items/${id}`,
        );

        return res.data;
    },

    // CREATE
    create: async (data: {
        schoolExpenseId: number;
        payer?: string;
        cashPolicyAmount?: number;
        otherAmount?: number;
        paymentDate?: string;
        note?: string;
    }) => {
        const res = await api.post(
            `/cash-policy-items`,
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
            `/cash-policy-items/${id}`,
            data,
        );

        return res.data;
    },

    // DELETE
    delete: async (id: number) => {
        const res = await api.delete(
            `/cash-policy-items/${id}`,
        );

        return res.data;
    },
};