// components/expense/ManagementExpenseTable.tsx

import { Building2, CalendarDays, Wallet, Receipt, Users } from "lucide-react";

import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import {
  getOtherCostKey,
  getOtherCostUnitPrice,
  getPolicyOtherCosts,
} from "../../utils/policyOtherCosts";
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
  updateRow: (index: number, field: any, value: string | number) => void;
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
  const otherCosts = getPolicyOtherCosts(subjects);
  const gridTemplateColumns = [
    "200px",
    "120px",
    "120px",
    "120px",
    "120px",
    "120px",
    "180px",
    "180px",
    ...otherCosts.flatMap(() => ["150px", "160px"]),
    "180px",
    "140px",
    "140px",
    "140px",
    "160px",
    "200px",
    "70px",
  ].join(" ");
  const tableMinWidth = 2190 + otherCosts.length * 310;

  const totals = rows.reduce(
    (sum, row, index) => {
      const inputData = inputRows[index] || fallbackInputData;
      const students = Number(inputData.studentCount || 0);
      const months = Number(inputData.monthsCount || 0);
      const ql1UnitPrice = Number(row.ql1UnitPrice ?? ql1 - ql1Tax);
      const ql2UnitPrice = Number(row.ql2UnitPrice ?? ql2 - ql2Tax);
      const totalQL1Expense = ql1UnitPrice * students * months;
      const totalQL2Expense = ql2UnitPrice * students * months;
      const otherCostExpenses = otherCosts.map(
        (item) => getOtherCostUnitPrice(item) * students * months,
      );
      const totalOtherCostExpense = otherCostExpenses.reduce(
        (total, value) => total + value,
        0,
      );
      const totalOutsideExpense =
        totalQL1Expense + totalQL2Expense + totalOtherCostExpense;
      const paidAmount = Number(row.paidAmount || 0);

      return {
        ql1UnitPrice: sum.ql1UnitPrice + ql1UnitPrice,
        ql1Expense: sum.ql1Expense + totalQL1Expense,
        ql2UnitPrice: sum.ql2UnitPrice + ql2UnitPrice,
        ql2Expense: sum.ql2Expense + totalQL2Expense,
        otherCostExpenses: sum.otherCostExpenses.map(
          (value, otherCostIndex) =>
            value + Number(otherCostExpenses[otherCostIndex] || 0),
        ),
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
      otherCostExpenses: otherCosts.map(() => 0),
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
        <div style={{ minWidth: `${tableMinWidth}px` }}>
          {/* HEADER TABLE */}
          <div
            className="
              grid
              bg-slate-900
              text-white
              text-sm
              font-semibold
              sticky
              top-0
              z-10
            "
            style={{ gridTemplateColumns }}
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

            {otherCosts.map((item, index) => {
              const label = item.name || `Chi khác ${index + 1}`;

              return [
                <div
                  key={`${getOtherCostKey(item, index)}-unit`}
                  className="p-3 text-center border-r border-slate-700"
                >
                  💸 Đơn giá {label}
                </div>,
                <div
                  key={`${getOtherCostKey(item, index)}-expense`}
                  className="p-3 text-center border-r border-slate-700"
                >
                  👤 Chi {label}
                </div>,
              ];
            })}

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
                otherCosts={otherCosts}
                gridTemplateColumns={gridTemplateColumns}
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
    bg-slate-100
    border-t-2
    border-slate-300
    font-bold
  "
            style={{ gridTemplateColumns }}
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

            {otherCosts.map((item, index) => (
              <div
                key={`${getOtherCostKey(item, index)}-footer`}
                className="contents"
              >
                <div className={footerCellClass} />
                <div className={`${footerCellClass} text-fuchsia-700`}>
                  <span className="text-lg">
                    {formatVND(totals.otherCostExpenses[index] || 0)}
                  </span>
                </div>
              </div>
            ))}

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
