import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Plus, ClipboardList, Settings } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { getEmployeeId, hasRole } from "@/utils/auth";
import { expenseRequestApi } from "@/service/expenseRequest";
import { STATUS_META, type ExpenseRequest, type ExpenseStatus } from "@/types/expenseRequest";

import ExpenseCard from "./components/ExpenseCard";
import { useExpenseSocket } from "./useExpenseSocket";
import { expenseBasePath, expenseTasksPath, isApproverSide } from "./lib";

const PAGE_SIZE = 20;

export default function ExpenseRequestList() {
  const navigate = useNavigate();
  const base = expenseBasePath();
  const approverSide = isApproverSide();
  const canCreate = hasRole("sales");

  const title = approverSide
    ? hasRole("saleadmin", "salesadmin_la")
      ? "Tất cả đề xuất chi"
      : "Đề xuất chi"
    : "Đề xuất chi của tôi";

  const [items, setItems] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [status, setStatus] = useState<ExpenseStatus | "">("");
  const [overdue, setOverdue] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseRequestApi.list({
        // Sales chỉ xem đề xuất của mình; các role duyệt xem theo scope backend.
        createdBy: !approverSide ? Number(getEmployeeId()) || undefined : undefined,
        status: status || undefined,
        overdue: overdue || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data || []);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [approverSide, status, overdue, fromDate, toDate, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when another role updates a request.
  useExpenseSocket(() => {
    load();
  });

  const statusOptions = Object.keys(STATUS_META) as ExpenseStatus[];

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title={title} />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        {/* Toolbar */}
        <div className="flex gap-2 pt-2">
          {canCreate && (
            <button
              onClick={() => navigate(`${base}/new`)}
              className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
            >
              <Plus size={16} /> Tạo đề xuất
            </button>
          )}
          <button
            onClick={() => navigate(expenseTasksPath())}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium active:scale-95"
          >
            <ClipboardList size={16} /> Việc của tôi
          </button>
          {hasRole("director", "director_la") && (
            <button
              onClick={() => navigate("/director/expense-reminder-settings")}
              className="flex items-center justify-center px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl active:scale-95"
              title="Cấu hình báo động"
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 space-y-2">
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as ExpenseStatus | "");
              }}
              className="flex-1 px-2 py-2 border rounded-lg text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => {
                  setPage(1);
                  setOverdue(e.target.checked);
                }}
              />
              Quá hạn
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              className="flex-1 px-2 py-2 border rounded-lg text-sm"
            />
            <span className="self-center text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              className="flex-1 px-2 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* List */}
        {loading && (
          <div className="text-center text-gray-400 text-sm py-10">Đang tải…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            Không có đề xuất nào
          </div>
        )}
        {items.map((item) => (
          <ExpenseCard
            key={item.id}
            item={item}
            showCreator={approverSide}
            onClick={() => navigate(`${base}/${item.id}`)}
          />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 disabled:opacity-40"
            >
              ← Trước
            </button>
            <span className="text-sm text-gray-600">
              {page}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
