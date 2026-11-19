// components/expense/SchoolTeacherTable.tsx
//
// Bảng "Giáo viên trường" nằm trong thẻ Chi Ngoài (từ kỳ 11/2026): lương trả
// thẳng cho giáo viên của trường, khấu trừ thuế TNCN. Dòng đi kèm dòng Doanh Thu
// cùng vị trí dùng chung Nội dung / Số tiết / Số HS / Số tháng; dòng thêm riêng
// tự nhập. Bên dưới là "Duyệt lương" (chỉ ghi người + thời điểm duyệt).

import { useState } from "react";
import { BadgeCheck, CalendarDays, Plus, Trash2, Users } from "lucide-react";

import DecimalInput from "@/components/DecimalInput";
import { formatDecimal } from "@/utils/decimal";
import type {
  SchoolTeacher,
  SchoolTeacherApproval,
} from "@/service/schoolExpense";
import CashAccountSelect from "./CashAccountSelect";
import OptionalAmountInput from "./OptionalAmountInput";
import SuggestSourcesNote from "./SuggestSourcesNote";
import SchoolTeacherFormModal from "../../components/SchoolTeacherPayroll/SchoolTeacherFormModal";
import type { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import type { SchoolTeacherRow } from "../../RealExpenseDetail/type/SchoolTeacherRow";
import {
  calculateSchoolTeacherAmount,
  calculateSchoolTeacherTax,
  SCHOOL_TEACHER_PIT_RATE,
  SCHOOL_TEACHER_PIT_THRESHOLD,
} from "../../utils/schoolTeacher";

const ADD_TEACHER = "__add__";

type Props = {
  rows: SchoolTeacherRow[];
  inputRows: InputExpenseRow[];
  /** Đơn giá "Giáo viên trường" của chính sách — mặc định cho dòng chưa nhập. */
  defaultUnitPrice: number;
  /** Trường của bảng thu chi — để thêm giáo viên mới. */
  schoolId: number | null;
  /** Danh sách giáo viên của trường để chọn. */
  teachers: SchoolTeacher[];
  /** Thù lao của giáo viên ở các môn khác cùng bảng thu chi (ngưỡng thuế). */
  otherSubjectGross: Record<number, number>;
  onTeacherSaved: (teacher: SchoolTeacher) => void;
  updateRow: (index: number, field: keyof SchoolTeacherRow, value: any) => void;
  addRow?: () => void;
  removeRow: (index: number) => void;
  /** Kỳ đã "Kết thúc": chỉ còn Ngày chi + Nguồn chi. */
  dateSourceOnly?: boolean;
  /** Đã "Xuất hóa đơn tất cả": khoá cả bảng (Duyệt lương vẫn bấm được). */
  locked?: boolean;
  approval: SchoolTeacherApproval | null;
  canApprove: boolean;
  approving: boolean;
  /** Bảng có thay đổi chưa lưu — duyệt theo số đã lưu nên phải lưu trước. */
  dirty: boolean;
  onApprove: () => void;
};

const COLUMNS = [
  "200px", // Nội dung
  "220px", // Giáo viên
  "110px", // Số tiết
  "110px", // Số HS
  "110px", // Số tháng
  "150px", // Đơn giá
  "150px", // Thành tiền
  "170px", // Thuế TNCN
  "160px", // Còn lại phải chi
  "170px", // Ngày chi
  "230px", // Nguồn chi
  "220px", // Ghi chú
  "90px", // Thao tác
];
const TABLE_MIN_WIDTH = 2090;

const inputClass = `
  w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm
  outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
  disabled:bg-slate-100 disabled:text-slate-500
`;
const metricInputClass = `${inputClass} text-center font-semibold`;
const readCellClass =
  "flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const isStandaloneSchoolTeacherRow = (
  index: number,
  inputRows: InputExpenseRow[],
) => index >= inputRows.length;

