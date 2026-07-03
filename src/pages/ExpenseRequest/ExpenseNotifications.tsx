import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { notificationApi } from "@/service/notification";
import { expenseNotificationApi } from "@/service/expenseRequest";

import { useExpenseSocket, type ExpenseNotification } from "./useExpenseSocket";
import { expenseBasePath, formatDateTime } from "./lib";

export default function ExpenseNotifications() {
  const navigate = useNavigate();
  const base = expenseBasePath();

  const [items, setItems] = useState<ExpenseNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseNotificationApi.getAll(1, 30);
      setItems(res.data || res || []);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được thông báo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Prepend new notifications in real time.
  useExpenseSocket((n) => {
    setItems((prev) => (prev.find((x) => x.id === n.id) ? prev : [n, ...prev]));
    if (n.message || n.title) toast(n.title || n.message || "Thông báo mới");
  });

  const openNotification = async (n: ExpenseNotification) => {
    if (!n.isRead) {
      try {
        await notificationApi.markAsRead(n.id);
      } catch {
        /* non-blocking */
      }
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    const entityId = n.entityId ?? n.meta?.suggestId;
    if (entityId) navigate(`${base}/${entityId}`);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      toast.success("Đã đánh dấu tất cả đã đọc");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Thông báo đề xuất chi" />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-2 pt-2">
        <div className="flex justify-end">
          <button
            onClick={markAll}
            className="text-xs text-blue-500 font-medium px-3 py-1"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        {loading && (
          <div className="text-center text-gray-400 text-sm py-10">Đang tải…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            Chưa có thông báo
          </div>
        )}

        {items.map((n) => (
          <div
            key={n.id}
            onClick={() => openNotification(n)}
            className={`rounded-2xl p-3 shadow-sm border cursor-pointer active:scale-[0.98] transition ${
              n.isRead ? "bg-white border-gray-100" : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {!n.isRead && (
                <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}
              <div className="min-w-0">
                {n.title && (
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                )}
                {n.message && <p className="text-sm text-gray-600">{n.message}</p>}
                {n.createdAt && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {formatDateTime(n.createdAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
