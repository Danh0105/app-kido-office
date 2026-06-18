import api from "./api";

export const dailyReportApi = {
    // 📌 Lấy tất cả báo cáo
    getAll: async () => {
        const res = await api.get(`/daily-reports`);
        return res.data;
    },

    // 📌 Lấy theo id
    getById: async (id: number) => {
        const res = await api.get(`/daily-reports/${id}`);
        return res.data;
    },

    // 📌 Tạo báo cáo
    create: async (data: {
        employeeId: number;
        date: string;
        tasks: {
            title: string;
            content: string;
            location?: string;
        }[];
    }) => {
        const res = await api.post(`/daily-reports`, data);
        return res.data;
    },

    // 📌 Xoá
    delete: async (id: number) => {
        const res = await api.delete(`/daily-reports/${id}`);
        return res.data;
    },

    // ✅ FIX: Lấy theo employee (đúng route backend)
    getByEmployee: async (employeeId: number) => {
        const res = await api.get(`/daily-reports/employee/${employeeId}`);
        return res.data;
    },

    // 🔥 NEW: Lấy theo tuần
    getByEmployeeWeeks: async (employeeId: number) => {
        const res = await api.get(
            `/daily-reports/employee/${employeeId}/weeks`
        );
        return res.data;
    },

    // 🔥 NEW: Lấy tuần hiện tại
    getCurrentWeek: async (employeeId: number) => {
        const res = await api.get(
            `/daily-reports/employee/${employeeId}/current-week`
        );
        return res.data;
    },

    // 📌 Lọc theo khoảng ngày (nếu backend có support)
    getByDateRange: async (from: string, to: string) => {
        const res = await api.get(`/daily-reports`, {
            params: { from, to },
        });
        return res.data;
    },

    // 📌 Update
    update: async (
        id: number,
        data: {
            date?: string;
            tasks?: {
                id?: number;
                title: string;
                content: string;
                location?: string;
            }[];
        }
    ) => {
        const res = await api.patch(`/daily-reports/${id}`, data);
        return res.data;
    },
    getEmployeesReportedToday: async () => {
        const res = await api.get(`/daily-reports/today/employees`);
        return res.data;
    },
    deleteTask: async (taskId: number): Promise<{ message: string }> => {
        const res = await api.delete(`/daily-reports/task/${taskId}`);
        return res.data;
    },
};