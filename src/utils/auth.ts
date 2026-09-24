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
