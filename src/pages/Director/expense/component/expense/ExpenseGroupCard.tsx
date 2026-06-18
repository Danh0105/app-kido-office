// components/expense/ExpenseGroupCard.tsx
import EmptyState from "../../RealExpenseDetail/EmptyState";
import ExpenseItemCard from "./ExpenseItemCard";

type Props = {
  schoolExpense: any;

  onEdit: (item: any) => void;

  onDelete: (id: number) => void;
};

export default function ExpenseGroupCard({
  schoolExpense,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div
      className="
        bg-white
        rounded-3xl
        p-5
        shadow-sm
        border border-slate-100
      "
    >
      {/* HEADER */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* PERIOD */}
          <p
            className="
              inline-flex items-center
              px-3 py-1
              rounded-full
              bg-blue-100
              text-blue-700
              text-sm
              font-semibold
              shadow-sm
            "
          >
            {schoolExpense.period?.name}
          </p>

          {/* TOTAL */}
          <div
            className="
              px-3 py-1
              rounded-full
              bg-slate-100
              text-slate-600
              text-sm
              font-medium
            "
          >
            {schoolExpense.expenseItems?.length || 0} khoản
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="space-y-4">
        {schoolExpense.expenseItems?.length > 0 ? (
          schoolExpense.expenseItems.map((item: any) => (
            <ExpenseItemCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        ) : (
          <EmptyState text="Chưa có dữ liệu thu chi" />
        )}
      </div>
    </div>
  );
}
