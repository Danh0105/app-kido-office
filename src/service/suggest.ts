import api from "./api";

const buildFormData = (data: any) => {
    const formData = new FormData();

    Object.keys(data).forEach((key) => {
        if (key !== "file" && data[key] !== undefined) {
            formData.append(key, data[key]);
        }
    });

    if (data.file) {
        formData.append("file", data.file);
    }

    return formData;
};

export const suggestApi = {
    // 📌 create
    create: async (data: {
        content: string;
        component?: string;
        description?: string;
        issueDate?: string;
        file?: File;
        policyId?: number;
    }) => {
        const res = await api.post(
            `/suggest`,
            buildFormData(data),
            {
                headers: { "Content-Type": "multipart/form-data" },
            }
        );
        return res.data;
    },

    // 📌 update
    update: async (
        id: number,
        data: {
            content?: string;
            component?: string;
            description?: string;
            issueDate?: string;
            policyId?: number;
            file?: File;
        }
    ) => {
        const res = await api.put(
            `/suggest/${id}`,
            buildFormData(data),
            {
                headers: { "Content-Type": "multipart/form-data" },
            }
        );
        return res.data;
    },

    // 📌 get all
    getAll: async () => {
        const res = await api.get(`/suggest`);
        return res.data;
    },

    // 📌 get detail
    getById: async (id: number) => {
        const res = await api.get(`/suggest/${id}`);
        return res.data;
    },

    // 📌 history
    getHistory: async (id: number) => {
        const res = await api.get(`/suggest/${id}/history`);
        return res.data;
    },

    // 📌 delete
    delete: async (id: number) => {
        const res = await api.delete(`/suggest/${id}`);
        return res.data;
    },

    // 🆕 📌 review (sale admin)
    review: async (
        id: number,
        data: {
            status: string; // SuggestStatus
            rejectReason?: string;
        }
    ) => {
        const res = await api.patch(`/suggest/${id}/review`, data);
        return res.data;
    },

    // 🆕 📌 approve (director)
    approve: async (
        id: number,
        data: {
            status: string; // SuggestStatus
            rejectReason?: string;
        }
    ) => {
        const res = await api.patch(`/suggest/${id}/approve`, data);
        return res.data;
    },

    // 🆕 📌 get my suggests
    getMySuggests: async () => {
        const res = await api.get(`/suggest/my-suggests`);
        return res.data;
    },

    getByEmployeeId: async (employeeId: number) => {
        const res = await api.get(`/suggest/employee/${employeeId}`);
        return res.data;
    },

    getStatsByPolicy: async () => {
        const res = await api.get(`/suggest/stats/by-policy`);
        return res.data;
    },
};