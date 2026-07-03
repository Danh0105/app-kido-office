import { STATUS_META, type ExpenseStatus } from "@/types/expenseRequest";

export default function StatusBadge({
  status,
  className = "",
}: {
  status: ExpenseStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium ${
        meta?.badge || "bg-gray-100 text-gray-700"
      } ${className}`}
    >
      {meta?.label || status}
    </span>
  );
}
