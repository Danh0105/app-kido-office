import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { hasRole } from "@/utils/auth";
import { expenseRequestApi } from "@/service/expenseRequest";
import type {
  EquipmentSource,
  ExpenseRequest,
  ExpenseRequestKind,
} from "@/types/expenseRequest";

import ExpenseCard from "./components/ExpenseCard";
import { enrichExpenseRequestsWithCreators } from "./creatorProfiles";
import { useExpenseSocket } from "./useExpenseSocket";
import {
  equipmentSourceOf,
  expenseBasePath,
  isEquipmentRequest,
  isTechnical,
} from "./lib";

/**
 * Phòng kỹ thuật nhận đúng hai loại việc từ `my-tasks` (backend đã lọc sẵn theo
 * role và theo `requestKind`), tách nhóm cho khỏi lẫn: lệnh xuất kho là việc
 * làm mới, còn nhận lại thiết bị là việc dọn hàng chưa dùng.
 */
const TECHNICAL_TASK_GROUPS: {
  title: string;
  statuses: ExpenseRequest["status"][];
  kinds: ExpenseRequestKind[];
  /** Chỉ xét với đề xuất thiết bị; bỏ trống = mọi nguồn. */
  sources?: EquipmentSource[];
  empty: string;
}[] = [
  {
    title: "📦 Chờ lên lệnh xuất kho",
    statuses: ["APPROVED", "EQUIPMENT_RETURNED"],
    kinds: ["EQUIPMENT"],
    sources: ["STOCK"],
    empty: "Không có đề xuất nào chờ lên lệnh xuất kho",
  },
  {
    title: "🏬 Thiết bị chờ nhận lại",
    statuses: ["NOT_SPENT"],
    kinds: ["EQUIPMENT"],
    empty: "Không có thiết bị nào chờ nhập lại kho",
  },
  {
    title: "🔧 Sửa chữa chờ phản hồi",
    statuses: ["APPROVED"],
    kinds: ["REPAIR"],
    empty: "Không có đề xuất sửa chữa nào chờ phản hồi",
  },
  // Thiết bị từ nhà cung cấp: chỉ có khi chính mình được Giám đốc chỉ định
  // (BE đã lọc).
  {
    title: "📥 Chờ lập phiếu nhập kho",
    statuses: ["APPROVED"],
    kinds: ["EQUIPMENT"],
    sources: ["SUPPLIER"],
    empty: "Không có phiếu nhập kho nào được giao cho bạn",
  },
  {
    title: "📋 Chờ bạn nghiệm thu",
    statuses: ["STOCK_IN_COMPLETED"],
    kinds: ["EQUIPMENT"],
    sources: ["SUPPLIER"],
    empty: "Không có đề xuất nào chờ bạn nghiệm thu",
  },
];

export default function ExpenseTasks() {
  const navigate = useNavigate();
  const base = expenseBasePath();
  const isSaleAdmin = hasRole("saleadmin", "salesadmin_la");
  const technical = isTechnical();
  const title = isSaleAdmin ? "Cần kiểm duyệt" : "Việc của tôi";

  const [items, setItems] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseRequestApi.myTasks();
      const uniqueItems = new Map<number, ExpenseRequest>();
      (res || []).forEach((item) => {
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
        {!loading &&
          technical &&
          items.length > 0 &&
          TECHNICAL_TASK_GROUPS.map((group) => {
            const groupItems = items.filter(
              (item) =>
                group.statuses.includes(item.status) &&
                group.kinds.includes(item.requestKind ?? "CASH") &&
                (!group.sources ||
                  !isEquipmentRequest(item) ||
                  group.sources.includes(equipmentSourceOf(item))),
            );

            return (
              <section key={group.title} className="space-y-2">
                <h2 className="pt-1 text-sm font-semibold text-gray-700">
                  {group.title}
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    ({groupItems.length})
                  </span>
                </h2>
                {groupItems.length === 0 ? (
                  <p className="rounded-2xl bg-white px-3 py-4 text-center text-xs text-gray-400 border border-gray-100">
                    {group.empty}
                  </p>
                ) : (
                  groupItems.map((item) => (
                    <ExpenseCard
                      key={item.id}
                      item={item}
                      onClick={() => navigate(`${base}/${item.id}`)}
                    />
                  ))
                )}
              </section>
            );
          })}

        {!technical &&
          items.map((item) => (
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
