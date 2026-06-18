import api from "./api";

const BASE_URL = "https://sales.kidoedu.vn";

export const employeeApi = {
    getAll: async () => {
        const res = await api.get(`/employees`);
        return res.data;
    },

    create: async (data: {
        name: string;
        email?: string;
        phone?: string;
        password?: string;
        departmentId?: number;
        role?: string;
    }) => {
        const res = await api.post(`/employees`, data);
        return res.data;
    },

    getByDepartment: async (departmentId: number) => {
        const res = await api.get(`/employees`, {
            params: { departmentId },
        });
        return res.data;
    },

    getRegionsByDepartment: async (departmentId: number) => {
        const res = await api.get(
            `/employees/regions-by-department/${departmentId}`
        );
        return res.data;
    },

    getByDepartmentAndRegion: async (
        departmentId: number,
        regionId: number
    ) => {
        const res = await api.get(`/employees/by-department-region`, {
            params: { departmentId, regionId },
        });
        return res.data;
    },
    getAvailable: async (regionId: number) => {
        const res = await api.get(
            `/employees/${regionId}/available-employees`
        );
        return res.data;
    },
    getById: async (userId: number) => {
        const res = await api.get(
            `/employees/getbyid/${userId}`,
        );
        return res.data;
    },
    addManyToRegion: async (employeeId: number, regionIds: number[]) => {
        const res = await api.post(`/employees/${employeeId}/regions`, {
            regionIds,
        });
        return res.data;
    },
    removeRegion: async (employeeId: number, regionId: number) => {
        const res = await api.delete(`/employees/${employeeId}/regions/${regionId}`);
        return res.data;
    },
    delete: async (id: number) => {
        const res = await api.delete(`/employees/${id}`);
        return res.data;
    },

    registerFace: async (employeeId: number, descriptor: number[]) => {
        const res = await api.post(`/employees/register-face`, {
            employeeId,
            descriptor,
        });
        return res.data;
    },

    getFaceData: async () => {
        const res = await api.get(`/employees/face-data`);
        return res.data;
    },

    clearFace: async (employeeId: number) => {
        const res = await api.delete(`/employees/${employeeId}/faces`);
        return res.data;
    },
    addManyToProvince: async (employeeId: number, provinceIds: number[]) => {
        const res = await api.post(`/employee/add-many-to-province`, {
            employeeId,
            provinceIds,
        });
        return res.data;
    },
    removeProvince: async (employeeId: number, provinceId: number) => {
        const res = await api.delete(`/employee/remove-province`, {
            data: { employeeId, provinceId },
        });
        return res.data;
    },
    changePassword: async (
        id: number,
        data: { oldPassword: string; newPassword: string }
    ) => {
        const res = await api.patch(`/employees/${id}/change-password`, data);
        return res.data;
    },
    assignRegion: async (body: any) => {
        const res = await api.post(
            "/employees/assign-region",
            body
        );

        return res.data;
    },
    saveFcmToken: async (
        token: string,
        platform?: string,
    ) => {
        const res = await api.post(
            `/employee-fcm-token/save`,
            {
                token,
                platform,
            },
        );

        return res.data;
    },
    update: async (
        id: number,
        data: any,
    ) => {
        const res = await api.patch(
            `/employees/${id}`,
            data,
        );

        return res.data;
    },
};