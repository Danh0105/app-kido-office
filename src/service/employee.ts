import api from "./api";

const BASE_URL = "https://sales.kidoedu.vn";

export interface Employee {
    id: number;
    name?: string;
    email?: string;
    phone?: string;
    roles: string[];
    avatar?: string | null;
    avatarUrl?: string | null;
}

export async function getSalesEmployees(): Promise<Employee[]> {
    const response = await api.get<Employee[]>("/employees/sales");
    return response.data;
}

export const employeeApi = {
    getAll: async () => {
        const res = await api.get(`/employees`);
        return res.data;
    },

    getSales: getSalesEmployees,

    create: async (data: {
        name: string;
        email?: string;
        phone?: string;
        password?: string;
        departmentId?: number;
        roles?: string[];
    }) => {
        const res = await api.post(`/employees`, data);
        return res.data;
    },

    /** Chỉ tài khoản có role `dev` mới gọi được — tự đổi role cho chính mình. */
    setDevRoles: async (roles: string[]) => {
        const res = await api.patch<Employee>(`/employees/me/dev-roles`, { roles });
        return res.data;
    },

    getByDepartment: async (departmentId: number) => {
        const res = await api.get(`/employees`, {
            params: { departmentId },
        });
        return res.data;
    },

    // Route do RegionController phục vụ (/regions/...), không phải /employees/...
    getRegionsByDepartment: async (departmentId: number) => {
        const res = await api.get(
            `/regions/regions-by-department/${departmentId}`
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
    // ⚠️ Backend chưa có route này — gọi vào sẽ 404 (xem scripts/check-api-routes.mjs).
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

    // ⚠️ Backend chưa có route này — gọi vào sẽ 404 (xem scripts/check-api-routes.mjs).
    clearFace: async (employeeId: number) => {
        const res = await api.delete(`/employees/${employeeId}/faces`);
        return res.data;
    },
    // Hai endpoint dưới do ProvinceController phục vụ (@Controller('provinces')),
    // không phải EmployeeController — gọi sang /employee/... là 404 và mất dữ liệu.
    addManyToProvince: async (employeeId: number, provinceIds: number[]) => {
        const res = await api.post(`/provinces/add-many-to-province`, {
            employeeId,
            provinceIds,
        });
        return res.data;
    },
    removeProvince: async (employeeId: number, provinceId: number) => {
        const res = await api.delete(`/provinces/remove-province`, {
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