/** Số lượng + Nội dung của dòng: dòng đi kèm lấy từ dòng Doanh Thu cùng vị trí. */
export const schoolTeacherRowInput = (
  row: SchoolTeacherRow,
  index: number,
  inputRows: InputExpenseRow[],
) =>
  isStandaloneSchoolTeacherRow(index, inputRows)
    ? {
        content: row.content ?? "",
        totalPeriods: Number(row.totalPeriods ?? 0),
        studentCount: Number(row.studentCount ?? 0),
        monthsCount: Number(row.monthsCount ?? 1),
      }
    : {
        content: inputRows[index]?.content ?? "",
        totalPeriods: Number(inputRows[index]?.totalPeriods ?? 0),
        studentCount: Number(inputRows[index]?.studentCount ?? 0),
        monthsCount: Number(inputRows[index]?.monthsCount ?? 0),
      };

export default function SchoolTeacherTable({
  rows,
  inputRows,
  defaultUnitPrice,
  schoolId,
  teachers,
  otherSubjectGross,
  onTeacherSaved,
  updateRow,
  addRow,
  removeRow,
  dateSourceOnly = false,
  locked = false,
  approval,
  canApprove,
  approving,
  dirty,
  onApprove,
}: Props) {
  // Hộp thoại thêm giáo viên: nhớ dòng đang chọn để gán người vừa thêm.
  const [addingForRow, setAddingForRow] = useState<number | null>(null);
  const amounts = rows.map((row, index) => {
    const input = schoolTeacherRowInput(row, index, inputRows);
    return { input, ...calculateSchoolTeacherAmount(input, row.unitPrice ?? defaultUnitPrice) };
  });
  // Ô số tiền khoá khi kỳ kết thúc hoặc đã xuất hóa đơn tất cả.
  const moneyLocked = dateSourceOnly || locked;
  const taxes = calculateSchoolTeacherTax(
    amounts.map((item, index) => ({
      schoolTeacherId: rows[index].schoolTeacherId ?? null,
      amount: item.amount,
      // Chưa chọn giáo viên thì dòng không phát sinh tiền — bỏ thuế nhập tay.
      manualPit: rows[index].schoolTeacherId ? rows[index].pitAmount : null,
    })),
    otherSubjectGross,
  );
  const computed = rows.map((row, index) => ({
    ...amounts[index],
    ...taxes[index],
    standalone: isStandaloneSchoolTeacherRow(index, inputRows),
    paid: (!!row.expenseDate && !!row.cashAccount) || !!row.suggestCodes,
  }));
  const totals = computed.reduce(
    (sum, row) => ({
      amount: sum.amount + row.amount,
      pitAmount: sum.pitAmount + row.pitAmount,
      netAmount: sum.netAmount + row.netAmount,
      paidNet: sum.paidNet + (row.paid ? row.netAmount : 0),
    }),
    { amount: 0, pitAmount: 0, netAmount: 0, paidNet: 0 },
  );
  const gridTemplateColumns = COLUMNS.join(" ");
  const money = (value: number) => formatDecimal(value) || "0";

  return (
    <div className="border-t-4 border-amber-100">
      {/* TIÊU ĐỀ + SỐ LIỆU */}
      <div className="flex flex-wrap items-end justify-between gap-3 bg-amber-50 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-amber-900">
            <Users size={18} />
            Giáo viên trường
          </div>
          <div className="text-xs text-amber-800">
            Lương trả thẳng cho giáo viên của trường. Thuế TNCN tự tính{" "}
            {SCHOOL_TEACHER_PIT_RATE}% khi tổng thù lao tháng của giáo viên (mọi
            môn) từ {formatDecimal(SCHOOL_TEACHER_PIT_THRESHOLD)}đ — sửa tay được,
            xoá trống để về tự tính. Đủ Ngày chi + Nguồn chi là đã trả "Còn lại
            phải chi".
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4">
          {[
            ["Thành tiền", totals.amount, "text-slate-800"],
            ["Thuế TNCN", totals.pitAmount, "text-rose-600"],
            ["Còn lại phải chi", totals.netAmount, "text-purple-700"],
            ["Đã trả", totals.paidNet, "text-emerald-700"],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5">
              <div className="text-[11px] text-slate-500">{label}</div>
              <div className={`font-bold ${color}`}>{money(value as number)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${TABLE_MIN_WIDTH}px` }}>
          {/* HEADER */}
          <div
            className="grid bg-amber-900 text-sm font-semibold text-white"
            style={{ gridTemplateColumns }}
          >
            {[
              "📄 Nội dung",
              "👩‍🏫 Giáo viên",
              "🕒 Số tiết",
              "Số HS",
              "📅 Số tháng",
              "💸 Đơn giá",
              "💰 Thành tiền",
              "🧾 Thuế TNCN",
              "📊 Còn lại phải chi",
            ].map((label) => (
              <div key={label} className="border-r border-amber-800 p-3 text-center">
                {label}
              </div>
            ))}
            <div className="border-r border-amber-800 p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <CalendarDays size={14} />
                Ngày chi
              </div>
            </div>
            <div className="border-r border-amber-800 p-3 text-center">🏦 Nguồn chi</div>
            <div className="border-r border-amber-800 p-3 text-center">📝 Ghi chú</div>
            <div className="p-3 text-center">⚙️</div>
          </div>

          {/* BODY */}
          {rows.map((row, index) => {
            const item = computed[index];
            const sharedLocked = !item.standalone || moneyLocked;
            // Đã trả theo Đề xuất Chi GV trường: Ngày chi / Nguồn chi lấy từ đề xuất.
            const suggestTitle = row.suggestCodes
              ? `Lấy từ đề xuất chi ${row.suggestCodes} — không sửa tay được`
              : undefined;
            return (
              <div
                key={row.id ?? `new-${index}`}
                className="grid border-b border-slate-100 bg-white hover:bg-amber-50/40"
                style={{ gridTemplateColumns }}
              >
                <div className="border-r border-slate-100 p-2">
                  <input
                    value={item.input.content}
                    disabled={sharedLocked}
                    title={item.standalone ? undefined : "Theo dòng Doanh Thu cùng vị trí"}
                    onChange={(e) => updateRow(index, "content", e.target.value)}
                    placeholder={item.standalone ? "Nhập nội dung..." : "Theo Doanh Thu"}
                    className={inputClass}
                  />
                </div>
                <div className="border-r border-slate-100 p-2">
                  <select
                    value={row.schoolTeacherId ? String(row.schoolTeacherId) : ""}
                    disabled={moneyLocked}
                    onChange={(e) => {
                      if (e.target.value === ADD_TEACHER) {
                        setAddingForRow(index);
                        return;
                      }
                      updateRow(index, "schoolTeacherId", e.target.value ? Number(e.target.value) : null);
                    }}
                    className={`${inputClass} px-2 ${row.schoolTeacherId ? "" : "text-slate-400"}`}
                  >
                    <option value="">— Chọn giáo viên —</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                        {teacher.isActive ? "" : " (ngừng dùng)"}
                      </option>
                    ))}
                    {schoolId && <option value={ADD_TEACHER}>＋ Thêm giáo viên…</option>}
                  </select>
                </div>
                {(["totalPeriods", "studentCount", "monthsCount"] as const).map((field) => (
                  <div key={field} className="border-r border-slate-100 p-2">
                    <DecimalInput
                      value={item.input[field]}
                      disabled={sharedLocked}
                      onValueChange={(value) => updateRow(index, field, value)}
                      placeholder="0"
                      commitOnBlur
                      className={metricInputClass}
                    />
                  </div>
                ))}
                <div className="border-r border-slate-100 p-2">
                  <DecimalInput
                    value={row.unitPrice ?? defaultUnitPrice}
                    disabled={moneyLocked}
                    onValueChange={(value) => updateRow(index, "unitPrice", value)}
                    placeholder="0"
                    fractionDigits={2}
                    commitOnBlur
                    className={`${metricInputClass} text-amber-800`}
                  />
                </div>
                <div className="border-r border-slate-100 p-2">
                  <div className={`${readCellClass} text-slate-800`}>{money(item.amount)}</div>
                </div>
                <div
                  className="border-r border-slate-100 p-2"
                  title={
                    row.schoolTeacherId
                      ? `Tổng thù lao tháng của giáo viên (mọi môn): ${money(item.teacherGross)}đ — tự tính ${money(item.autoPit)}đ. Xoá trống để về tự tính.`
                      : "Chưa chọn giáo viên — xét riêng dòng này"
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        item.manual
                          ? "bg-amber-100 text-amber-700"
                          : item.pitRate
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {item.manual ? "Tay" : `${item.pitRate}%`}
                    </span>
                    <OptionalAmountInput
                      value={item.manual ? row.pitAmount : ""}
                      autoValue={item.autoPit}
                      disabled={moneyLocked || !row.schoolTeacherId || !!row.suggestCodes}
                      onChange={(value) => updateRow(index, "pitAmount", value)}
                      className={`${metricInputClass} text-rose-600 placeholder:text-rose-300`}
                    />
                  </div>
                </div>
                <div className="border-r border-slate-100 p-2">
                  <div className={`${readCellClass} text-purple-700`}>{money(item.netAmount)}</div>
                </div>
                <div className="border-r border-slate-100 p-2" title={suggestTitle}>
                  <input
                    type="date"
                    value={row.expenseDate || ""}
                    disabled={!!row.suggestCodes || locked}
                    onChange={(e) => updateRow(index, "expenseDate", e.target.value)}
                    className={`${inputClass} text-center`}
                  />
                  {row.suggestCodes && (
                    <div className="mt-1 truncate text-center text-[11px] font-medium text-emerald-700">
                      Theo {row.suggestCodes}
                    </div>
                  )}
                </div>
                <div className="border-r border-slate-100 p-2" title={suggestTitle}>
                  <CashAccountSelect
                    value={row.cashAccount}
                    disabled={!!row.suggestCodes || locked}
                    onChange={(value) => updateRow(index, "cashAccount", value)}
                    className={`${inputClass} px-2`}
                  />
                  <SuggestSourcesNote sources={row.suggestSources} />
                </div>
                <div className="border-r border-slate-100 p-2">
                  <input
                    value={row.note || ""}
                    disabled={moneyLocked}
                    onChange={(e) => updateRow(index, "note", e.target.value)}
                    placeholder="Ghi chú..."
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center justify-center">
                  {item.standalone && !moneyLocked && !row.suggestCodes && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      title="Xoá dòng"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* TỔNG */}
          <div
            className="grid border-t border-slate-200 bg-slate-50 text-sm font-bold"
            style={{ gridTemplateColumns }}
          >
            <div className="col-span-6 flex min-h-[64px] items-center justify-center border-r border-slate-200 text-slate-700">
              TỔNG CỘNG
            </div>
            <div className="flex items-center justify-center border-r border-slate-200 text-slate-800">
              {money(totals.amount)}
            </div>
            <div className="flex items-center justify-end border-r border-slate-200 px-4 text-rose-600">
              {money(totals.pitAmount)}
            </div>
            <div className="flex items-center justify-center border-r border-slate-200 text-purple-700">
              {money(totals.netAmount)}
            </div>
            <div className="border-r border-slate-200" />
            <div className="border-r border-slate-200" />
            <div className="border-r border-slate-200" />
            <div className="flex items-center justify-center">
              {addRow && !moneyLocked && (
                <button
                  type="button"
                  onClick={addRow}
                  title="Thêm dòng chỉ cho bảng Giáo viên trường"
                  className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-200 bg-white px-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-50"
                >
                  <Plus size={14} />
                  Thêm
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {schoolId && (
        <SchoolTeacherFormModal
          open={addingForRow !== null}
          schoolId={schoolId}
          onClose={() => setAddingForRow(null)}
          onSaved={(teacher) => {
            onTeacherSaved(teacher);
            if (addingForRow !== null) updateRow(addingForRow, "schoolTeacherId", teacher.id);
          }}
        />
      )}

      {/* DUYỆT LƯƠNG */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 bg-amber-50/60 px-6 py-3">
        {approval ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              <BadgeCheck size={14} />
              Đã duyệt lương
              {approval.approvedByName ? ` — ${approval.approvedByName}` : ""}
            </span>
            <span className="text-slate-500">
              lúc {formatDateTime(approval.approvedAt)}. Sửa giáo viên, Đơn giá, số
              lượng hoặc thuế đổi theo thì phải duyệt lại.
            </span>
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            Chưa duyệt lương. Duyệt chỉ ghi người và thời điểm duyệt, không khoá bảng.
          </div>
        )}
        {canApprove && (
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-xs font-medium text-amber-700">
                Lưu tất cả trước khi duyệt
              </span>
            )}
            <button
              type="button"
              onClick={onApprove}
              disabled={approving || dirty || !(totals.amount > 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              <BadgeCheck size={16} />
              {approving ? "Đang duyệt…" : approval ? "Duyệt lại" : "Duyệt lương"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
