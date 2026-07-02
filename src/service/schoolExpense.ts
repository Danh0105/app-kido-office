import api from "./api";

export type RevenueItemPayload = {
    rowIndex: number;
    subjectId: number;
    content?: string;
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;
    unitPrice: number;
    invoiced?: boolean;
    invoiceType?: string;
    invoiceOther?: string;
    invoiceDate?: string;
    paidAmount: number;
    paymentMethod?: string;
    paymentDate?: string;
};

export type SchoolExpenseItemPayload = {
    rowIndex: number;
    subjectId: number;
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;
    teacherUnitPrice: number;
    taxUnitPrice: number;
    csvcUnitPrice: number;
    paidAmount: number;
    expenseDate?: string;
    payer?: string;
    note?: string;
};

export type ManagementExpenseItemPayload = {
    rowIndex: number;
    subjectId: number;
    totalPeriods: number;
    studentCount: number;
    monthsCount: number;
    ql1UnitPrice: number;
    ql2UnitPrice: number;
    invoiceAmount?: number;
    paidAmount: number;
    expenseDate?: string;
    payer?: string;
    note?: string;
};

export type SaveSchoolExpensePayload = {
    subjectId: number;
    revenueItems: RevenueItemPayload[];
    schoolExpenseItems: SchoolExpenseItemPayload[];
    managementExpenseItems: ManagementExpenseItemPayload[];
};

export const schoolExpenseApi = {
    // GET ALL
    getAll: async (params?: any) => {
        const res = await api.get(
            `/school-expenses`,
            {
                params,
            },
        );

        return res.data;
    },

    // GET ONE
    getById: async (id: number) => {
        const res = await api.get(
            `/school-expenses/${id}`,
        );

        return res.data;
    },

    // CREATE
    create: async (data: {
        schoolId: number;
        periodId: number;
    }) => {
        const res = await api.post(
            `/school-expenses`,
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
            `/school-expenses/${id}`,
            data,
        );

        return res.data;
    },

    // DELETE
    delete: async (id: number) => {
        const res = await api.delete(
            `/school-expenses/${id}`,
        );

        return res.data;
    },
    saveAll: async (
        id: number,
        data: SaveSchoolExpensePayload,
    ) => {
        const res = await api.post(
            `/school-expenses/${id}/save-all`,
            data,
        );
        return res.data;
    },

    getSummary: async (id: number, subjectId?: number) => {
        const res = await api.get(
            `/school-expenses/${id}/summary`,
            { params: subjectId ? { subjectId } : {} },
        );
        return res.data;
    },

    getItems: async (id: number, subjectId?: number) => {
        const res = await api.get(
            `/school-expenses/${id}/items`,
            { params: subjectId ? { subjectId } : {} },
        );
        return res.data;
    },

    getHistory: async (id: number, params?: { subjectId?: number }) => {
        const res = await api.get(`/school-expenses/${id}/history`, { params });
        return res.data;
    },

    checkExisted: async (
        schoolId: number,
        periodId: number,
      ) => {
        const res = await api.get(
          `/school-expenses/check-existed`,
          {
            params: {
              schoolId,
              periodId,
            },
          },
        );
      
        return res.data;
      },
};
