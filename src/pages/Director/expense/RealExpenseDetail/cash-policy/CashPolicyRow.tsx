// components/cash-policy/CashPolicyRow.tsx

import { Trash2 } from "lucide-react";

type CashPolicyRowType = {
  payer: string;
  cashPolicyAmount: string;
  otherAmount: string;
  paymentDate: string;
  note: string;
};

type Props = {
  row: CashPolicyRowType;

  index: number;

  updateCashPolicyRow: (
    index: number,
    field: keyof CashPolicyRowType,
    value: string,
  ) => void;

  removeCashPolicyRow: (index: number) => void;
};

export default function CashPolicyRow({
  row,
  index,
  updateCashPolicyRow,
  removeCashPolicyRow,
}: Props) {
  return (
    <div
      className={`
        grid
        grid-cols-[260px_180px_180px_180px_1fr_90px]

        min-h-[72px]

        transition-all

        ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}

        hover:bg-orange-50/40
      `}
    >
      {/* PAYER */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={row.payer || ""}
          onChange={(e) => updateCashPolicyRow(index, "payer", e.target.value)}
          placeholder="Nhập người chi..."
          className="
            w-full h-11
            rounded-xl

            border border-slate-200
            bg-white

            px-4
            text-sm

            focus:border-orange-500
            focus:ring-4
            focus:ring-orange-100

            outline-none
          "
        />
      </div>

      {/* CASH POLICY */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={Number(row.cashPolicyAmount || 0).toLocaleString("vi-VN")}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");

            updateCashPolicyRow(index, "cashPolicyAmount", raw);
          }}
          placeholder="0"
          className="
            w-full h-11
            rounded-xl

            border border-slate-200
            bg-orange-50

            px-4

            text-right
            text-sm
            font-bold
            text-orange-600

            focus:border-orange-500
            focus:ring-4
            focus:ring-orange-100

            outline-none
          "
        />
      </div>

      {/* OTHER */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={Number(row.otherAmount || 0).toLocaleString("vi-VN")}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");

            updateCashPolicyRow(index, "otherAmount", raw);
          }}
          placeholder="0"
          className="
            w-full h-11
            rounded-xl

            border border-slate-200
            bg-red-50

            px-4

            text-right
            text-sm
            font-bold
            text-red-500

            focus:border-red-400
            focus:ring-4
            focus:ring-red-100

            outline-none
          "
        />
      </div>

      {/* DATE */}
      <div className="p-2 border-r border-slate-100">
        <input
          type="date"
          value={row.paymentDate || ""}
          onChange={(e) =>
            updateCashPolicyRow(index, "paymentDate", e.target.value)
          }
          className="
            w-full h-11
            rounded-xl

            border border-slate-200
            bg-white

            px-4
            text-sm

            focus:border-orange-500
            focus:ring-4
            focus:ring-orange-100

            outline-none
          "
        />
      </div>

      {/* NOTE */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={row.note || ""}
          onChange={(e) => updateCashPolicyRow(index, "note", e.target.value)}
          placeholder="Nhập ghi chú..."
          className="
            w-full h-11
            rounded-xl

            border border-slate-200
            bg-white

            px-4
            text-sm

            focus:border-orange-500
            focus:ring-4
            focus:ring-orange-100

            outline-none
          "
        />
      </div>

      {/* DELETE */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => removeCashPolicyRow(index)}
          className="
            w-10 h-10
            rounded-xl

            border border-slate-200
            bg-white

            text-slate-400

            hover:bg-red-50
            hover:border-red-200
            hover:text-red-500

            transition-all

            flex items-center justify-center
          "
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}
