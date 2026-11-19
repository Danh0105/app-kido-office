// components/expense/ManagementExpenseRow.tsx

import { Trash2 } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import CashAccountSelect from "./CashAccountSelect";
import SuggestSourcesNote from "./SuggestSourcesNote";
import {
  calculateOtherCostExpense,
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  type PolicyOtherCost,
} from "../../utils/policyOtherCosts";
import type { ManagementRowInput } from "../../utils/managementRows";
import { formatDecimal, roundDecimal } from "@/utils/decimal";
import { calculateRevenueQuantity } from "@/utils/revenueAmount";
import DecimalInput from "@/components/DecimalInput";
import { toast } from "react-hot-toast";

type Props = {
  row: any;
  subjects: any;
  index: number;

  inputData: ManagementRowInput;
  /** Dòng thêm riêng cho Chi Ngoài — số lượng lưu trên chính dòng, không dùng chung Doanh Thu. */
  standalone?: boolean;
  otherCosts: PolicyOtherCost[];
  gridTemplateColumns: string;

  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any
  ) => void;
  updateRow: (index: number, field: string, value: any) => void;
  removeRow: (index: number) => void;
  /** false → ẩn cột thao tác (xoá dòng), dùng cho sales admin. */
  showActions?: boolean;
  /** Khoá hẳn (sales admin sau khi xác nhận). */
  readOnly?: boolean;
  /** Đã "Xác nhận đúng BBCS" → khoá phần chính sách (Nội dung → Chi ngoài), cột chi vẫn sửa được. */
  policyLocked?: boolean;
  /** Cột chi chỉ sửa được khi dòng đã lưu (server bỏ qua dòng mới của kế toán khi đã khoá). */
  savedRowsOnly?: boolean;
  /** Chỉ còn sửa Ngày chi + Nguồn chi (trợ lý GĐ / giám đốc khi đã khoá, kỳ đã kết thúc). */
  dateSourceOnly?: boolean;
  /** Đã chi tối đa của dòng này để tổng Còn chi không âm. */
  paidMax?: number;
};

