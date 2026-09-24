import api from "./api";

const BASE_URL = "https://sales.kidoedu.vn";

export const schoolApi = {
    getAll: async (params?: any) => {
        const res = await api.get(`/schools`, {
            params,
        });
    
        return res.data;
    },

    // BE bỏ qua employeeId nếu gọi qua /schools (chỉ hỗ trợ hasRemainingExpense,
    // employeeName + phân trang) — phải gọi route riêng /schools/by-employee/:id.
    getByEmployee: async (employeeId: number) => {
        const res = await api.get(`/schools/by-employee/${employeeId}`);
        return res.data;
    },

    // ✅ SEARCH SCHOOL
    search: async (keyword: string) => {
        const res = await api.get(`/schools/search/${keyword}`);
        return res.data;
    },

    create: async (data: any) => {
        const res = await api.post(`/schools`, data);
        return res.data;
    },

    update: async (id: number, data: any) => {
        const res = await api.put(`/schools/${id}`, data);
        return res.data;
    },

    resolveGoogleMaps: async (url: string) => {
        const res = await api.post(`/schools/resolve-google-maps`, { url });
        return res.data as { latitude: number; longitude: number };
    },

    updateStatus: async (id: number, status: number) => {
        const res = await api.patch(`/schools/${id}/status`, { status });
        return res.data;
    },

    getByEmployeeRegion: async (employeeRegionId: number) => {
        const res = await api.get(`/schools/employee-region/${employeeRegionId}`);
        return res.data;
    },

    getWithoutEmployeeRegion: async () => {
        const res = await api.get(`/schools/no-employee-region`);
        return res.data;
    },

    getByEmployeeAndWard: async (
        employeeId: number,
        wardId: number
    ) => {
        const res = await api.get(`/schools/by-employee-ward`, {
            params: { employeeId, wardId },
        });

        return res.data;
    },
};

/**
 * Điểm trường (chi nhánh) của một trường — trường nhiều cơ sở thì lớp/lịch dạy
 * gắn xuống điểm trường, toạ độ check-in lấy theo điểm trường thay vì trường.
 * Trường không khai điểm trường nào vẫn hoạt động như cũ.
 */
export interface SchoolLocation {
  id: number;
  schoolId: number;
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  checkinRadius?: number | null;
  googleMapsUrl?: string | null;
  status: number;
}

export type SchoolLocationInput = {
  schoolId?: number;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkinRadius?: number | null;
  googleMapsUrl?: string | null;
};

export const schoolLocationApi = {
    getBySchool: async (schoolId: number): Promise<SchoolLocation[]> => {
        const res = await api.get(`/school-locations`, {
            params: { schoolId },
        });
        return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },

    getOne: async (id: number): Promise<SchoolLocation> => {
        const res = await api.get(`/school-locations/${id}`);
        return res.data;
    },

    create: async (data: SchoolLocationInput) => {
        const res = await api.post(`/school-locations`, data);
        return res.data;
    },

    update: async (id: number, data: Partial<SchoolLocationInput>) => {
        const res = await api.put(`/school-locations/${id}`, data);
        return res.data;
    },

    delete: async (id: number) => {
        await api.delete(`/school-locations/${id}`);
    },

    updateStatus: async (id: number, status: number) => {
        const res = await api.patch(`/school-locations/${id}/status`, { status });
        return res.data;
    },
};

/** Giờ tiết học của một trường (Tiết 1 = 07:00–07:45...). */
export interface SchoolPeriod {
  id: number;
  schoolId: number;
  periodNo: number;
  startTime: string;
  endTime: string;
  label: string | null;
  /** Cột BUỔI của lưới TKB. */
  session: "SANG" | "CHIEU";
  /** `false` = dòng giờ ra chơi, không xếp lịch dạy vào được. */
  isPeriod: boolean;
}

export type SchoolPeriodInput = {
  periodNo: number;
  startTime: string;
  endTime: string;
  label?: string | null;
  session?: "SANG" | "CHIEU";
  isPeriod?: boolean;
};

export const schoolPeriodApi = {
  list: async (schoolId: number): Promise<SchoolPeriod[]> => {
    const res = await api.get(`/schools/${schoolId}/periods`);
    return res.data;
  },

  /**
   * Ghi đè cả bảng tiết trong một lần lưu. `warnings` là các nhắc nhở mềm
   * (vd. hai dòng chồng giờ) — dữ liệu VẪN được lưu, không phải lỗi.
   */
  replace: async (
    schoolId: number,
    periods: SchoolPeriodInput[],
  ): Promise<{ periods: SchoolPeriod[]; warnings: string[] }> => {
    const res = await api.put(`/schools/${schoolId}/periods`, { periods });
    return res.data;
  },
};
