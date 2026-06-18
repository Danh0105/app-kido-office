// components/expense/ExpenseItemTable.tsx

import { Pencil, Trash2 } from "lucide-react";

type Props = {
  data: any;

  onEdit: (item: any) => void;

  onDelete: (id: number) => void;
};

const money = (v: number) => Number(v || 0).toLocaleString("vi-VN");

export default function ExpenseItemTable({ data, onEdit, onDelete }: Props) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          {/* HEADER */}
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr className="text-slate-700">
              <th className="px-4 py-3 text-center font-semibold">Tiết</th>

              <th className="px-4 py-3 text-center font-semibold">Học sinh</th>

              <th className="px-4 py-3 text-left font-semibold">Người chi</th>

              <th className="px-4 py-3 text-right font-semibold">Doanh thu</th>

              <th className="px-4 py-3 text-right font-semibold">Hóa đơn</th>

              <th className="px-4 py-3 text-right font-semibold">Chi phí</th>

              <th className="px-4 py-3 text-right font-semibold">Chi ngoài</th>

              <th className="px-4 py-3 text-right font-semibold">Đã chi</th>

              <th className="px-4 py-3 text-right font-semibold">Còn chi</th>

              <th className="px-4 py-3 text-center font-semibold">Ngày thu</th>

              <th className="px-4 py-3 text-center font-semibold">Ngày chi</th>

              <th className="px-4 py-3 text-left font-semibold">Ghi chú</th>

              <th className="px-4 py-3 text-center font-semibold sticky right-0 bg-slate-100">
                Thao tác
              </th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            <tr
              className="
      border-t border-slate-100
      hover:bg-slate-50
      transition
    "
            >
              <td className="px-4 py-4 text-center">
                {data.totalPeriods || 0}
              </td>

              <td className="px-4 py-4 text-center">
                {data.studentCount || 0}
              </td>

              <td className="px-4 py-4 whitespace-nowrap">
                {data.payer || "--"}
              </td>

              <td className="px-4 py-4 text-right font-medium text-blue-700 whitespace-nowrap">
                {money(data.revenueAmount)}
              </td>

              <td className="px-4 py-4 text-right whitespace-nowrap">
                {money(data.invoiceAmount)}
              </td>

              <td className="px-4 py-4 text-right text-red-600 whitespace-nowrap">
                {money(data.expenseAmount)}
              </td>

              <td className="px-4 py-4 text-right text-orange-600 whitespace-nowrap">
                {money(data.totalOutsideExpense)}
              </td>

              <td className="px-4 py-4 text-right text-rose-600 whitespace-nowrap">
                {money(data.paidAmount)}
              </td>

              <td className="px-4 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                {money(data.remainingOutsideExpense)}
              </td>

              <td className="px-4 py-4 text-center whitespace-nowrap">
                {data.collectedDate || "--"}
              </td>

              <td className="px-4 py-4 text-center whitespace-nowrap">
                {data.paymentDate || "--"}
              </td>

              <td className="px-4 py-4 min-w-[220px] text-slate-600">
                {data.note || "--"}
              </td>

              <td className="px-4 py-4 sticky right-0 bg-white">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onEdit(data)}
                    className="
            w-9 h-9 rounded-lg
            bg-blue-50 text-blue-600
            hover:bg-blue-100
            flex items-center justify-center
          "
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => onDelete(data.id)}
                    className="
            w-9 h-9 rounded-lg
            bg-red-50 text-red-500
            hover:bg-red-100
            flex items-center justify-center
          "
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
