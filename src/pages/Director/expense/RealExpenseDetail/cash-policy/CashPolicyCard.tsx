// components/cash-policy/CashPolicyCard.tsx

import { Pencil, Trash2 } from "lucide-react";

type Props = {
  item: any;

  onEdit: (item: any) => void;

  onDelete: (id: number) => void;
};

export default function CashPolicyCard({ item, onEdit, onDelete }: Props) {
  return (
    <div
      className="
        bg-slate-50
        rounded-2xl
        border border-slate-200
        p-5
      "
    >
      <div className="flex items-start justify-between gap-4">
        {/* LEFT */}
        <div className="space-y-3">
          {/* PAYER */}
          <div className="text-lg font-bold text-slate-800">
            {item.payer || "--"}
          </div>

          {/* CASH POLICY */}
          <div className="text-sm text-slate-500">
            CS tiền mặt:
            <span className="ml-2 font-bold text-orange-600">
              {Number(item.cashPolicyAmount || 0).toLocaleString("vi-VN")}đ
            </span>
          </div>

          {/* OTHER */}
          <div className="text-sm text-slate-500">
            Chi khác:
            <span className="ml-2 font-bold text-red-500">
              {Number(item.otherAmount || 0).toLocaleString("vi-VN")}đ
            </span>
          </div>

          {/* DATE */}
          <div className="text-sm text-slate-400">
            {item.paymentDate?.slice(0, 10) || "--"}
          </div>

          {/* NOTE */}
          {item.note && (
            <div className="text-sm text-slate-600">{item.note}</div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
          {/* EDIT */}
          <button
            onClick={() => onEdit(item)}
            className="
              h-10 px-4 rounded-xl

              border border-slate-200
              bg-white

              text-slate-600

              hover:bg-orange-50
              hover:border-orange-200
              hover:text-orange-600

              transition-all
            "
          >
            <Pencil size={18} />
          </button>

          {/* DELETE */}
          <button
            onClick={() => onDelete(item.id)}
            className="
              h-10 px-4 rounded-xl

              border border-red-200
              bg-white

              text-red-500

              hover:bg-red-50

              transition-all
            "
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
