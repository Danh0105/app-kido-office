import api from "./api";

export const statisticsApi = {
    // 📊 Lấy thống kê theo năm học
    getBySchoolYear: async (schoolYear: string) => {
        const res = await api.get(`/statistics`, {
            params: { schoolYear }, // 🔥 QUAN TRỌNG
        });
        return res.data;
    },

    // 📊 (Optional) Lấy default năm học hiện tại
    getCurrentYear: async () => {
        const currentYear = "2025-2026"; // hoặc tự tính
        const res = await api.get(`/statistics`, {
            params: { schoolYear: currentYear },
        });
        return res.data;
    },

    // 📊 (Optional) format lại dữ liệu cho UI
    transformData: (data: any[]) => {
        return data.map((item) => ({
            id: item.id,
            subjectName: item.name,
            schoolName: item.school_name,
            studentCount: item.student_count,
            contract: item.contract_number,
            policies: item.policies || [],
        }));
    },
};