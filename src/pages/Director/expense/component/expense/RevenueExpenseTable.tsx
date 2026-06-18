// components/expense/RevenueExpenseTable.tsx

import { Building2, CalendarDays, Receipt, Wallet } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import RevenueExpenseRow from "./RevenueExpenseRow";

type Props = {
  rows: any[];
  subjects: any;
  inputData: InputExpenseRow;

  updateRow: (index: number, field: any, value: string) => void;
  removeRow: (index: number) => void;
};

export default function RevenueExpenseTable({
  rows,
  subjects,
  inputData,
  updateRow,
  removeRow,
}: Props) {
  const students = Number(inputData.studentCount || 0);
  const months = Number(inputData.monthsCount || 0);

  const fee = Number(subjects?.policies?.[0]?.data?.fee || 0);

  const csvc = Number(subjects?.policies?.[0]?.data?.csvc || 0);

  const totalRevenue = rows.length * students * months * fee;

  const totalSchoolExpense =
    rows.length * (csvc * students + students * months * fee * 0.02);

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
        <div className="min-w-[1900px]">
          {/* HEADER ROW */}
          <div
            className="
              grid
              grid-cols-[90px_90px_90px_120px_180px_150px_150px_160px_160px_160px_180px_180px_70px]
              bg-slate-900
              text-white
              font-semibold
              text-sm
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
                inputData={inputData}
                updateRow={updateRow}
                removeRow={removeRow}
              />
            ))}
          </div>

          {/* FOOTER */}
          <div
            className="
              grid
              grid-cols-[120px_90px_90px_120px_180px_150px_150px_160px_160px_160px_180px_180px_70px]
              bg-slate-100
              border-t-2
              border-slate-300
              font-bold
            "
          >
            <div className="col-span-1 flex items-center justify-center py-4 text-slate-700">
              TỔNG CỘNG
            </div>
            <div className="col-span-2"></div>
            <div className="flex items-center justify-center py-4 text-amber-700 text-lg">
              {totalSchoolExpense.toLocaleString("vi-VN")}
            </div>

            <div />

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
