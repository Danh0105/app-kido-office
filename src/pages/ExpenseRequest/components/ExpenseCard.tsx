import { formatVnd } from "@/utils/decimal";
import type { ExpenseRequest } from "@/types/expenseRequest";
import StatusBadge from "./StatusBadge";
import { creatorName, formatDate } from "../lib";

export default function ExpenseCard({
  item,
  onClick,
  showCreator,
}: {
  item: ExpenseRequest;
  onClick: () => void;
  showCreator?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 shadow-sm border active:scale-[0.98] transition cursor-pointer ${
        item.isOverdue ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={item.status} />
          {item.isOverdue && (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-red-100 text-red-700">
              ⚠️ Quá hạn
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 shrink-0">{item.code}</span>
      </div>

      <p className="mt-2 font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2">
        {item.content}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-800">
          💰 {formatVnd(item.amount)} đ
        </span>
        {item.expectedPaymentDate && (
          <span className={item.isOverdue ? "text-red-600 font-medium" : ""}>
            📅 Dự kiến chi: {formatDate(item.expectedPaymentDate)}
          </span>
        )}
        {item.school?.name && <span>🏫 {item.school.name}</span>}
        {item.schoolYear && <span>🎓 {item.schoolYear}</span>}
        {showCreator && <span>👤 {creatorName(item)}</span>}
      </div>
    </div>
  );
}
