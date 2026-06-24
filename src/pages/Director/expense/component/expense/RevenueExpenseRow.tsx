// components/expense/RevenueExpenseRow.tsx

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  row: any;
  index: number;
  subjects: any;
  inputData: InputExpenseRow;

  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => void;
  updateRow: (index: number, field: string, value: string) => void;
  removeRow: (index: number) => void;
};

export default function RevenueExpenseRow({
  row,
  index,
  subjects,
  inputData,
  updateInputRow,
  updateRow,
  removeRow,
}: Props) {
  const students = Number(inputData.studentCount || 0);
  const months = Number(inputData.monthsCount || 0);

  const policyData = subjects?.policies?.[0]?.data || {};
  const teacherUnitPrice = Number(
    row.teacherUnitPrice ?? row.giaovien ?? policyData?.giaovien ?? 0,
  );
  const taxUnitPrice = Number(
    row.taxUnitPrice ??
      row.thue ??
      row.tax ??
      policyData?.thue ??
      policyData?.tax ??
      0,
  );
  const csvcUnitPrice = Number(
    row.csvcUnitPrice ?? row.csvc ?? policyData?.csvc ?? 0,
  );

  const unitPrice = Number(inputData.unitPrice || policyData?.fee || 0);

  const calculations = useMemo(() => {
    const invoiceAmount = students * months * unitPrice;
    const teacherAmount = students * months * teacherUnitPrice;
    const csvcAmount = csvcUnitPrice * months * students;
    const taxAmount = students * months * taxUnitPrice;

    const totalSchoolExpense = teacherAmount + csvcAmount + taxAmount;

    return {
      invoiceAmount,
      teacherAmount,
      csvcAmount,
      taxAmount,
      totalSchoolExpense,
    };
  }, [
    students,
    months,
    unitPrice,
    teacherUnitPrice,
    csvcUnitPrice,
    taxUnitPrice,
  ]);
  const paidAmount = Number(row.paidAmount || 0);
  const remainingSchoolExpense = calculations.totalSchoolExpense - paidAmount;

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

  const metricInputClass = `
    w-full
    h-10
    rounded-lg
    border
    border-slate-200
    bg-white
    text-center
    text-sm
    font-semibold
    outline-none
    transition-all
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
  `;

  const formatVND = (value?: number | string | null) => {
    const num = Number(value || 0);
    if (!num) return "";
    return num.toLocaleString("vi-VN", { maximumFractionDigits: 10 });
  };

  const parseVND = (value: string) => {
    const cleaned = value.replace(/[^\d,.]/g, "");
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return normalized;
  };

  return (
    <div
      className={`
        grid
        grid-cols-[200px_120px_90px_120px_140px_150px_160px_140px_120px_140px_150px_180px_150px_150px_160px_180px_70px]
        border-b
        hover:bg-blue-50/40
        transition-all
        ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
      `}
    >
      {/* NỘI DUNG */}
      <div className="flex items-center border-r border-slate-200 px-2 py-2">
        <input
          value={inputData.content || ""}
          onChange={(e) => updateInputRow(index, "content", e.target.value)}
          placeholder="Nhập nội dung..."
          className={`${inputClass}`}
        />
      </div>

      {/* SỐ TIẾT */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-slate-700">
        <input
          type="number"
          value={inputData.totalPeriods || ""}
          onChange={(e) =>
            updateInputRow(index, "totalPeriods", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-slate-700`}
        />
      </div>

      {/* SỐ HS */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-sky-700">
        <input
          type="number"
          value={inputData.studentCount || ""}
          onChange={(e) =>
            updateInputRow(index, "studentCount", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-sky-700`}
        />
      </div>

      {/* SỐ THÁNG */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-indigo-700">
        <input
          type="number"
          value={inputData.monthsCount || ""}
          onChange={(e) =>
            updateInputRow(index, "monthsCount", Number(e.target.value || 0))
          }
          className={`${metricInputClass} text-indigo-700`}
        />
      </div>
      {/* ĐƠN GIÁ CSVC */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={formatVND(csvcUnitPrice) || ""}
          onChange={(e) =>
            updateRow(index, "csvcUnitPrice", parseVND(e.target.value))
          }
          placeholder="0"
          className={`${metricInputClass} text-emerald-700`}
        />
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
          {calculations.csvcAmount.toLocaleString("vi-VN")}
        </span>
      </div>
      {/* ĐƠN GIÁ GIÁO VIÊN (= đơn giá × tháng) */}
      <div className="p-2 border-r border-slate-200">
        <input
          readOnly
          value={formatVND(teacherUnitPrice) || ""}
          className={`${metricInputClass} text-amber-700 bg-amber-50 border-0`}
        />
      </div>

      {/* GIÁO VIÊN */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2">
        <span
          className="
            px-3 py-1
            rounded-full
            bg-amber-100
            text-purple-700
            font-bold
            text-sm
          "
        >
          {calculations.teacherAmount.toLocaleString("vi-VN")}
        </span>
      </div>

      {/* ĐƠN GIÁ THUẾ */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={formatVND(taxUnitPrice) || ""}
          onChange={(e) =>
            updateRow(index, "taxUnitPrice", parseVND(e.target.value))
          }
          placeholder="0"
          className={`${metricInputClass} text-rose-700`}
        />
      </div>

      {/* THUẾ */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2">
        <span
          className="
            px-3 py-1
            rounded-full
            bg-rose-100
            text-rose-700
            font-bold
            text-sm
          "
        >
          {calculations.taxAmount.toLocaleString("vi-VN")}
        </span>
      </div>

      {/* CHI TRƯỜNG */}
      <div className="p-2 border-r border-slate-200">
        <input
          readOnly
          value={formatVND(calculations.totalSchoolExpense) || ""}
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
          value={formatVND(paidAmount) || ""}
          onChange={(e) => {
            updateRow(index, "paidAmount", parseVND(e.target.value));
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
          value={formatVND(remainingSchoolExpense) || ""}
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
