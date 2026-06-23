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

  const totalSchoolExpense = rows.reduce((sum, row, index) => {
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

    return (
      sum +
      students * months * teacherUnitPrice +
      students * months * taxUnitPrice +
      students * csvcUnitPrice
    );
  }, 0);

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
              {totalSchoolExpense.toLocaleString("vi-VN")}đ
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <div className="min-w-[2460px]">
          {/* HEADER ROW */}
          <div
            className="
              grid
              grid-cols-[120px_90px_120px_140px_150px_140px_140px_120px_140px_120px_180px_150px_150px_160px_180px_180px_70px]
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
              🕒 Số tiết
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              👨‍🎓 HS
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              📅 Tháng
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              💵 Đơn giá
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
              💵 ĐG CSVC
            </div>

            <div className="p-3 text-center border-r border-slate-700">
              🏫 CSVC
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
              grid-cols-[120px_90px_120px_140px_150px_140px_140px_120px_140px_120px_180px_150px_150px_160px_180px_180px_70px]
              bg-slate-100
              border-t-2
              border-slate-300
              font-bold
            "
          >
            <div className="col-span-10 flex items-center justify-center py-4 text-slate-700">
              TỔNG CỘNG
            </div>
            <div className="flex items-center justify-center py-4 text-amber-700 text-lg">
              {totalSchoolExpense.toLocaleString("vi-VN")}
            </div>

            <div />

            <div />

            <div />

            <div />

            <div />

            <div />
          </div>
        </div>
      </div>
    </div>
  );
}
