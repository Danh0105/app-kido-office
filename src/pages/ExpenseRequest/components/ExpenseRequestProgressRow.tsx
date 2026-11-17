import type { ExpenseRequest } from "@/types/expenseRequest";
import ExpenseCard from "./ExpenseCard";
import WorkflowProgressCompact from "./WorkflowProgressCompact";

/**
 * Mỗi đề xuất chi có đúng một thẻ thông tin và một thanh tiến trình nằm cạnh.
 * Chỉ bấm vào thẻ thông tin mới mở chi tiết đề xuất.
 */
export default function ExpenseRequestProgressRow({
  item,
  onClick,
  showCreator = true,
  onEdit,
  onWithdraw,
  onDelete,
}: {
  item: ExpenseRequest;
  onClick: () => void;
  showCreator?: boolean;
  onEdit?: (item: ExpenseRequest) => void;
  onWithdraw?: (item: ExpenseRequest) => void;
  onDelete?: (item: ExpenseRequest) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)] lg:items-stretch">
      <div className="min-w-0">
        <ExpenseCard
          item={item}
          onClick={onClick}
          showCreator={showCreator}
          onEdit={onEdit}
          onWithdraw={onWithdraw}
          onDelete={onDelete}
        />
      </div>
      <div className="min-w-0">
        <WorkflowProgressCompact request={item} />
      </div>
    </div>
  );
}
