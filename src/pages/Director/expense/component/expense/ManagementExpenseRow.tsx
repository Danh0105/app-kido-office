// components/expense/ManagementExpenseRow.tsx

import { Trash2 } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import { formatDecimal } from "@/utils/decimal";
import DecimalInput from "@/components/DecimalInput";

type Props = {
  row: any;
  subjects: any;
  index: number;

  inputData: InputExpenseRow;

  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => void;
  updateRow: (index: number, field: string, value: string | number) => void;
  removeRow: (index: number) => void;
};

export default function ManagementExpenseRow({
  row,
  subjects,
  index,
  inputData,
  updateInputRow,
  updateRow,
  removeRow,
}: Props) {
  const students = Number(inputData.studentCount || 0);
  const months = Number(inputData.monthsCount || 0);
  console.log("subject data", subjects);

  const policyQl1 = Number(
    subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Percent || 0,
  );

  const policyQl2 = Number(
    subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Percent || 0,
  );

  const ql1Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Tax || 0);

  const ql2Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Tax || 0);

  const ql1UnitPrice = Number(row.ql1UnitPrice ?? policyQl1 - ql1Tax);
  const ql2UnitPrice = Number(row.ql2UnitPrice ?? policyQl2 - ql2Tax);

  const totalQL1Expense = ql1UnitPrice * students * months;

  const totalQL2Expense = ql2UnitPrice * students * months;

  const totalOutsideExpense = totalQL1Expense + totalQL2Expense;
  const paidAmount = Number(row.paidAmount || 0);
  const remainingOutsideExpense = totalOutsideExpense - paidAmount;

  const metricInputClass = `
    w-full
    h-11
    rounded-lg
    border
    border-slate-200
    bg-white
    text-center
    text-sm
    font-semibold
    outline-none
    transition-all
    focus:border-emerald-500
    focus:ring-2
    focus:ring-emerald-100
  `;

  return (
    <div
      className="
        grid
        grid-cols-[200px_120px_120px_120px_120px_120px_180px_180px_180px_140px_140px_140px_160px_200px_70px]
        border-b border-slate-100
        hover:bg-slate-50
      "
    >
      {/* Nội dung */}
      <div className="flex items-center p-3">
        <input
          value={inputData.content || ""}
          maxLength={500}
          onChange={(e) =>
            updateInputRow(index, "content", e.target.value.slice(0, 500))
          }
          placeholder="Nhập nội dung..."
          className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Số tiết */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={inputData.totalPeriods ?? ""}
          onChange={(e) =>
            updateInputRow(index, "totalPeriods", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-slate-700`}
        />
      </div>

      {/* Số HS */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={inputData.studentCount ?? ""}
          onChange={(e) =>
            updateInputRow(index, "studentCount", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-sky-700`}
        />
      </div>

      {/* Số tháng */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={inputData.monthsCount ?? ""}
          onChange={(e) =>
            updateInputRow(index, "monthsCount", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-indigo-700`}
        />
      </div>
      {/* Đơn giá  QL1 */}
      <div className="p-2">
        <DecimalInput
          value={ql1UnitPrice}
          onValueChange={(value) =>
            updateRow(index, "ql1UnitPrice", value)
          }
          className={`${metricInputClass} text-emerald-700`}
        />
      </div>
      {/* Chi QL1 */}
      <div className="p-2">
        <div
          className="
            h-11
            rounded-xl
            border border-emerald-100
            bg-emerald-50
            px-3
            text-center
            flex items-center
            font-bold
            text-emerald-700
            flex items-center justify-center
          "
        >
          {totalQL1Expense.toLocaleString("vi-VN")}
        </div>
      </div>
      {/* Đơn giá  QL2 */}
      <div className="p-2">
        <DecimalInput
          value={ql2UnitPrice}
          onValueChange={(value) =>
            updateRow(index, "ql2UnitPrice", value)
          }
          className={`${metricInputClass} text-cyan-700`}
        />
      </div>
      {/* Chi QL2 */}
      <div className="p-2">
        <div
          className="
            h-11
            rounded-xl
            border border-cyan-100
            bg-cyan-50
            px-3
            flex items-center
            font-bold
            text-cyan-700
            text-center
            flex items-center justify-center
          "
        >
          {totalQL2Expense.toLocaleString("vi-VN")}
        </div>
      </div>

      {/* Chi ngoài */}
      <div className="p-2">
        <div
          className="
            h-11
            rounded-xl
            border border-red-100
            bg-red-50
            px-3
            flex items-center
            font-bold
            text-red-700
            text-center
            flex items-center justify-center
          "
        >
          {totalOutsideExpense.toLocaleString("vi-VN")}
        </div>
      </div>

      {/* PAYMENT DATE */}
      <div className="p-2 border-r border-slate-100">
        <input
          type="date"
          value={row.paymentDate || ""}
          onChange={(e) => updateRow(index, "paymentDate", e.target.value)}
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
            text-center

          "
        />
      </div>

      {/* PAID */}
      <div className="p-2 border-r border-slate-100">
        <DecimalInput
          value={paidAmount}
          onValueChange={(value) => {
            updateRow(index, "paidAmount", value);
          }}
          placeholder="0"
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm font-semibold
            text-orange-500
            text-center

          "
        />
      </div>

      {/* REMAINING */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={formatDecimal(remainingOutsideExpense) || ''}
          readOnly
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            bg-slate-50
            px-3 text-sm font-bold
            text-purple-600
            text-center
          "
        />
      </div>

      {/* PAYER */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={row.payer || ""}
          onChange={(e) => updateRow(index, "payer", e.target.value)}
          placeholder="Người chi"
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
          "
        />
      </div>

      {/* NOTE */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={row.note || ""}
          onChange={(e) => updateRow(index, "note", e.target.value)}
          placeholder="Ghi chú..."
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
          "
        />
      </div>
      <div className="flex items-center justify-center">
        <button
          onClick={() => removeRow(index)}
          className="
      flex items-center justify-center
      w-9 h-9
      rounded-lg
      text-red-500
      hover:bg-red-50
      hover:text-red-600
      transition-colors
    "
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
