import { hasRole } from "@/utils/auth";

/**
 * Giám đốc Long An là vai trò theo khu vực. Tài khoản có thêm role `director`
 * vẫn được coi là giám đốc toàn hệ thống và không bị thu hẹp theo tỉnh.
 */
export const isRestrictedLongAnDirector = () =>
  hasRole("director_la") && !hasRole("director");

export const LONG_AN_DIRECTOR_HIDDEN_DIRECTOR_MENUS = new Set([
  "expense",
  "cashflow-report",
  "management",
  "recruitment",
  "payroll",
  "other-cashflow",
]);
