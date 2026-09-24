import api from "./api";

export type AnnualPolicyContract = {
  id: number;
  schoolId: number;
  schoolYear: string;
  contractFileUrl?: string | null;
  contractFileName?: string | null;
  contractUploadedById?: number | null;
  contractUploadedByName?: string | null;
  contractUploadedAt?: string | null;
};

export const annualPolicyApi = {
  getAll: async (params?: {
    employeeId?: number;
    schoolId?: number;
    status?: string;
    schoolYear?: string;
  }): Promise<AnnualPolicyContract[]> => {
    const res = await api.get("/annual-policies", { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  uploadContract: async (
    annualPolicyId: number,
    file: File,
  ): Promise<AnnualPolicyContract> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(
      `/annual-policies/${annualPolicyId}/contract`,
      formData,
    );

    return res.data;
  },
};
