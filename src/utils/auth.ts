import api from "@/service/api";
import { decodeJwtPayload } from "./jwt";

export const getUserFromToken = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    // 🚨 check expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
        logout();
        return null;
    }

    return payload;
};
export const getEmployeeId = () => {
    const user = getUserFromToken();

    return user?.sub;
};

export const getEmployeeRoles = (): string[] => {
    const user = getUserFromToken();
    return user?.roles ?? [];
};

export const hasRole = (...roles: string[]): boolean => {
    const userRoles = getEmployeeRoles();
    return roles.some((r) => userRoles.includes(r));
};

/**
 * Role "rộng" (giám đốc / sale admin) — tài khoản kiêm thêm role hẹp hơn
 * (kế toán trưởng, kế toán...) vẫn phải giữ nguyên quyền/menu đầy đủ của vai
 * rộng, không bị các guard/menu dành riêng cho vai hẹp thu hẹp lại.
 */
const BROAD_ROLES = [
    "director",
    "director_la",
    "saleadmin",
    "salesadmin",
    "salesadmin_la",
];

export const hasBroadRole = (): boolean => hasRole(...BROAD_ROLES);

// "Chỉ" kế toán trưởng — false nếu tài khoản còn kiêm role rộng hơn, để
// không bị thu hẹp menu/route dành cho vai kế toán trưởng đơn thuần.
export const isChiefAccountant = (): boolean =>
    hasRole("ketoan_truong") && !hasBroadRole();

/**
 * Trợ lý giám đốc (`troly_gd`): xem được mọi chức năng như Giám đốc nhưng chỉ
 * đọc — các màn mở thêm cho họ phải ẩn nút thêm/sửa/xoá/duyệt. Các việc đã
 * giao riêng cho trợ lý GĐ (QL thu chi, duyệt Đề xuất...) giữ nguyên, vì các
 * màn đó kiểm tra quyền riêng. False nếu tài khoản còn kiêm role rộng.
 */
export const isDirectorAssistantViewer = (): boolean =>
    hasRole("troly_gd") && !hasBroadRole();

// "Chỉ" kế toán — cùng nguyên tắc với isChiefAccountant.
export const isAccountantOnly = (): boolean =>
    hasRole("accountant") && !hasBroadRole();

/**
 * Được sửa môn học của trường trong luồng Chính sách.
 * Các role xem khác (kế toán trưởng, trợ lý GĐ…) chỉ đọc.
 */
export const canManageSubjects = (): boolean =>
    hasRole("director", "director_la", "saleadmin", "salesadmin_la");

export const getEmployeeName = () => {

    const user = getUserFromToken();
    return user?.name;
};
export const logout = () => {
    localStorage.removeItem("access_token");

    // clear header axios nếu có
    delete api.defaults.headers.common["Authorization"];
};
