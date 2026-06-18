// components/expense/RevenueExpenseRow.tsx

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  row: any;
  index: number;
  subjects: any;
  inputData: InputExpenseRow;

  updateRow: (index: number, field: string, value: string) => void;
  removeRow: (index: number) => void;
};

export default function RevenueExpenseRow({
  row,
  index,
  subjects,
  inputData,
  updateRow,
  removeRow,
}: Props) {
  const periods = Number(inputData.totalPeriods || 0);
  const students = Number(inputData.studentCount || 0);
  const months = Number(inputData.monthsCount || 0);

  const csvc = Number(subjects?.policies?.[0]?.data?.csvc || 0);

  const unitPrice = Number(
    row.unitPrice || subjects?.policies?.[0]?.data?.fee || 0,
  );

  const calculations = useMemo(() => {
    const invoiceAmount = students * months * unitPrice;

    const totalSchoolExpense = csvc * students + invoiceAmount * 0.02;

    return {
      invoiceAmount,
      totalSchoolExpense,
    };
  }, [students, months, unitPrice, csvc]);

  const inputClass = `
    w-full
    h-10
    px-3
    rounded-lg
    border
    border-slate-200
    bg-white
    text-sm
    outline-none
    transition-all
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
  `;

  return (
    <div
      className={`
        grid
        grid-cols-[90px_90px_90px_120px_180px_150px_150px_160px_160px_160px_180px_180px_70px]
        border-b
        hover:bg-blue-50/40
        transition-all
        ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
      `}
    >
      {/* SỐ TIẾT */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-slate-700">
        {periods}
      </div>

      {/* SỐ HS */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-sky-700">
        {students.toLocaleString("vi-VN")}
      </div>

      {/* SỐ THÁNG */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-indigo-700">
        {months}
      </div>

      {/* CSVC */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2">
        <span
          className="
            px-3 py-1
            rounded-full
            bg-emerald-100
            text-emerald-700
            font-bold
            text-sm
          "
        >
          {csvc.toLocaleString("vi-VN")}
        </span>
      </div>

      {/* CHI TRƯỜNG */}
      <div className="p-2 border-r border-slate-200">
        <input
          readOnly
          value={calculations.totalSchoolExpense.toLocaleString("vi-VN")}
          className="
            w-full h-10
            rounded-lg
            border-0
            bg-amber-100
            text-center
            font-bold
            text-amber-700
            text-center

          "
        />
      </div>

      {/* NGÀY CHI */}
      <div className="p-2 border-r border-slate-200">
        <input
          type="date"
          value={row.paymentDate || ""}
          onChange={(e) => updateRow(index, "paymentDate", e.target.value)}
          className={inputClass}
        />
      </div>

      {/* ĐÃ CHI */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={Number(row.paidAmount || 0).toLocaleString("vi-VN")}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");

            updateRow(index, "paidAmount", raw);
          }}
          placeholder="0"
          className="
            w-full h-10
            rounded-lg
            border-0
            bg-red-100
            text-red-600
            text-center
            font-bold
          "
        />
      </div>

      {/* CÒN LẠI */}
      <div className="p-2 border-r border-slate-200">
        <input
          readOnly
          value={Number(row.remainingOutsideExpense || 0).toLocaleString(
            "vi-VN",
          )}
          className="
            w-full h-10
            rounded-lg
            border-0
            bg-violet-100
            text-violet-700
            text-center
            font-bold
          "
        />
      </div>

      {/* NGƯỜI CHI */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={row.payer || ""}
          onChange={(e) => updateRow(index, "payer", e.target.value)}
          placeholder="Người chi"
          className={inputClass}
        />
      </div>

      {/* GHI CHÚ */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={row.note || ""}
          onChange={(e) => updateRow(index, "note", e.target.value)}
          placeholder="Ghi chú..."
          className={inputClass}
        />
      </div>

      {/* XOÁ */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => removeRow(index)}
          className="
            flex items-center justify-center
            w-10 h-10
            rounded-xl
            bg-red-50
            text-red-500
            hover:bg-red-500
            hover:text-white
            transition-all
          "
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
