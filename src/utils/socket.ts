import { io, Socket } from "socket.io-client";
import { getEmployeeId } from "./auth";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

let socketInstance: Socket | null = null;
let suggestSocketInstance: Socket | null = null;

export const getSocket = () => {
    const employeeId = getEmployeeId();
    console.log("SOCKET_URL:", SOCKET_URL);
    console.log("EMPLOYEE ID:", employeeId);

    if (!employeeId) {
        throw new Error("Missing employeeId");
    }

    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            transports: ["websocket"],
            query: {
                employeeId: String(employeeId),
            },
        });

        socketInstance.on("connect", () => {
            console.log("CONNECTED", {
                socketId: socketInstance?.id,
                employeeId,
            });
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
    const employeeId = getEmployeeId();

    if (!employeeId) {
        throw new Error("Missing employeeId");
    }

    if (!suggestSocketInstance) {
        suggestSocketInstance = io(`${SOCKET_URL}/suggest`, {
            transports: ["websocket"],
            query: {
                employeeId,
            },
        });
    }

    return suggestSocketInstance;
};

export const disconnectSockets = () => {
    socketInstance?.disconnect();
    suggestSocketInstance?.disconnect();

    socketInstance = null;
    suggestSocketInstance = null;
};