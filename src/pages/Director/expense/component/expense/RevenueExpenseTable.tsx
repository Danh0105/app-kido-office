// components/expense/RevenueExpenseTable.tsx

import { Building2, CalendarDays, Receipt, Wallet } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import RevenueExpenseRow from "./RevenueExpenseRow";

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

export default function RevenueExpenseTable({
  rows,
  subjects,
  inputRows,
  updateInputRow,
  updateRow,
  removeRow,
}: Props) {
  const policyData = subjects?.policies?.[0]?.data || {};
  const fallbackInputData = inputRows[0] || ({} as InputExpenseRow);

  const totals = rows.reduce(
    (sum, row, index) => {
      const inputData = inputRows[index] || fallbackInputData;
      const students = Number(inputData.studentCount || 0);
      const months = Number(inputData.monthsCount || 0);
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
      const teacherAmount = students * months * teacherUnitPrice;
      const taxAmount = students * months * taxUnitPrice;
      const csvcAmount = csvcUnitPrice * months * students;
      const totalSchoolExpense = teacherAmount + taxAmount + csvcAmount;
      const paidAmount = Number(row.paidAmount || 0);

      return {
        teacherUnitPrice: sum.teacherUnitPrice + teacherUnitPrice,
        teacherAmount: sum.teacherAmount + teacherAmount,
        taxUnitPrice: sum.taxUnitPrice + taxUnitPrice,
        taxAmount: sum.taxAmount + taxAmount,
        csvcUnitPrice: sum.csvcUnitPrice + csvcUnitPrice,
        csvcAmount: sum.csvcAmount + csvcAmount,
        totalSchoolExpense: sum.totalSchoolExpense + totalSchoolExpense,
        paidAmount: sum.paidAmount + paidAmount,
        remainingSchoolExpense:
          sum.remainingSchoolExpense + totalSchoolExpense - paidAmount,
      };
    },
    {
      teacherUnitPrice: 0,
      teacherAmount: 0,
      taxUnitPrice: 0,
      taxAmount: 0,
      csvcUnitPrice: 0,
      csvcAmount: 0,
      totalSchoolExpense: 0,
      paidAmount: 0,
      remainingSchoolExpense: 0,
    },
  );

  const formatVND = (value: number) => value.toLocaleString("vi-VN");

  const footerCellClass =
    "flex min-h-[72px] flex-col items-center justify-center border-r border-slate-300 px-2 py-3 text-center";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
              <Building2 size={20} />
              Chi Trường
            </div>

            <div className="text-blue-100 text-sm mt-1">
              Theo dõi công nợ và thanh toán
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-blue-100">Tổng chi trường</div>

            <div className="font-bold text-2xl">
              {formatVND(totals.totalSchoolExpense)}đ
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <div className="min-w-[2430px]">
          {/* HEADER ROW */}
          <div
            className="
              grid
              grid-cols-[200px_120px_90px_120px_140px_150px_160px_140px_120px_140px_150px_180px_150px_150px_160px_180px_70px]
              bg-slate-900
              text-white
              font-semibold
              text-base
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
              👨‍🎓 HS
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              📅 Tháng
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              💵 ĐG CSVC
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              🏫 CSVC
            </div>
            <div className="p-3 text-center border-r border-slate-700">
              💵 ĐG giáo viên
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              👩‍🏫 Giáo viên
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              💵 ĐG thuế
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              🧾 Thuế
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              💰 Chi trường
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
              📊 Còn lại
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
              <RevenueExpenseRow
                key={index}
                row={row}
                index={index}
                subjects={subjects}
                inputData={inputRows[index] || fallbackInputData}
                updateInputRow={updateInputRow}
                updateRow={updateRow}
                removeRow={removeRow}
              />
            ))}
          </div>

          {/* FOOTER */}
          <div
            className="
              grid
              grid-cols-[200px_120px_90px_120px_140px_150px_160px_140px_120px_140px_150px_180px_150px_150px_160px_180px_70px]
              bg-slate-100
              border-t-2
              border-slate-300
              font-bold
            "
          >
            <div className={`${footerCellClass} col-span-4 text-slate-700`}>
              <span className="text-sm uppercase tracking-wide">Tổng cộng</span>
              <span className="text-xs font-medium text-slate-500">
                Theo dữ liệu hiện tại
              </span>
            </div>
            <div className={footerCellClass} />
            <div className={`${footerCellClass} text-emerald-700`}>
              <span className="text-lg">{formatVND(totals.csvcAmount)}</span>
            </div>
            <div className={footerCellClass} />
            <div className={`${footerCellClass} text-purple-700`}>
              <span className="text-lg">{formatVND(totals.teacherAmount)}</span>
            </div>
            <div className={footerCellClass} />
            <div className={`${footerCellClass} text-rose-700`}>
              <span className="text-lg">{formatVND(totals.taxAmount)}</span>
            </div>

            <div className={`${footerCellClass} text-amber-700`}>
              <span className="text-lg">
                {formatVND(totals.totalSchoolExpense)}
              </span>
            </div>

            <div className={footerCellClass} />

            <div className={`${footerCellClass} text-red-600`}>
              <span className="text-xs">Đã chi</span>
              <span className="text-lg">{formatVND(totals.paidAmount)}</span>
            </div>

            <div className={`${footerCellClass} text-violet-700`}>
              <span className="text-xs">Còn lại</span>
              <span className="text-lg">
                {formatVND(totals.remainingSchoolExpense)}
              </span>
            </div>

            <div className={footerCellClass} />

            <div className={footerCellClass} />

            <div className="min-h-[72px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
