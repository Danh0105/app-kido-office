import api from "./api";
import type {
  CreatePayrollPayload,
  Payroll,
  PayrollListResponse,
  PayrollQuery,
  UpdatePayrollPayload,
} from "@/types/payroll";

export const payrollApi = {
  list: async (query: PayrollQuery = {}) => {
    const response = await api.get<PayrollListResponse>("/payrolls", {
      params: query,
    });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get<Payroll>(`/payrolls/${id}`);
    return response.data;
  },

  /** Phụ cấp xăng xe của giáo viên công ty — cộng dồn từ bảng chấm công, không nhập tay. */
  getFuelAllowance: async (employeeId: number, month: number, year: number) => {
    const response = await api.get<{ fuelAllowance: number | null }>(
      "/payrolls/fuel-allowance",
      { params: { employeeId, month, year } },
    );
    return response.data.fuelAllowance;
  },

  create: async (payload: CreatePayrollPayload) => {
    const response = await api.post<Payroll>("/payrolls", payload);
    return response.data;
  },

  update: async (id: number, payload: UpdatePayrollPayload) => {
    const response = await api.patch<Payroll>(`/payrolls/${id}`, payload);
    return response.data;
  },

  remove: async (id: number) => {
    const response = await api.delete<{ success: true }>(`/payrolls/${id}`);
    return response.data;
  },

  /** Gửi hàng loạt phiếu nháp — từ đây nhân viên mới thấy phiếu của mình. */
  send: async (ids: number[]) => {
    const response = await api.patch<{
      sent: number;
      alreadySent: number;
      notFound: number;
    }>("/payrolls/send", { ids });
    return response.data;
  },
};
