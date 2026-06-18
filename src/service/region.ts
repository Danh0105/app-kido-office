import api from "./api";

export const regionApi = {
    // 👉 Lấy danh sách region
    getAll: async () => {
        const res = await api.get(`/regions`);
        return res.data;
    },

    // 👉 Lấy 1 region theo id
    getById: async (id: number) => {
        const res = await api.get(`/regions/${id}`);
        return res.data;
    },

    // 👉 Tạo mới region
    create: async (data: any) => {
        const res = await api.post(`/regions`, data);
        return res.data;
    },

    // 👉 Update region
    update: async (id: number, data: any) => {
        const res = await api.patch(`/regions/${id}`, data);
        return res.data;
    },

    // 👉 Xoá region
    delete: async (id: number) => {
        const res = await api.delete(`/regions/${id}`);
        return res.data;
    },

    getByDepartment: async (departmentId: number) => {
        const res = await api.get(`/regions/regions-by-department/${departmentId}`);
        return res.data;
    },

    getEmployeesByRegion: async (regionId: number) => {
        const res = await api.get(`/regions/${regionId}/employees`);
        return res.data;
    },
    getRegionsByEmployee: async (employeeId: number) => {
        const res = await api.get(`/regions/regions-by-employee/${employeeId}`);
        return res.data;
    },
    getAvailableRegions: async (employeeId: number) => {
        const res = await api.get(`/regions/available-regions/${employeeId}`);
        return res.data;
    },

};