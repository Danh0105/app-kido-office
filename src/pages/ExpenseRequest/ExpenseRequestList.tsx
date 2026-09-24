import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Plus, ClipboardList, Settings } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { getEmployeeId, hasRole } from "@/utils/auth";
import { expenseRequestApi } from "@/service/expenseRequest";
import {
  KIND_META,
  statusLabel,
  type ExpenseEmployeeGroup,
  type ExpenseRequest,
  type ExpenseRequestKind,
  type ExpenseStatus,
} from "@/types/expenseRequest";

import ExpenseCard from "./components/ExpenseCard";
import EmployeeGroupCard from "./components/EmployeeGroupCard";
import ActionModal, { type ActionPayload } from "./components/ActionModal";
import ExpenseRequestDetail from "./ExpenseRequestDetail";
import { enrichExpenseRequestsWithCreators } from "./creatorProfiles";
import { useExpenseSocket } from "./useExpenseSocket";
import {
  expenseBasePath,
  expenseCreatePath,
  expenseEditPath,
  expenseTasksPath,
  isApproverSide,
  isEquipmentOnlyUser,
  isTechnical,
  KIND_STATUSES,
  resolveExpenseRequestId,
} from "./lib";

/** Tab loại đề xuất; "" = tất cả. */
type KindFilter = ExpenseRequestKind | "";

const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "CASH", label: `${KIND_META.CASH.icon} ${KIND_META.CASH.label}` },
  {
    value: "EQUIPMENT",
    label: `${KIND_META.EQUIPMENT.icon} ${KIND_META.EQUIPMENT.label}`,
  },
  {
    value: "REPAIR",
    label: `${KIND_META.REPAIR.icon} ${KIND_META.REPAIR.label}`,
  },
];

const PAGE_SIZE = 20;

type ViewMode = "mine" | "flat" | "grouped";

const normalizeEmployeeName = (value?: string) =>
  (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");

const groupExpenseRequestsByEmployeeName = (
  groups: ExpenseEmployeeGroup[],
): ExpenseEmployeeGroup[] => {
  const merged = new Map<string, ExpenseEmployeeGroup>();

  groups.forEach((group) => {
    const displayName = group.employee?.name?.trim();
    const key = displayName
      ? normalizeEmployeeName(displayName)
      : `#${group.employeeId}`;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, {
        ...group,
        employee: {
          ...group.employee,
          name: displayName || group.employee?.name,
        },
        requests: group.requests || [],
      });
      return;
    }

    const nextRequests = [...(current.requests || []), ...(group.requests || [])];
    merged.set(key, {
      ...current,
      total: current.total + group.total,
      totalAmount: current.totalAmount + group.totalAmount,
      requests: nextRequests.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      ),
    });
  });

  return Array.from(merged.values()).sort((a, b) =>
    (a.employee?.name || "").localeCompare(b.employee?.name || "", "vi-VN"),
  );
};

