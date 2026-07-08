import { Pencil, Trash2 } from "lucide-react";
import { PolicyMonthlyInput, PolicySubject } from "../types";
import {
  calculatePolicyRow,
  formatCurrency,
  formatMonth,
  getSchoolYearFromMonth,
} from "../utils";
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
      <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-sm font-black text-slate-800">
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
        <NumberInput
          ariaLabel="Số tháng thu"
          value={row.monthsCount}
          min={1}
          max={12}
          disabled={disabled}
          onChange={(value) => setField("monthsCount", value)}
        />
      </td>
      <td
        className={`bg-amber-50/60 px-3 py-2.5 ${moneyClassName(
          calculated.calculatedPolicyAmount,
        )}`}
      >
        {formatCurrency(Math.round(calculated.calculatedPolicyAmount))}
      </td>
      <td
        className={`bg-amber-50/60 px-3 py-2.5 ${moneyClassName(
          calculated.policyAfterTaxAmount,
          "text-amber-700",
        )}`}
      >
        {formatCurrency(Math.round(calculated.policyAfterTaxAmount))}
      </td>

      <td className="px-2 py-2.5">
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
