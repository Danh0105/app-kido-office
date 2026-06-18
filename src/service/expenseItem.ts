import api from "./api";

export const expenseItemApi = {
    // GET ALL
    getAll: async (params?: any) => {
        const res = await api.get(
            `/expense-items`,
            {
                params,
            },
        );

        return res.data;
    },

    // GET ONE
    getById: async (id: number) => {
        const res = await api.get(
            `/expense-items/${id}`,
        );

        return res.data;
    },

    // CREATE
    create: async (data: {
        schoolExpenseId: number;

        subjectId: number;
    
        totalPeriods?: number;

        studentCount?: number;
    
        revenueAmount?: number;
    
        invoiceAmount?: number;
    
        collectedDate?: string;
    
        totalOutsideExpense?: number;
    
        paidAmount?: number;
    
        remainingOutsideExpense?: number;
    
        expenseAmount?: number;
    
        paymentDate?: string;
    
        payer?: string;
    
        note?: string;
    }) => {
        const res = await api.post(
            `/expense-items`,
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
            `/expense-items/${id}`,
            data,
        );

        return res.data;
    },

    // DELETE
    delete: async (id: number) => {
        const res = await api.delete(
            `/expense-items/${id}`,
        );

        return res.data;
    },
};