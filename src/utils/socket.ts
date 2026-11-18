import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

let socketInstance: Socket | null = null;
let suggestSocketInstance: Socket | null = null;
let reportSocketInstance: Socket | null = null;
let socketToken: string | null = null;

const currentToken = () => localStorage.getItem("access_token");

const requireToken = () => {
    const token = currentToken();
    if (!token) throw new Error("Missing access token");
    return token;
};

const resetIfTokenChanged = (token: string) => {
    if (socketToken && socketToken !== token) {
        disconnectSockets();
    }
    socketToken = token;
};

export const getSocket = () => {
    const token = requireToken();
    resetIfTokenChanged(token);

    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            transports: ["websocket"],
            auth: { token },
        });

        socketInstance.on("connect", () => {
            console.log("Realtime connected", socketInstance?.id);
        });

        socketInstance.on("connect_error", (err) => {
            console.error("SOCKET ERROR", err);
        });

        socketInstance.on("disconnect", (reason) => {
            console.log("SOCKET DISCONNECTED", reason);
        });
    }

    return socketInstance;
};

export const getSuggestSocket = () => {
    const token = requireToken();
    resetIfTokenChanged(token);

    if (!suggestSocketInstance) {
        suggestSocketInstance = io(`${SOCKET_URL}/suggest`, {
            transports: ["websocket"],
            auth: { token },
        });
    }

    return suggestSocketInstance;
};

// Namespace báo cáo cũng xác thực bằng JWT như namespace mặc định; danh tính
// và room do backend suy ra từ token, không nhận userId do client tự gửi.
export const getReportSocket = () => {
    const token = requireToken();
    resetIfTokenChanged(token);

    if (!reportSocketInstance) {
        reportSocketInstance = io(`${SOCKET_URL}/report`, {
            transports: ["websocket"],
            auth: { token },
        });

        reportSocketInstance.on("connect_error", (err) => {
            console.error("REPORT SOCKET ERROR", err);
        });
    }

    return reportSocketInstance;
};

export const disconnectSockets = () => {
    socketInstance?.disconnect();
    suggestSocketInstance?.disconnect();
    reportSocketInstance?.disconnect();

    socketInstance = null;
    suggestSocketInstance = null;
    reportSocketInstance = null;
    socketToken = null;
};