export default function ExpenseRequestList() {
  const navigate = useNavigate();
  const base = expenseBasePath();
  const approverSide = isApproverSide();
  const canCreate = hasRole("sales");
  const isMultiRoleSales = canCreate && approverSide;

  // Tài khoản chỉ thuộc phòng kỹ thuật: backend giới hạn về thiết bị/sửa chữa.
  const equipmentOnly = isEquipmentOnlyUser();

  const title = equipmentOnly
    ? "Đề xuất kỹ thuật"
    : approverSide
      ? hasRole("saleadmin", "salesadmin_la")
        ? "Tất cả đề xuất chi"
        : "Đề xuất chi"
      : "Đề xuất chi của tôi";

  const [items, setItems] = useState<ExpenseRequest[]>([]);
  const [groups, setGroups] = useState<ExpenseEmployeeGroup[]>([]);
  const technical = isTechnical();
  const [viewMode, setViewMode] = useState<ViewMode>(
    isMultiRoleSales
      ? "mine"
      : // Phòng kỹ thuật làm việc theo từng đơn hàng cần xuất kho, gom theo
        // nhân viên kinh doanh không giúp gì cho việc của họ.
        technical
        ? "flat"
        : approverSide
          ? "grouped"
          : "mine",
  );
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [requestKind, setRequestKind] = useState<KindFilter>("");
  const effectiveKind: KindFilter = requestKind;
  const [status, setStatus] = useState<ExpenseStatus | "">("");
  const [overdue, setOverdue] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [withdrawTarget, setWithdrawTarget] = useState<ExpenseRequest | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [desktopDetailId, setDesktopDetailId] = useState<number | null>(null);

  const submitWithdraw = async (payload: ActionPayload) => {
    const requestId = withdrawTarget && resolveExpenseRequestId(withdrawTarget);
    if (!requestId) return;

    setWithdrawing(true);
    try {
      await expenseRequestApi.withdraw(requestId, payload.note);
      toast.success("Đã rút đề xuất");
      setWithdrawTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setWithdrawing(false);
    }
  };

  const submitDelete = async () => {
    const requestId = deleteTarget && resolveExpenseRequestId(deleteTarget);
    if (!requestId) return;

    setDeleting(true);
    try {
      await expenseRequestApi.remove(requestId);
      toast.success("Đã xoá đề xuất");
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setDeleting(false);
    }
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
  };

  const openRequestDetail = (requestId: number) => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopDetailId(requestId);
      return;
    }
    navigate(`${base}/${requestId}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        requestKind: effectiveKind || undefined,
        status: status || undefined,
        overdue: overdue || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      };

      if (viewMode === "grouped") {
        const res = await expenseRequestApi.groupedByEmployee(filters);
        const enrichedGroups = await Promise.all(
          (res.data || []).map(async (g) => ({
            ...g,
            requests: await enrichExpenseRequestsWithCreators(g.requests || []),
          })),
        );
        setGroups(groupExpenseRequestsByEmployeeName(enrichedGroups));
        setTotalPages(res.totalPages || 1);
      } else {
        const res = await expenseRequestApi.list({
          // Sales chỉ xem đề xuất của mình; các role duyệt xem theo scope backend.
          createdBy:
            viewMode === "mine" || !approverSide
              ? Number(getEmployeeId()) || undefined
              : undefined,
          ...filters,
        });
        const enrichedItems = await enrichExpenseRequestsWithCreators(res.data || []);
        setItems(enrichedItems);
        setTotalPages(res.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
      toast.error("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [approverSide, effectiveKind, status, overdue, fromDate, toDate, page, viewMode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!desktopDetailId) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDesktopDetailId(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [desktopDetailId]);

  // Auto-refresh when another role updates a request.
  useExpenseSocket(() => {
    load();
  });

  // Lọc theo loại nào thì chỉ chào trạng thái có thật trong nhánh đó.
  const statusOptions = effectiveKind
    ? KIND_STATUSES[effectiveKind]
    : [
        ...new Set([
          ...KIND_STATUSES.CASH,
          ...KIND_STATUSES.EQUIPMENT,
          ...KIND_STATUSES.REPAIR,
        ]),
      ];

  const changeRequestKind = (value: KindFilter) => {
    setPage(1);
    setRequestKind(value);
    // Trạng thái đang lọc có thể không tồn tại ở nhánh vừa chọn.
    if (value && status && !KIND_STATUSES[value].includes(status)) setStatus("");
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title={title} />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        {/* Toolbar */}
        <div className="flex gap-2 pt-2">
          {canCreate && (
            <button
              onClick={() => navigate(expenseCreatePath())}
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

        {/* View mode toggle */}
        {approverSide && (
          <div
            className={`grid gap-1 bg-white rounded-xl p-1 border border-gray-100 ${
              isMultiRoleSales ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            {isMultiRoleSales && (
              <button
                onClick={() => changeViewMode("mine")}
                className={`py-1.5 text-xs font-medium rounded-lg transition ${
                  viewMode === "mine" ? "bg-blue-500 text-white" : "text-gray-500"
                }`}
              >
                Đề xuất của tôi
              </button>
            )}
            <button
              onClick={() => changeViewMode("flat")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                viewMode === "flat" ? "bg-blue-500 text-white" : "text-gray-500"
              }`}
            >
              Danh sách phẳng
            </button>
            <button
              onClick={() => changeViewMode("grouped")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                viewMode === "grouped" ? "bg-blue-500 text-white" : "text-gray-500"
              }`}
            >
              Theo nhân viên kinh doanh
            </button>
          </div>
        )}

        {/* Phòng kỹ thuật có tab Thiết bị/Sửa chữa; tab Tiền được ẩn. */}
        <div className={`grid gap-1 bg-white rounded-xl p-1 border border-gray-100 ${
          equipmentOnly ? "grid-cols-3" : "grid-cols-4"
        }`}>
          {KIND_TABS.filter(
            (tab) => !equipmentOnly || tab.value !== "CASH",
          ).map((tab) => (
            <button
              key={tab.value || "all"}
              onClick={() => changeRequestKind(tab.value)}
              className={`py-1.5 text-xs font-medium rounded-lg transition ${
                requestKind === tab.value
                  ? "bg-blue-500 text-white"
                  : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
                  {statusLabel(s, effectiveKind || "CASH")}
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

        {!loading && viewMode !== "grouped" && items.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            Không có đề xuất nào
          </div>
        )}
        {viewMode !== "grouped" &&
          items.map((item, index) => {
            const requestId = resolveExpenseRequestId(item);
            return (
              <ExpenseCard
                key={requestId ?? `invalid-${index}`}
                item={item}
                onClick={() => requestId && openRequestDetail(requestId)}
                onEdit={(request) => navigate(expenseEditPath(request.id))}
                onWithdraw={setWithdrawTarget}
                onDelete={setDeleteTarget}
              />
            );
          })}

        {!loading && viewMode === "grouped" && groups.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            Không có nhân viên kinh doanh nào
          </div>
        )}
        {viewMode === "grouped" && groups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {groups.map((group) => (
              <EmployeeGroupCard
                key={group.employeeId}
                group={group}
                onItemClick={openRequestDetail}
              />
            ))}
          </div>
        )}

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

      {withdrawTarget && (
        <ActionModal
          title="Rút đề xuất"
          submitLabel="Rút đề xuất"
          submitColor="bg-gray-600"
          showNote
          noteLabel="Lý do rút (không bắt buộc)"
          loading={withdrawing}
          onClose={() => setWithdrawTarget(null)}
          onSubmit={submitWithdraw}
        />
      )}

      {deleteTarget && (
        <ActionModal
          title={`Xoá đề xuất ${deleteTarget.code || ""}`}
          submitLabel="Xoá đề xuất"
          submitColor="bg-red-600"
          loading={deleting}
          onClose={() => setDeleteTarget(null)}
          onSubmit={submitDelete}
        />
      )}

      {desktopDetailId && (
        <div
          className="fixed inset-0 z-[70] hidden items-center justify-center bg-black/55 p-6 lg:flex"
          onMouseDown={() => setDesktopDetailId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết đề xuất"
        >
          <div
            className="flex h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-gray-100 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
              <h2 className="text-lg font-bold text-gray-900">
                Chi tiết đề xuất
              </h2>
              <button
                type="button"
                onClick={() => setDesktopDetailId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-500 transition hover:bg-gray-200 hover:text-gray-800"
                aria-label="Đóng chi tiết đề xuất"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ExpenseRequestDetail
                key={desktopDetailId}
                requestId={desktopDetailId}
                embedded
                onClose={() => setDesktopDetailId(null)}
                onChanged={load}
              />
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
