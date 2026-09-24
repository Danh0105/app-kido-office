import api from "./api";
import type { GasAllowanceMissingReport } from "@/types/teaching";

export interface FuelAllowanceTier {
  id: number;
  minDistanceKm: number;
  maxDistanceKm: number | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FuelAllowanceTierPayload {
  minDistanceKm: number;
  maxDistanceKm: number | null;
  amount: number;
}

/** Kết quả điền phụ cấp cho các buổi đang trống. */
export interface RecomputeGasAllowanceResult {
  updated: number;
  /** Buổi thuộc tháng đã gửi phiếu lương — giữ nguyên. */
  skippedLocked: number;
  /** Vẫn chưa tính được — chi tiết cần bổ sung ở `missing`. */
  stillMissing: number;
  missing: GasAllowanceMissingReport;
}

const PATH = "/fuel-allowance-tiers";

export const fuelAllowanceTierApi = {
  list: async (): Promise<FuelAllowanceTier[]> => {
    const res = await api.get(PATH);
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  create: async (data: FuelAllowanceTierPayload): Promise<FuelAllowanceTier> =>
    (await api.post(PATH, data)).data,
  update: async (
    id: number,
    data: Partial<FuelAllowanceTierPayload>,
  ): Promise<FuelAllowanceTier> => (await api.patch(`${PATH}/${id}`, data)).data,
  /**
   * Điền phụ cấp cho các buổi của giáo viên công ty đang trống — không sửa
   * buổi đã có phụ cấp. Bỏ `teacherId` = mọi giáo viên.
   */
  recompute: async (teacherId?: number): Promise<RecomputeGasAllowanceResult> =>
    (await api.post(`${PATH}/recompute`, teacherId ? { teacherId } : {})).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`${PATH}/${id}`);
  },
};
