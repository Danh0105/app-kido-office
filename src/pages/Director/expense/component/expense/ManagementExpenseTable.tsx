// components/expense/ManagementExpenseTable.tsx

import { Building2, CalendarDays, Wallet, Receipt, Users } from "lucide-react";

import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import ManagementExpenseRow from "./ManagementExpenseRow";

type Props = {
  rows: any[];
  subjects: any;
  inputRows: InputExpenseRow[];
  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => void;
  updateRow: (index: number, field: any, value: string) => void;
  removeRow: (index: number) => void;
};

export default function ManagementExpenseTable({
  rows,
  subjects,
  inputRows,
  updateInputRow,
  updateRow,
  removeRow,
}: Props) {
  const ql1 = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Percent || 0);

  const ql2 = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Percent || 0);

  const ql1Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql1Tax || 0);

  const ql2Tax = Number(subjects?.policies?.[0]?.data?.ttcs?.[0]?.ql2Tax || 0);
  const fallbackInputData = inputRows[0] || ({} as InputExpenseRow);

  const totals = rows.reduce(
    (sum, row, index) => {
      const inputData = inputRows[index] || fallbackInputData;
      const students = Number(inputData.studentCount || 0);
      const months = Number(inputData.monthsCount || 0);
      const totalQL1Expense = (ql1 - ql1Tax) * students * months;
      const totalQL2Expense = (ql2 - ql2Tax) * students * months;
      const totalOutsideExpense = totalQL1Expense + totalQL2Expense;
      const paidAmount = Number(row.paidAmount || 0);

      return {
        ql1UnitPrice: sum.ql1UnitPrice + ql1,
        ql1Expense: sum.ql1Expense + totalQL1Expense,
        ql2UnitPrice: sum.ql2UnitPrice + ql2,
        ql2Expense: sum.ql2Expense + totalQL2Expense,
        totalOutsideExpense: sum.totalOutsideExpense + totalOutsideExpense,
        paidAmount: sum.paidAmount + paidAmount,
        remainingOutsideExpense:
          sum.remainingOutsideExpense + totalOutsideExpense - paidAmount,
      };
    },
    {
      ql1UnitPrice: 0,
      ql1Expense: 0,
      ql2UnitPrice: 0,
      ql2Expense: 0,
      totalOutsideExpense: 0,
      paidAmount: 0,
      remainingOutsideExpense: 0,
    },
  );

  const formatVND = (value: number) => value.toLocaleString("vi-VN");

  const footerCellClass =
    "flex min-h-[72px] flex-col items-center justify-center border-r border-slate-300 px-2 py-3 text-center";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
              <Building2 size={20} />
              Chi Ngoài
            </div>

            <div className="text-emerald-100 text-sm mt-1">
              Quản lý chi phí ngoài và công nợ
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-emerald-100">Tổng chi ngoài</div>

            <div className="font-bold text-2xl">
              {formatVND(totals.totalOutsideExpense)}đ
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[2190px]">
          {/* HEADER TABLE */}
          <div
            className="
              grid
              grid-cols-[200px_120px_120px_120px_120px_120px_180px_180px_180px_140px_140px_140px_160px_200px_70px]
              bg-slate-900
              text-white
              text-sm
              font-semibold
              sticky
              top-0
              z-10
            "
          >
            <div className="p-3 text-center border-r border-slate-700">
              📄 Nội dung
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              🕒 Số tiết
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              <div className="flex items-center justify-center gap-2">
                <Users size={14} />
                Số HS
              </div>
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              📅 Số tháng
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              💸 Đơn giá QL1
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              👤 Chi QL1
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              💸 Đơn giá QL2
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              👤 Chi QL2
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              💸 Chi ngoài
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              <div className="flex items-center justify-center gap-2">
                <CalendarDays size={14} />
                Ngày chi
              </div>
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              <div className="flex items-center justify-center gap-2">
                <Wallet size={14} />
                Đã chi
              </div>
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              📊 Còn chi
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              👤 Người chi
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              📝 Ghi chú
            </div>

            <div className="p-3 text-center">⚙️</div>
          </div>

          {/* BODY */}
          <div>
            {rows.map((row, index) => (
              <ManagementExpenseRow
                key={index}
                row={row}
                subjects={subjects}
                index={index}
                inputData={inputRows[index] || fallbackInputData}
                updateInputRow={updateInputRow}
                removeRow={removeRow}
                updateRow={updateRow}
              />
            ))}
          </div>

          {/* FOOTER */}
          <div
            className="
    grid
    grid-cols-[200px_120px_120px_120px_120px_120px_180px_180px_180px_140px_140px_140px_160px_200px_70px]
    bg-slate-100
    border-t-2
    border-slate-300
    font-bold
  "
          >
            {/* Nội dung + Số tiết + Số HS + Số tháng */}
            <div className={`${footerCellClass} col-span-4 text-slate-700`}>
              <span className="text-sm uppercase tracking-wide">Tổng cộng</span>
              <span className="text-xs font-medium text-slate-500">
                Theo dữ liệu hiện tại
              </span>
            </div>

            {/* Đơn giá QL1 */}
            <div className={footerCellClass} />

            {/* Chi QL1 */}
            <div className={`${footerCellClass} text-emerald-700`}>
              <span className="text-lg">{formatVND(totals.ql1Expense)}</span>
            </div>

            {/* Đơn giá QL2 */}
            <div className={footerCellClass} />

            {/* Chi QL2 */}
            <div className={`${footerCellClass} text-cyan-700`}>
              <span className="text-lg">{formatVND(totals.ql2Expense)}</span>
            </div>

            {/* Chi ngoài */}
            <div className={`${footerCellClass} text-red-600`}>
              <span className="text-lg">
                {formatVND(totals.totalOutsideExpense)}
              </span>
            </div>

            {/* Ngày chi */}
            <div className={footerCellClass} />

            {/* Đã chi */}
            <div className={`${footerCellClass} text-orange-600`}>
              <span className="text-lg">{formatVND(totals.paidAmount)}</span>
            </div>

            {/* Còn chi */}
            <div className={`${footerCellClass} text-purple-600`}>
              <span className="text-lg">
                {formatVND(totals.remainingOutsideExpense)}
              </span>
            </div>

            {/* Người chi */}
            <div className={footerCellClass} />

            {/* Ghi chú */}
            <div className={footerCellClass} />

            {/* Action */}
            <div className="min-h-[72px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
