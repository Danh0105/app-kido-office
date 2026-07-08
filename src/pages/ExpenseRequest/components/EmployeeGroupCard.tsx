import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { formatVnd } from "@/utils/decimal";
import type { ExpenseEmployeeGroup } from "@/types/expenseRequest";

import ExpenseCard from "./ExpenseCard";

export default function EmployeeGroupCard({
  group,
  onItemClick,
}: {
  group: ExpenseEmployeeGroup;
  onItemClick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left active:scale-[0.99]"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
            Nhân viên kinh doanh
          </div>
          <p className="font-semibold text-gray-900 truncate">
            {group.employee?.name || `#${group.employeeId}`}
          </p>
          {group.employee?.phone && (
            <p className="text-xs text-gray-500">{group.employee.phone}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-blue-100 text-blue-700">
            {group.total} đề xuất
          </span>
          <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
            {formatVnd(group.totalAmount)} đ
          </span>
          {open ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
          {(group.requests || []).map((item) => (
            <ExpenseCard
              key={item.id}
              item={item}
              showCreator={false}
              onClick={() => onItemClick(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
