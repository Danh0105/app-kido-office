import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { hasRole } from "@/utils/auth";
import { expenseRequestApi } from "@/service/expenseRequest";
import type { ExpenseRequest } from "@/types/expenseRequest";

import ExpenseCard from "./components/ExpenseCard";
import { enrichExpenseRequestsWithCreators } from "./creatorProfiles";
import { useExpenseSocket } from "./useExpenseSocket";
import {
  expenseBasePath,
  isDebtAccountant,
} from "./lib";

export default function ExpenseTasks() {
  const navigate = useNavigate();
  const base = expenseBasePath();
  const isSaleAdmin = hasRole("saleadmin", "salesadmin_la");
  const title = isSaleAdmin ? "Cần kiểm duyệt" : "Việc của tôi";

  const [items, setItems] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseRequestApi.myTasks();
      let trackedFundReturned: ExpenseRequest[] = [];

      if (isDebtAccountant()) {
        try {
          const tracked = await expenseRequestApi.list({
            status: "FUND_RETURNED",
            page: 1,
            limit: 100,
          });
          trackedFundReturned = tracked.data || [];
        } catch (error) {
          console.warn("Không tải được danh sách đề xuất đã hoàn quỹ:", error);
        }
      }

      const uniqueItems = new Map<number, ExpenseRequest>();
      [...(res || []), ...trackedFundReturned].forEach((item) => {
        uniqueItems.set(item.id, item);
      });

      const sortedItems = [...uniqueItems.values()].sort(
          (first, second) =>
            new Date(second.updatedAt || second.createdAt || 0).getTime() -
            new Date(first.updatedAt || first.createdAt || 0).getTime(),
        );

      setItems(await enrichExpenseRequestsWithCreators(sortedItems));
    } catch (e) {
      console.error(e);
      toast.error("Không tải được việc cần làm");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useExpenseSocket(() => load());

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title={title} />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3 pt-2">
        {loading && (
          <div className="text-center text-gray-400 text-sm py-10">Đang tải…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            {isSaleAdmin ? "🎉 Không có đề xuất cần kiểm duyệt" : "🎉 Không có việc cần xử lý"}
          </div>
        )}
        {items.map((item) => (
          <ExpenseCard
            key={item.id}
            item={item}
            onClick={() => navigate(`${base}/${item.id}`)}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
