import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import type { ExpenseEmployeeGroup, ExpenseStatus } from "@/types/expenseRequest";
import { statusLabel } from "@/types/expenseRequest";

import ExpenseCard from "./ExpenseCard";
import { resolveExpenseRequestId } from "../lib";

const normalize = (value?: string) =>
  (value || "").trim().toLocaleLowerCase("vi-VN");

export default function EmployeeGroupCard({
  group,
  onItemClick,
}: {
  group: ExpenseEmployeeGroup;
  onItemClick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");

  const statusOptions = useMemo(() => {
    const set = new Set<ExpenseStatus>();
    (group.requests || []).forEach((item) => set.add(item.status));
    return Array.from(set);
  }, [group.requests]);

  const filteredRequests = useMemo(() => {
    const q = normalize(search);
    return (group.requests || []).filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        normalize(item.code).includes(q) ||
        normalize(item.content).includes(q) ||
        normalize(item.school?.name).includes(q)
      );
    });
  }, [group.requests, search, statusFilter]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex flex-col items-center pt-3 pb-2 px-3 text-center active:scale-[0.99]"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 bg-blue-50">
            👤
          </div>

          <p className="text-xs font-semibold text-gray-800 mt-1.5 leading-tight line-clamp-2 w-full">
            {group.employee?.name || `#${group.employeeId}`}
          </p>

          {group.employee?.phone && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {group.employee.phone}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-1 mt-2">
            <span className="text-[11px] px-1.5 py-[2px] rounded-full font-medium bg-blue-100 text-blue-700">
              {group.total} đề xuất
            </span>
            {group.totalAmount > 0 && (
              <span className="text-[11px] px-1.5 py-[2px] rounded-full font-medium bg-emerald-100 text-emerald-700">
                {group.totalAmount.toLocaleString("vi-VN")} đ
              </span>
            )}
          </div>

          <div className="mt-1.5 text-gray-400">
            <ChevronDown size={16} />
          </div>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => {
            setOpen(false);
            setSearch("");
            setStatusFilter("");
          }}
        >
          <div
            className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-gray-800">
                  {group.employee?.name || `#${group.employeeId}`}
                </h2>
                {group.employee?.phone && (
                  <p className="text-[11px] text-gray-400">{group.employee.phone}</p>
                )}
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  setStatusFilter("");
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="shrink-0 space-y-2 border-b border-gray-100 px-3 py-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm mã, nội dung, trường..."
                  className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | "")}
                className="w-full rounded-lg border border-gray-200 py-1.5 px-2 text-xs"
              >
                <option value="">Tất cả trạng thái</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 overflow-y-auto bg-gray-50 p-3">
              {filteredRequests.length === 0 && (
                <div className="py-10 text-center text-xs text-gray-400">
                  Không có đề xuất phù hợp
                </div>
              )}
              {filteredRequests.map((item, index) => {
                const requestId = resolveExpenseRequestId(item);
                return (
                  <ExpenseCard
                    key={requestId ?? `invalid-${index}`}
                    item={item}
                    showCreator={false}
                    onClick={() => requestId && onItemClick(requestId)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
