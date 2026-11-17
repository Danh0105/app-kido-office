import { hasRole } from "@/utils/auth";

/**
 * Giám đốc Long An là vai trò theo khu vực. Tài khoản có thêm role `director`
 * vẫn được coi là giám đốc toàn hệ thống và không bị thu hẹp theo tỉnh.
 */
export const isRestrictedLongAnDirector = () =>
  hasRole("director_la") && !hasRole("director");

/** Giám đốc Long An chỉ có các chức năng này; menu khác mặc định bị ẩn. */
export const LONG_AN_DIRECTOR_MENUS = new Set(["policy", "report", "statistics"]);

const LONG_AN_DIRECTOR_PATHS = [
  /^\/director\/?$/,
  /^\/director\/nhan-vien\/?$/,
  /^\/director\/school-list\//,
  /^\/director\/subject-list\//,
  /^\/director\/policy-list\//,
  /^\/director\/policy-history-list\//,
  /^\/director\/policy\//,
  /^\/director\/daily-report\//,
  /^\/director\/statistics\//,
];

/** Trang của 3 chức năng trên; trang khác đưa về trang chủ. */
export const isLongAnDirectorPath = (pathname: string) =>
  LONG_AN_DIRECTOR_PATHS.some((path) => path.test(pathname));
