// components/cash-policy/CashPolicyList.tsx

import EmptyState from "../EmptyState";
import CashPolicyCard from "./CashPolicyCard";

type Props = {
  data: any[];

  onEdit: (item: any) => void;

  onDelete: (id: number) => void;
};

export default function CashPolicyList({ data, onEdit, onDelete }: Props) {
  if (!data || data.length === 0) {
    return <EmptyState text="Không có dữ liệu" />;
  }

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
          {/* HEADER */}
          <div className="mb-5">
            {/* PERIOD */}
            <p className="text-sm text-slate-500 mt-1">
              {schoolExpense.period?.name}
            </p>
          </div>

          {/* ITEMS */}
          <div className="space-y-4">
            {schoolExpense.cashPolicyItems?.length > 0 ? (
              schoolExpense.cashPolicyItems.map((item: any) => (
                <CashPolicyCard
                  key={item.id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            ) : (
              <EmptyState text="Chưa có dữ liệu chính sách tiền mặt" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
