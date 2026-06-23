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

  const totalQL1 = rows.reduce((sum, _row, index) => {
    const inputData = inputRows[index] || fallbackInputData;
    const students = Number(inputData.studentCount || 0);
    const months = Number(inputData.monthsCount || 0);

    return sum + (ql1 - ql1Tax) * students * months;
  }, 0);

  const totalQL2 = rows.reduce((sum, _row, index) => {
    const inputData = inputRows[index] || fallbackInputData;
    const students = Number(inputData.studentCount || 0);
    const months = Number(inputData.monthsCount || 0);

    return sum + (ql2 - ql2Tax) * students * months;
  }, 0);

  const totalOutside = totalQL1 + totalQL2;

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
              {totalOutside.toLocaleString("vi-VN")}đ
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[2540px]">
          {/* HEADER TABLE */}
          <div
            className="
              grid
              grid-cols-[120px_120px_120px_120px_120px_180px_180px_180px_140px_140px_140px_140px_140px_160px_200px_70px]
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
                <Receipt size={14} />
                Tiền HĐ
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
              grid-cols-[120px_120px_120px_120px_120px_180px_180px_180px_140px_140px_140px_140px_140px_160px_200px_70px]
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
            <div />
            <div className="flex items-center justify-center py-4 text-emerald-700 text-lg">
              {totalQL1.toLocaleString("vi-VN")}
            </div>
            <div />

            <div className="flex items-center justify-center py-4 text-cyan-700 text-lg">
              {totalQL2.toLocaleString("vi-VN")}
            </div>

            <div className="flex items-center justify-center py-4 text-red-600 text-lg">
              {totalOutside.toLocaleString("vi-VN")}
            </div>

            <div />
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
