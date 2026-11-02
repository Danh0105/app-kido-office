import type { HrEmployee } from "@/service/hr/hr.api";
import type { HrMyAccess } from "../lib/hrAccess";

export interface EmployeeTabProps {
  employee: HrEmployee;
  access: HrMyAccess | null;
  /** Có EMPLOYEE_EDIT ở phạm vi nào đó — backend kiểm tra lại phạm vi nhân viên này. */
  canEdit: boolean;
  /** Đã đọc được crypto status và biết chắc KHÔNG ghi được dữ liệu nhạy cảm. */
  cryptoWriteUnavailable: boolean;
  /** Đã đọc được crypto status và biết chắc KHÔNG giải mã được (reveal). */
  cryptoRevealUnavailable: boolean;
}

/** 404 của tài nguyên con (TK ngân hàng, MST…) sau khi đã mở được hồ sơ = chưa có dữ liệu. */
export const isNotFound = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status === 404;
