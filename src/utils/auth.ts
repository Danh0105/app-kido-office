import api from "@/service/api";
import { decodeJwtPayload } from "./jwt";
import {
    hasBroadRoleIn,
    isAccountantOnlyIn,
    isChiefAccountantIn,
    isDirectorAssistantViewerIn,
} from "./rolePrecedence";

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
export const hasBroadRole = (): boolean => hasBroadRoleIn(getEmployeeRoles());

// "Chỉ" kế toán trưởng — false nếu tài khoản còn kiêm role rộng hơn hoặc
// Trợ lý GĐ, để role ưu tiên không bị thu hẹp menu/route.
export const isChiefAccountant = (): boolean =>
    isChiefAccountantIn(getEmployeeRoles());

/**
 * Trợ lý giám đốc (`troly_gd`): xem được mọi chức năng như Giám đốc nhưng chỉ
 * đọc — các màn mở thêm cho họ phải ẩn nút thêm/sửa/xoá/duyệt. Các việc đã
 * giao riêng cho trợ lý GĐ (QL thu chi, duyệt Đề xuất...) giữ nguyên, vì các
 * màn đó kiểm tra quyền riêng. False nếu tài khoản còn kiêm role rộng.
 */
export const isDirectorAssistantViewer = (): boolean =>
    isDirectorAssistantViewerIn(getEmployeeRoles());

// "Chỉ" kế toán — cùng nguyên tắc ưu tiên với isChiefAccountant.
export const isAccountantOnly = (): boolean =>
    isAccountantOnlyIn(getEmployeeRoles());

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

    disconnectSockets();
};
