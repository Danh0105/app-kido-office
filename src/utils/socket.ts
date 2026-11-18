import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

let socketInstance: Socket | null = null;
let suggestSocketInstance: Socket | null = null;
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

    return defaultSocket;
};

// Lazy /report namespace — only used by ReportDetailPopup. Handshake key is `userId`
// (not `employeeId`) per the backend contract for this namespace.
export const getReportSocket = (): Socket | null => {
    const userId = getEmployeeId();
    if (!userId) return null;

    const userIdKey = String(userId);

    if (reportSocket && reportSocketUserId !== userIdKey) {
        reportSocket.disconnect();
        reportSocket = null;
        reportSocketUserId = null;
    }

    if (!reportSocket) {
        reportSocketUserId = userIdKey;
        reportSocket = io(`${SOCKET_URL}/report`, {
            ...RECONNECTION_OPTIONS,
            query: { userId: userIdKey },
            auth: { userId: userIdKey },
        });

        reportSocket.on("connect_error", (err) => {
            console.error("REPORT SOCKET ERROR", err);
        });
    }

    return reportSocket;
};

export const disconnectSockets = () => {
    defaultSocket?.disconnect();
    reportSocket?.disconnect();

    socketInstance = null;
    suggestSocketInstance = null;
    socketToken = null;
};