export default function ManagementExpenseRow({
  row,
  subjects,
  index,
  inputData,
  standalone = false,
  otherCosts,
  gridTemplateColumns,
  updateInputRow,
  updateRow,
  removeRow,
  showActions = true,
  readOnly = false,
  policyLocked = false,
  savedRowsOnly = false,
  dateSourceOnly = false,
  paidMax,
}: Props) {
  // Có Số HS thì tính theo HS, không thì theo Số tiết (× Số tháng) — khớp backend.
  const quantity = calculateRevenueQuantity(inputData);
  // Nội dung / Số tiết / Số HS / Số tháng dùng chung với Doanh Thu, Chi Trường,
  // Hóa Đơn — đã xuất hóa đơn thì khoá để các bảng trên không bị đổi số.
  const sharedLocked = readOnly || policyLocked || !!inputData.invoiceLocked;
  const updateShared = (
    field: "totalPeriods" | "studentCount" | "monthsCount",
    value: number
  ) =>
    standalone ? updateRow(index, field, value) : updateInputRow(index, field, value);
  const policyReadOnly = readOnly || policyLocked;
  // Dòng vừa thêm khi bảng đã khoá: nhập được cột chi, xoá được khi chưa lưu.
  const addedWhileLocked = !!row?.addedWhileLocked;
  // Nội dung của dòng thêm riêng lưu trên chính dòng: bảng đã khoá vẫn sửa được,
  // trừ người chỉ còn Ngày chi + Nguồn chi (kể cả mọi người khi kỳ đã "Kết thúc").
  const contentLocked = standalone ? readOnly || dateSourceOnly : sharedLocked;
  // Ngày chi, Nguồn chi.
  const paymentReadOnly =
    readOnly || (savedRowsOnly && !row?.id && !addedWhileLocked);
  // Đã chi, Người chi, Ghi chú.
  const paidReadOnly = paymentReadOnly || dateSourceOnly;
  // Đã chi do đề xuất chi tháng ghi vào khi kinh doanh xác nhận chi: Ngày chi,
  // Nguồn chi, Đã chi lấy từ đề xuất và khoá; Người chi / Ghi chú vẫn sửa được.
  const suggestCodes: string | undefined = row?.suggestCodes || undefined;
  const suggestTitle = suggestCodes
    ? `Lấy từ đề xuất chi ${suggestCodes} — không sửa tay được`
    : undefined;
  const policyQl1 = Number(
    subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Percent || 0
  );

  const policyQl2 = Number(
    subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Percent || 0
  );

  const ql1Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Tax || 0);

  const ql2Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Tax || 0);

  const ql1UnitPrice = Number(row.ql1UnitPrice ?? policyQl1);
  const ql2UnitPrice = Number(row.ql2UnitPrice ?? policyQl2);
  const rowQl1Tax = Number(row.ql1Tax ?? ql1Tax);
  const rowQl2Tax = Number(row.ql2Tax ?? ql2Tax);

  const totalQL1Expense =
    Math.max(0, ql1UnitPrice - rowQl1Tax) * quantity;

  const totalQL2Expense =
    Math.max(0, ql2UnitPrice - rowQl2Tax) * quantity;

  const otherCostValues = otherCosts.map((item, otherCostIndex) => {
    const key = getOtherCostKey(item, otherCostIndex);
    const unitPrice = Number(
      row.otherCostUnitPrices?.[key] ?? getOtherCostGrossPrice(item)
    );
    const tax = Number(row.otherCostTaxes?.[key] ?? getOtherCostTax(item));

    return {
      unitPrice,
      tax,
      expense: calculateOtherCostExpense(unitPrice, tax, quantity),
    };
  });
  const totalOtherCostExpense = otherCostValues.reduce(
    (total, item) => total + item.expense,
    0
  );
  const totalOutsideExpense =
    totalQL1Expense + totalQL2Expense + totalOtherCostExpense;
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
        border-b border-slate-100
        hover:bg-slate-50
      "
      style={{ gridTemplateColumns }}
    >
      {/* Nội dung */}
      <div className="flex items-center p-3">
        <input
          value={inputData.content || ""}
          maxLength={500}
          disabled={contentLocked}
          onChange={(e) => {
            const content = e.target.value.slice(0, 500);
            if (standalone) updateRow(index, "content", content);
            else updateInputRow(index, "content", content);
          }}
          placeholder="Nhập nội dung..."
          className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      {/* Số tiết */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <DecimalInput
          value={Number(inputData.totalPeriods) || ""}
          disabled={sharedLocked}
          commitOnBlur
          onValueChange={(value) => updateShared("totalPeriods", value)}
          className={`${metricInputClass} text-slate-700 disabled:bg-slate-100 disabled:text-slate-400`}
        />
      </div>

      {/* Số HS */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <DecimalInput
          value={Number(inputData.studentCount) || ""}
          disabled={sharedLocked}
          commitOnBlur
          onValueChange={(value) => updateShared("studentCount", value)}
          className={`${metricInputClass} text-sky-700 disabled:bg-slate-100 disabled:text-slate-400`}
        />
      </div>

      {/* Số tháng — tối đa 4 chữ số thập phân, khớp numeric(15,4) ở DB */}
      <div className="flex items-center justify-center p-3 text-center flex items-center">
        <DecimalInput
          value={Number(inputData.monthsCount) || ""}
          disabled={sharedLocked}
          commitOnBlur
          fractionDigits={4}
          onValueChange={(value) =>
            updateShared("monthsCount", roundDecimal(value, 4))
          }
          className={`${metricInputClass} text-indigo-700 disabled:bg-slate-100 disabled:text-slate-400`}
        />
      </div>
      {/* Đơn giá  QL1 */}
      <div className="p-2">
        <DecimalInput
          value={ql1UnitPrice}
          disabled={policyReadOnly}
          onValueChange={(value) => updateRow(index, "ql1UnitPrice", value)}
          fractionDigits={2}
          commitOnBlur
          className={`${metricInputClass} text-emerald-700`}
        />
      </div>
      {/* Thuế QL1 */}
      <div className="p-2">
        <DecimalInput
          value={rowQl1Tax}
          disabled={policyReadOnly}
          onValueChange={(value) => updateRow(index, "ql1Tax", value)}
          fractionDigits={2}
          commitOnBlur
          className={`${metricInputClass} text-rose-700`}
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
          disabled={policyReadOnly}
          onValueChange={(value) => updateRow(index, "ql2UnitPrice", value)}
          fractionDigits={2}
          commitOnBlur
          className={`${metricInputClass} text-cyan-700`}
        />
      </div>
      {/* Thuế QL2 */}
      <div className="p-2">
        <DecimalInput
          value={rowQl2Tax}
          disabled={policyReadOnly}
          onValueChange={(value) => updateRow(index, "ql2Tax", value)}
          fractionDigits={2}
          commitOnBlur
          className={`${metricInputClass} text-rose-700`}
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

      {otherCosts.map((item, otherCostIndex) => {
        const key = getOtherCostKey(item, otherCostIndex);
        const values = otherCostValues[otherCostIndex];

        return [
          <div key={`${key}-unit`} className="p-2">
            <DecimalInput
              value={values.unitPrice}
              disabled={policyReadOnly}
              onValueChange={(value) =>
                updateRow(index, "otherCostUnitPrices", {
                  ...(row.otherCostUnitPrices || {}),
                  [key]: value,
                })
              }
              fractionDigits={2}
              commitOnBlur
              className={`${metricInputClass} text-fuchsia-700`}
            />
          </div>,
          <div key={`${key}-tax`} className="p-2">
            <DecimalInput
              value={values.tax}
              disabled={policyReadOnly}
              onValueChange={(value) =>
                updateRow(index, "otherCostTaxes", {
                  ...(row.otherCostTaxes || {}),
                  [key]: value,
                })
              }
              fractionDigits={2}
              commitOnBlur
              className={`${metricInputClass} text-rose-700`}
            />
          </div>,
          <div key={`${key}-expense`} className="p-2">
            <div className="flex h-11 items-center justify-center rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 text-center font-bold text-fuchsia-700">
              {values.expense.toLocaleString("vi-VN")}
            </div>
          </div>,
        ];
      })}

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
          disabled={paymentReadOnly || !!suggestCodes}
          title={suggestTitle}
          onChange={(e) => updateRow(index, "paymentDate", e.target.value)}
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
            text-center
            disabled:bg-slate-100 disabled:text-slate-400
          "
        />
      </div>

      {/* PAYMENT SOURCE — Nguồn chi */}
      <div className="p-2 border-r border-slate-100" title={suggestTitle}>
        <CashAccountSelect
          value={row.cashAccount}
          disabled={paymentReadOnly || !!suggestCodes}
          onChange={(value) => updateRow(index, "cashAccount", value)}
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            bg-white px-2 text-sm
            disabled:bg-slate-100 disabled:text-slate-400
          "
        />
        <SuggestSourcesNote sources={row?.suggestSources} />
      </div>

      {/* PAID */}
      <div className="p-2 border-r border-slate-100" title={suggestTitle}>
        <DecimalInput
          value={paidAmount}
          disabled={paidReadOnly || !!suggestCodes}
          max={paidMax}
          onOverMax={(max) =>
            toast.error(
              `Đã chi không được vượt tổng Còn chi (tối đa ${formatDecimal(max)})`,
              { id: "management-paid-limit" },
            )
          }
          onValueChange={(value) => {
            updateRow(index, "paidAmount", value);
          }}
          placeholder="0"
          allowDecimal={false}
          commitOnBlur
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm font-semibold
            text-orange-500
            text-center
            disabled:bg-slate-100
          "
        />
        {suggestCodes && (
          <div className="mt-1 truncate text-center text-[11px] font-medium text-emerald-700">
            Theo {suggestCodes}
          </div>
        )}
      </div>

      {/* REMAINING */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={formatDecimal(remainingOutsideExpense) || ""}
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
          disabled={paidReadOnly}
          onChange={(e) => updateRow(index, "payer", e.target.value)}
          placeholder="Người chi"
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
            disabled:bg-slate-100 disabled:text-slate-400
          "
        />
      </div>

      {/* NOTE */}
      <div className="p-2 border-r border-slate-100">
        <input
          value={row.note || ""}
          disabled={paidReadOnly}
          onChange={(e) => updateRow(index, "note", e.target.value)}
          placeholder="Ghi chú..."
          className="
            w-full h-11 rounded-lg
            border border-slate-200
            px-3 text-sm
            disabled:bg-slate-100 disabled:text-slate-400
          "
        />
      </div>
      {showActions && (
        <div className="flex items-center justify-center gap-1">
          {(!policyReadOnly || addedWhileLocked) && !suggestCodes && (
            <button
              onClick={() => removeRow(index)}
              title="Xoá dòng"
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
          )}
        </div>
      )}
    </div>
  );
}
