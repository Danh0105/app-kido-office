import api from "./api";
import { DEFAULT_SCHOOL_YEAR } from "@/constants/schoolYear";

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
        const currentYear = DEFAULT_SCHOOL_YEAR;
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
