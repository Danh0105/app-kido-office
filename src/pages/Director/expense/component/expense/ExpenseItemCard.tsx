// components/expense/ExpenseItemCard.tsx

import { Pencil, Trash2 } from "lucide-react";
import Item from "./Item";

type Props = {
  item: any;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
};

export default function ExpenseItemCard({ item, onEdit, onDelete }: Props) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        {/* LEFT */}
        <div>
          <p className="font-bold text-xl text-slate-900">
            {item.subject?.name || "--"}
          </p>

          <div className="flex flex-wrap gap-3 mt-3">
            {/* TOTAL PERIODS */}
            <div
              className="
                px-3 py-1 rounded-xl
                bg-blue-50
                text-blue-700
                text-sm font-medium
              "
            >
              {item.totalPeriods || 0} tiết
            </div>

            {/* STUDENT */}
            <div
              className="
                px-3 py-1 rounded-xl
                bg-emerald-50
                text-emerald-700
                text-sm font-medium
              "
            >
              {item.studentCount || 0} học sinh
            </div>

            {/* PAYER */}
            <div
              className="
                px-3 py-1 rounded-xl
                bg-purple-50
                text-purple-700
                text-sm font-medium
              "
            >
              Người chi: {item.payer || "--"}
            </div>
          </div>
        </div>

        {/* ACTION */}
        <div className="flex items-center gap-2">
          {/* EDIT */}
          <button
            onClick={() => onEdit(item)}
            className="
              w-11 h-11 rounded-xl
              bg-blue-50
              text-blue-600
              hover:bg-blue-100
              flex items-center justify-center
              transition
            "
          >
            <Pencil size={18} />
          </button>

          {/* DELETE */}
          <button
            onClick={() => onDelete(item.id)}
            className="
              w-11 h-11 rounded-xl
              bg-red-50
              text-red-500
              hover:bg-red-100
              flex items-center justify-center
              transition
            "
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* MONEY */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <Item label="Doanh thu" value={item.revenueAmount} color="blue" />

        <Item label="Tiền hóa đơn" value={item.invoiceAmount} color="blue" />

        <Item label="Chi phí" value={item.expenseAmount} color="red" />

        <Item
          label="Chi ngoài HĐ"
          value={item.totalOutsideExpense}
          color="orange"
        />

        <Item label="Đã chi" value={item.paidAmount} color="red" />

        <Item
          label="Còn phải chi"
          value={item.remainingOutsideExpense}
          color="emerald"
        />
      </div>

      {/* DATE */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        {/* COLLECT DATE */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Ngày thu tiền</p>

          <p className="font-semibold text-slate-700 mt-2">
            {item.collectedDate || "--"}
          </p>
        </div>

        {/* PAYMENT DATE */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Ngày chi</p>

          <p className="font-semibold text-slate-700 mt-2">
            {item.paymentDate || "--"}
          </p>
        </div>
      </div>

      {/* NOTE */}
      {item.note && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">Ghi chú</p>

          <div
            className="
              bg-slate-50
              rounded-2xl
              p-4
              text-sm
              text-slate-700
              leading-relaxed
            "
          >
            {item.note}
          </div>
        </div>
      )}
    </div>
  );
}
