import { Pencil, Trash2 } from "lucide-react";
import { PolicyMonthlyInput, PolicySubject } from "../types";
import {
  calculatePolicyRow,
  formatCurrency,
  formatMonth,
  getSchoolYearFromMonth,
} from "../utils";
import MoneyInput from "./MoneyInput";
import NumberInput from "./NumberInput";

type PolicyMonthlyRowProps = {
  row: PolicyMonthlyInput;
  subject: PolicySubject;
  disabled?: boolean;
  databaseFieldsReadonly?: boolean;
  onChange: (row: PolicyMonthlyInput) => void;
  onEdit: (row: PolicyMonthlyInput) => void;
  onDelete: (rowId: number) => void;
};

const moneyClassName = (value: number, accent = "") =>
  `whitespace-nowrap text-right text-xs font-bold ${
    value < 0 ? "text-rose-600" : accent || "text-slate-700"
  }`;

export default function PolicyMonthlyRow({
  row,
  subject,
  disabled = false,
  databaseFieldsReadonly = false,
  onChange,
  onEdit,
  onDelete,
}: PolicyMonthlyRowProps) {
  const calculated = calculatePolicyRow(row, subject);
  const setField = <K extends keyof PolicyMonthlyInput>(
    field: K,
    value: PolicyMonthlyInput[K],
  ) => onChange({ ...row, [field]: value });

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/80">
      <td className="sticky left-0 z-10 min-w-[150px] bg-white px-3 py-2.5 text-sm font-black text-slate-800">
        {subject.name}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold text-slate-600">
        {getSchoolYearFromMonth(row.month) || "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold text-slate-600">
        {formatMonth(row.month)}
      </td>
      <td className="bg-slate-50/70 px-2 py-2.5">
        <NumberInput
          ariaLabel="Số lượng học sinh"
          value={row.studentCount}
          disabled={disabled || databaseFieldsReadonly}
          onChange={(value) => setField("studentCount", value)}
        />
      </td>
      <td className="bg-slate-50/70 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Đơn giá"
          value={row.unitPrice}
          disabled={disabled}
          onChange={(value) => setField("unitPrice", value)}
        />
      </td>
      <td className="bg-slate-50/70 px-2 py-2.5">
        <NumberInput
          ariaLabel="Số tháng thu"
          value={row.monthsCount}
          min={1}
          max={12}
          disabled={disabled}
          onChange={(value) => setField("monthsCount", value)}
        />
      </td>

      <td className={`bg-emerald-50/60 px-3 py-2.5 ${moneyClassName(calculated.schoolRevenue, "text-emerald-700")}`}>
        {formatCurrency(calculated.schoolRevenue)}
      </td>
      <td className={`bg-emerald-50/60 px-3 py-2.5 ${moneyClassName(calculated.tkdAmount)}`}>
        {formatCurrency(calculated.tkdAmount)}
      </td>
      <td className={`bg-blue-50/60 px-3 py-2.5 ${moneyClassName(calculated.schoolRetainAmount, "text-blue-700")}`}>
        {formatCurrency(calculated.schoolRetainAmount)}
      </td>
      <td className={`bg-violet-50/60 px-3 py-2.5 ${moneyClassName(calculated.companyPaymentAmount, "text-violet-700")}`}>
        {formatCurrency(calculated.companyPaymentAmount)}
      </td>

      <td className="bg-orange-50/50 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Chi hiệu trưởng"
          value={row.principalPolicyAmount}
          disabled={disabled}
          onChange={(value) => setField("principalPolicyAmount", value)}
        />
      </td>
      <td className="bg-orange-50/50 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Chi tiền mặt"
          value={row.cashPolicyAmount}
          disabled={disabled}
          onChange={(value) => setField("cashPolicyAmount", value)}
        />
      </td>
      <td className="bg-orange-50/50 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Chi thiết bị"
          value={row.equipmentPolicyAmount}
          disabled={disabled}
          onChange={(value) => setField("equipmentPolicyAmount", value)}
        />
      </td>
      <td className={`bg-orange-50/80 px-3 py-2.5 ${moneyClassName(calculated.totalInitialPolicyAmount, "text-orange-700")}`}>
        {formatCurrency(calculated.totalInitialPolicyAmount)}
      </td>

      <td className={`bg-amber-50/60 px-3 py-2.5 ${moneyClassName(calculated.calculatedPolicyAmount)}`}>
        {formatCurrency(Math.round(calculated.calculatedPolicyAmount))}
      </td>
      <td className={`bg-amber-50/60 px-3 py-2.5 ${moneyClassName(calculated.policyAfterTaxAmount, "text-amber-700")}`}>
        {formatCurrency(Math.round(calculated.policyAfterTaxAmount))}
      </td>

      <td className="bg-rose-50/40 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Đã chi tiền mặt"
          value={row.paidCashAmount}
          disabled={disabled}
          onChange={(value) => setField("paidCashAmount", value)}
        />
      </td>
      <td className="bg-rose-50/40 px-2 py-2.5">
        <MoneyInput
          ariaLabel="Đã chi thiết bị"
          value={row.paidEquipmentAmount}
          disabled={disabled}
          onChange={(value) => setField("paidEquipmentAmount", value)}
        />
      </td>
      <td className={`bg-rose-50/60 px-3 py-2.5 ${moneyClassName(calculated.totalPaidAmount)}`}>
        {formatCurrency(calculated.totalPaidAmount)}
      </td>
      <td className="bg-rose-50/60 px-3 py-2.5 text-right">
        {calculated.remainingAmount === 0 ? (
          <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
            Đã chi đủ
          </span>
        ) : (
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${
              calculated.remainingAmount > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {formatCurrency(Math.round(calculated.remainingAmount))}
          </span>
        )}
      </td>

      <td className="min-w-[180px] px-2 py-2.5">
        <input
          aria-label="Ghi chú"
          value={row.note}
          disabled={disabled}
          onChange={(event) => setField("note", event.target.value)}
          placeholder="Nhập ghi chú..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        />
      </td>
      <td className="sticky right-0 z-10 bg-white px-2 py-2.5">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-40"
            aria-label="Sửa dòng"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(row.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            aria-label="Xóa dòng"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
