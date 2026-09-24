import { KIND_META, type ExpenseRequestKind } from "@/types/expenseRequest";

/**
 * Badge loại đề xuất — đứng cạnh mã đề xuất ở cả danh sách và chi tiết.
 * Đề xuất cũ không có `requestKind` nên mặc định về "Tiền" (xem `requestKindOf`).
 */
export default function KindBadge({
  kind = "CASH",
  className = "",
  full = false,
}: {
  kind?: ExpenseRequestKind;
  className?: string;
  /** `true` = hiện đủ "Đề xuất thiết bị" thay vì chỉ "Thiết bị". */
  full?: boolean;
}) {
  const meta = KIND_META[kind] || KIND_META.CASH;

  return (
    <span
      title={meta.label}
      className={`inline-block whitespace-nowrap text-[10px] px-2 py-[2px] rounded-full font-medium ${meta.badge} ${className}`}
    >
      {meta.icon} {full ? meta.label : meta.short}
    </span>
  );
}
