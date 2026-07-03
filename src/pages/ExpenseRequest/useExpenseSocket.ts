import { useEffect, useRef } from "react";
import { getSocket } from "@/utils/socket";

export type ExpenseNotification = {
  id: number;
  type: string;
  entityId?: number;
  message?: string;
  title?: string;
  isRead?: boolean;
  createdAt?: string;
  meta?: {
    suggestId?: number;
    status?: string;
    suggestType?: string;
  };
};

// Subscribe to real-time expense-request notifications.
// `onNotify` fires for every incoming event so pages can refresh + toast.
export function useExpenseSocket(onNotify: (n: ExpenseNotification) => void) {
  const cb = useRef(onNotify);
  cb.current = onNotify;

  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      socket = getSocket();
    } catch {
      return;
    }
    if (!socket) return;
    const sock = socket;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const register = () => {
      if (user?.id) sock.emit("notification:register", user.id);
    };

    if (sock.connected) register();
    sock.on("connect", register);

    const handleNew = (data: ExpenseNotification) => cb.current(data);
    const handleGeneric = (data: ExpenseNotification) => {
      if (
        data.type === "SUGGEST" &&
        data.meta?.suggestType === "EXPENSE_REQUEST"
      ) {
        cb.current(data);
      }
    };

    sock.on("expense-request-notification:new", handleNew);
    sock.on("notification:new", handleGeneric);

    return () => {
      sock.off("connect", register);
      sock.off("expense-request-notification:new", handleNew);
      sock.off("notification:new", handleGeneric);
    };
  }, []);
}
