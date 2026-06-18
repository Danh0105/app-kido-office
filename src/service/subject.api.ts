import api from "./api";

export const subjectApi = {
    getBySchool: async (schoolId: number) => {
        const res = await api.get(`/subjects`, {
            params: { schoolId }
        });
        return res.data;
    },

    getBySchoolYear: async (
        schoolYear: string,
        schoolId: number
    ) => {
        const res = await api.get(
            `/subjects/school/${schoolYear}`,
            {
                params: { schoolId },
            }
        );

        return res.data;
    },

    findOne: async (id: number) => {
        const res = await api.get(`/subjects/${id}`);
        return res.data;
    },

    create: async (data: any) => {
        const res = await api.post(`/subjects`, data);
        return res.data;
    },

    update: async (id: number, data: any) => {
        const res = await api.put(
            `/subjects/${id}`,
            data
        );

        return res.data;
    },

    remove: async (id: number) => {
        const res = await api.delete(
            `/subjects/${id}`
        );

        return res.status === 204
            ? true
            : res.data;
    },

    getBySubject: async (params?: {
        schoolYear?: string;
        subjectName?: string;
    }) => {
        const res = await api.get(
            `/schools/by-subject`,
            { params }
        );

        return res.data;
    },

    getFinanceBySchool: async (
        schoolId: number,
        schoolYear?: string,
    ) => {
        const res = await api.get(
            `/subjects/finance/${schoolId}`,
            {
                params: {
                    schoolYear,
                },
            },
        );

        return res.data;
    },
};