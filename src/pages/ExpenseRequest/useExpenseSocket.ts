import { useEffect, useRef } from "react";
import { onRealtimeNotification } from "@/hook/useRealtimeNotifications";
import type { ExpenseNotification as ExpenseRequestNotification } from "@/types/expenseRequest";

export type ExpenseNotification = ExpenseRequestNotification;

// Subscribe to real-time expense-request notifications via the single shared connection
// managed by useRealtimeNotifications (no socket opened here).
// `onNotify` fires for every incoming event so pages can refresh + toast.
export function useExpenseSocket(onNotify: (n: ExpenseNotification) => void) {
  const cb = useRef(onNotify);
  cb.current = onNotify;

  useEffect(() => {
    return onRealtimeNotification((signal) => {
      if (signal.legacy) return;
      const data = signal.payload;
      const isExpense =
        data.type === "EXPENSE_REQUEST" ||
        (data.type === "SUGGEST" && data.meta?.suggestType === "EXPENSE_REQUEST");
      if (isExpense) cb.current(data as unknown as ExpenseNotification);
    });
  }, []);
}
