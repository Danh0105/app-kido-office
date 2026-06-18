// components/expense/ExpenseList.tsx

import EmptyState from "../../RealExpenseDetail/EmptyState";
import ExpenseItemCard from "./ExpenseItemCard";
import ExpenseItemTable from "./ExpenseItemTable";

type Props = {
  data: any[];

  onEdit: (item: any) => void;

  onDelete: (id: number) => void;
};

export default function ExpenseList({ data, onEdit, onDelete }: Props) {
  if (!data || data.length === 0) {
    return <EmptyState text="Không có dữ liệu" />;
  }
  console.log("data", data);

  return (
    <div className="space-y-6">
      {data.map((schoolExpense: any) => (
        <div
          key={schoolExpense.id}
          className="
            bg-white
            rounded-3xl
            p-5
            shadow-sm
            border border-slate-100
          "
        >
          {/* PERIOD */}
          <div className="mb-5">
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
              {schoolExpense.expenseItems[0]?.schoolExpense?.period?.name}
            </p>
          </div>

          {/* ITEMS */}
          <div className="space-y-4">
            {schoolExpense.expenseItems?.length > 0 ? (
              schoolExpense.expenseItems.map((item: any) => (
                <ExpenseItemTable
                  key={item.id}
                  data={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            ) : (
              <EmptyState text="Chưa có dữ liệu thu chi" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
