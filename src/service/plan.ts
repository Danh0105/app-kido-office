import api from "./api";

export const weeklyPlanApi = {
    // 📌 Lấy tất cả kế hoạch tuần
    getAll: async () => {
        const res = await api.get(`/weekly-plans`);
        return res.data;
    },

    // 📌 Lấy theo id
    getById: async (id: number) => {
        const res = await api.get(`/weekly-plans/${id}`);
        return res.data;
    },

    // 📌 Tạo kế hoạch tuần
    create: async (data: {
        employeeId?: number;
        startDate: string;
        endDate: string;
        tasks: {
            title: string;
            content?: string;
            location?: string;
            dayOfWeek: number;
        }[];
    }) => {
        const res = await api.post(`/weekly-plans`, data);
        return res.data;
    },

    // 📌 Update kế hoạch tuần
    update: async (
        id: number,
        data: {
            startDate?: string;
            endDate?: string;
            tasks?: {
                id?: number;
                title: string;
                content?: string;
                location?: string;
                dayOfWeek: number;
            }[];
        }
    ) => {
        const res = await api.put(`/weekly-plans/${id}`, data);
        return res.data;
    },

    // 📌 Xoá
    delete: async (id: number) => {
        const res = await api.delete(`/weekly-plans/${id}`);
        return res.data;
    },

    // 📌 Lấy theo employee
    getByEmployee: async (employeeId: number) => {
        const res = await api.get(`/weekly-plans/employee/${employeeId}`);
        return res.data;
    },

    // 🔥 Lấy kế hoạch tuần hiện tại
    getCurrentWeek: async (employeeId: number) => {
        const res = await api.get(
            `/weekly-plans/employee/${employeeId}/current-week`
        );
        return res.data;
    },

    // 🔥 Lấy theo khoảng tuần
    getByDateRange: async (from: string, to: string) => {
        const res = await api.get(`/weekly-plans`, {
            params: { from, to },
        });
        return res.data;
    },

    // 🔥 Lấy lịch sử version
    getHistory: async (planId: number) => {
        const res = await api.get(`/weekly-plans/${planId}/history`);
        return res.data;
    },

    // 🔥 Lấy chi tiết 1 version
    getHistoryDetail: async (historyId: number) => {
        const res = await api.get(`/weekly-plans/history/${historyId}`);
        return res.data;
    },

    // 🔥 So sánh 2 version (nếu bạn làm API này)
    compareVersion: async (planId: number, v1: number, v2: number) => {
        const res = await api.get(
            `/weekly-plans/${planId}/compare?v1=${v1}&v2=${v2}`
        );
        return res.data;
    },
};