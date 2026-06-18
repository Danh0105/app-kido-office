import api from "@/service/api";

export const getUserFromToken = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;

    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(base64Url.length + (4 - base64Url.length % 4) % 4, "=");

        const payload = JSON.parse(atob(base64));

        // 🚨 check expired
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            logout();
            return null;
        }

        return payload;
    } catch (e) {
        console.log("decode error", e);
        return null;
    }
};
export const getEmployeeId = () => {
    const user = getUserFromToken();

    return user?.sub;
};

export const getEmployeeRole = () => {

    const user = getUserFromToken();
    return user?.role;
};

export const getEmployeeName = () => {

    const user = getUserFromToken();
    return user?.name;
};
export const logout = () => {
    localStorage.removeItem("access_token");

    // clear header axios nếu có
    delete api.defaults.headers.common["Authorization"];
};