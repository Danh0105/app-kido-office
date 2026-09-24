import {
  STATUS_META,
  statusLabel,
  type ExpenseRequestKind,
  type ExpenseStatus,
} from "@/types/expenseRequest";

export default function StatusBadge({
  status,
  kind = "CASH",
  className = "",
}: {
  status: ExpenseStatus;
  /**
   * `SPENT` / `NOT_SPENT` dùng chung cho hai nhánh nhưng đọc khác nhau
   * ("đã chi" ↔ "đã bàn giao"), nên nhãn phải tra kèm loại đề xuất.
   */
  kind?: ExpenseRequestKind;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-block whitespace-nowrap text-[10px] px-2 py-[2px] rounded-full font-medium ${
        meta?.badge || "bg-gray-100 text-gray-700"
      } ${className}`}
    >
      {statusLabel(status, kind) || status}
    </span>
  );
}
