// components/expense/RevenueExpenseRow.tsx

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import { formatDecimal, roundDecimal } from "@/utils/decimal";
import DecimalInput from "@/components/DecimalInput";
import { getPolicyTeacherUnitPrice } from "../../utils/policyOtherCosts";
import CashAccountSelect from "./CashAccountSelect";

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
  updateRow: (index: number, field: string, value: string | number) => void;
  removeRow: (index: number) => void;
  /** Kỳ đã "Kết thúc" → chỉ còn Ngày chi + Nguồn chi sửa được. */
  finalized?: boolean;
  /** Kỳ từ 11/2026: Giáo viên trường tách sang bảng riêng dưới Chi Ngoài. */
  teacherSplit?: boolean;
};

export default function RevenueExpenseRow({
  row,
  index,
  subjects,
  inputData,
  updateInputRow,
  updateRow,
  removeRow,
  finalized = false,
  teacherSplit = false,
}: Props) {
  const students = Number(inputData.studentCount || 0);
  const months = Number(inputData.monthsCount || 0);

  const policyData = subjects?.policies?.[0]?.data || {};
  const teacherUnitPrice = teacherSplit
    ? 0
    : getPolicyTeacherUnitPrice(policyData);
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
  const invoiceLocked = !!inputData.invoiceLocked;
  const locked = invoiceLocked || finalized;
  // Kỳ đã kết thúc: server chỉ ghi Ngày chi + Nguồn chi lên dòng đã lưu.
  const dateSourceLocked = finalized && !row?.id;
  // Đã chi do Đề xuất Chi Trường ghi vào khi kinh doanh xác nhận chi: Ngày chi,
  // Nguồn chi, Đã chi lấy từ đề xuất và khoá; Người chi / Ghi chú vẫn sửa được.
  const suggestCodes: string | undefined = row?.suggestCodes || undefined;
  const suggestTitle = suggestCodes
    ? `Lấy từ đề xuất chi ${suggestCodes} — không sửa tay được`
    : undefined;

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
    disabled:bg-slate-100
    disabled:text-slate-400
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
    disabled:bg-slate-100
    disabled:text-slate-400
  `;

  return (
    <div
      className={`
        grid
        grid-cols-[200px_120px_90px_120px_140px_150px_160px_140px_120px_140px_150px_160px_180px_230px_150px_150px_160px_180px_70px]
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
          maxLength={500}
          disabled={locked}
          onChange={(e) =>
            updateInputRow(index, "content", e.target.value.slice(0, 500))
          }
          placeholder="Nhập nội dung..."
          className={`${inputClass}`}
        />
      </div>

      {/* SỐ TIẾT */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-slate-700">
        <DecimalInput
          value={Number(inputData.totalPeriods) || ""}
          disabled={locked}
          commitOnBlur
          onValueChange={(value) =>
            updateInputRow(index, "totalPeriods", value)
          }
          className={`${metricInputClass} text-slate-700`}
        />
      </div>

      {/* SỐ HS */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-sky-700">
        <DecimalInput
          value={Number(inputData.studentCount) || ""}
          disabled={locked}
          commitOnBlur
          onValueChange={(value) =>
            updateInputRow(index, "studentCount", value)
          }
          className={`${metricInputClass} text-sky-700`}
        />
      </div>

      {/* SỐ THÁNG — tối đa 4 chữ số thập phân, khớp numeric(15,4) ở DB */}
      <div className="flex text-center items-center justify-center border-r border-slate-200 px-2 py-2 font-semibold text-indigo-700">
        <DecimalInput
          value={Number(inputData.monthsCount) || ""}
          disabled={locked}
          commitOnBlur
          fractionDigits={4}
          onValueChange={(value) =>
            updateInputRow(index, "monthsCount", roundDecimal(value, 4))
          }
          className={`${metricInputClass} text-indigo-700`}
        />
      </div>
      {/* ĐƠN GIÁ CSVC */}
      <div className="p-2 border-r border-slate-200">
        <DecimalInput
          value={csvcUnitPrice}
          disabled={locked}
          onValueChange={(value) =>
            updateRow(index, "csvcUnitPrice", value)
          }
          placeholder="0"
          fractionDigits={2}
          commitOnBlur
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
      {/* ĐƠN GIÁ GIÁO VIÊN — lấy từ Thông tin cơ sở vật chất */}
      <div
        className="p-2 border-r border-slate-200"
        title={teacherSplit ? "Từ kỳ 11/2026 nhập ở bảng Giáo viên trường (dưới Chi Ngoài)" : undefined}
      >
        <DecimalInput
          value={teacherUnitPrice}
          disabled
          onValueChange={() => undefined}
          fractionDigits={2}
          commitOnBlur
          className={`${metricInputClass} text-amber-700`}
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
        <DecimalInput
          value={taxUnitPrice}
          disabled={locked}
          onValueChange={(value) =>
            updateRow(index, "taxUnitPrice", value)
          }
          placeholder="0"
          fractionDigits={2}
          commitOnBlur
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
          value={formatDecimal(calculations.totalSchoolExpense) || ""}
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

      {/* HÌNH THỨC CHI */}
      <div className="p-2 border-r border-slate-200">
        <select
          value={row.paymentType || ""}
          disabled={locked}
          onChange={(e) => updateRow(index, "paymentType", e.target.value)}
          className={inputClass}
        >
          <option value="">-- Chọn --</option>
          <option value="in_contract">Có trong HĐ</option>
          <option value="not_in_contract">Không có trong HĐ</option>
        </select>
      </div>

      {/* NGÀY CHI — kỳ đã kết thúc vẫn sửa được (cùng Nguồn chi) */}
      <div className="p-2 border-r border-slate-200" title={suggestTitle}>
        <input
          type="date"
          value={row.paymentDate || ""}
          disabled={invoiceLocked || dateSourceLocked || !!suggestCodes}
          onChange={(e) => updateRow(index, "paymentDate", e.target.value)}
          className={inputClass}
        />
      </div>

      {/* NGUỒN CHI — tài khoản tiền đã chi (báo cáo thu chi) */}
      <div className="p-2 border-r border-slate-200" title={suggestTitle}>
        <CashAccountSelect
          value={row.cashAccount}
          disabled={dateSourceLocked || !!suggestCodes}
          onChange={(value) => updateRow(index, "cashAccount", value)}
          className={inputClass}
        />
      </div>

      {/* ĐÃ CHI */}
      <div className="p-2 border-r border-slate-200" title={suggestTitle}>
        <DecimalInput
          value={paidAmount}
          disabled={finalized || !!suggestCodes}
          onValueChange={(value) => {
            updateRow(index, "paidAmount", value);
          }}
          placeholder="0"
          allowDecimal={false}
          commitOnBlur
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
        {suggestCodes && (
          <div className="mt-1 truncate text-center text-[11px] font-medium text-emerald-700">
            Theo {suggestCodes}
          </div>
        )}
      </div>

      {/* CÒN LẠI */}
      <div className="p-2 border-r border-slate-200">
        <input
          readOnly
          value={formatDecimal(remainingSchoolExpense) || ""}
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
          disabled={locked}
          onChange={(e) => updateRow(index, "payer", e.target.value)}
          placeholder="Người chi"
          className={inputClass}
        />
      </div>

      {/* GHI CHÚ */}
      <div className="p-2 border-r border-slate-200">
        <input
          value={row.note || ""}
          disabled={locked}
          onChange={(e) => updateRow(index, "note", e.target.value)}
          placeholder="Ghi chú..."
          className={inputClass}
        />
      </div>

      {/* XOÁ */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => removeRow(index)}
          disabled={finalized || !!suggestCodes}
          title={suggestCodes ? `Đã chi theo đề xuất ${suggestCodes} — không xoá được` : undefined}
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
