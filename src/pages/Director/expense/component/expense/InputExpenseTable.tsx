import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  rows: InputExpenseRow[];
  onUpdate: (index: number, field: keyof InputExpenseRow, value: any) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  defaultFee?: number;
};

export default function InputExpenseTable({
  rows,
  onUpdate,
  onAdd,
  onRemove,
}: Props) {
  const totals = useMemo(() => {
    let totalInvoice = 0;
    let totalPaid = 0;

    rows.forEach((row) => {
      const students = Number(row.studentCount || 0);
      const months = Number(row.monthsCount || 0);
      const price = Number(row.unitPrice || 0);
      totalInvoice += students * months * price;
      totalPaid += Number(row.paidAmount || 0);
    });

    return { totalInvoice, totalPaid, remaining: totalInvoice - totalPaid };
  }, [rows]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div>
          <h2 className="font-bold text-lg">💰 Doanh Thu</h2>
          <p className="text-xs text-indigo-100">
            Quản lý thu học phí và công nợ
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-indigo-100">Thành tiền</div>
          <div className="font-bold text-xl">
            {totals.totalInvoice.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1700px] border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-sm">
              <th className="p-3 border border-slate-700">🕒 Số tiết</th>
              <th className="p-3 border border-slate-700">👨‍🎓 HS</th>
              <th className="p-3 border border-slate-700">📅 Tháng</th>
              <th className="p-3 border border-slate-700">💵 Đơn giá</th>
              <th className="p-3 border border-slate-700">🧾 Thành tiền</th>
              <th className="p-3 border border-slate-700">📄 HĐ</th>
              <th className="p-3 border border-slate-700">📆 Ngày xuất</th>
              <th className="p-3 border border-slate-700">💰 Đã thu</th>
              <th className="p-3 border border-slate-700">🏦 Hình thức</th>
              <th className="p-3 border border-slate-700">📅 Ngày thu</th>
              <th className="p-3 border border-slate-700">📊 Còn lại</th>
              <th className="p-3 border border-slate-700 w-12">⚙️</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const students = Number(row.studentCount || 0);
              const months = Number(row.monthsCount || 0);
              const price = Number(row.unitPrice || 0);
              const invoiceAmount = students * months * price;
              const remaining = invoiceAmount - Number(row.paidAmount || 0);

              return (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="border p-2">
                    <input
                      type="number"
                      value={row.totalPeriods}
                      onChange={(e) => {
                        const periods = Number(e.target.value || 0);
                        onUpdate(idx, "totalPeriods", periods);
                        onUpdate(
                          idx,
                          "studentCount",
                          Math.round((periods / 4) * 30),
                        );
                      }}
                      className="w-full h-10 text-center border rounded-lg"
                    />
                  </td>

                  <td className="border p-2">
                    <input
                      type="number"
                      value={row.studentCount}
                      onChange={(e) => {
                        const s = Number(e.target.value || 0);
                        onUpdate(idx, "studentCount", s);
                        onUpdate(idx, "totalPeriods", Math.round((s * 4) / 30));
                      }}
                      className="w-full h-10 text-center border rounded-lg"
                    />
                  </td>

                  <td className="border p-2">
                    <input
                      type="number"
                      value={row.monthsCount}
                      onChange={(e) =>
                        onUpdate(
                          idx,
                          "monthsCount",
                          Number(e.target.value || 0),
                        )
                      }
                      className="w-full h-10 text-center border rounded-lg"
                    />
                  </td>

                  <td className="border p-2 bg-emerald-50">
                    <input
                      type="text"
                      value={
                        row.unitPrice
                          ? row.unitPrice.toLocaleString("vi-VN")
                          : ""
                      }
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, "");
                        onUpdate(idx, "unitPrice", Number(rawValue || 0));
                      }}
                      className="w-full h-10 text-center font-bold text-emerald-700 border rounded-lg"
                    />
                  </td>

                  <td className="border p-2 bg-blue-50">
                    <input
                      readOnly
                      value={invoiceAmount.toLocaleString("vi-VN")}
                      className="w-full h-10 text-center font-bold text-blue-700 border rounded-lg"
                    />
                  </td>

                  <td className="border p-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.invoiced}
                      onChange={(e) =>
                        onUpdate(idx, "invoiced", e.target.checked)
                      }
                      className="w-5 h-5"
                    />
                  </td>

                  <td className="border p-2">
                    <input
                      type="date"
                      value={row.invoiceDate}
                      onChange={(e) =>
                        onUpdate(idx, "invoiceDate", e.target.value)
                      }
                      className="w-full h-10 border rounded-lg px-2"
                    />
                  </td>

                  <td className="border p-2 bg-green-50">
                    <input
                      type="text"
                      value={
                        row.paidAmount
                          ? row.paidAmount.toLocaleString("vi-VN")
                          : ""
                      }
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, "");
                        onUpdate(idx, "paidAmount", Number(rawValue || 0));
                      }}
                      className="w-full h-10 text-center font-bold text-green-700 border rounded-lg"
                    />
                  </td>

                  <td className="border p-2">
                    <select
                      value={row.paymentMethod}
                      onChange={(e) =>
                        onUpdate(idx, "paymentMethod", e.target.value)
                      }
                      className="w-full h-10 border rounded-lg px-2"
                    >
                      <option value="">Chọn</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                    </select>
                  </td>

                  <td className="border p-2">
                    <input
                      type="date"
                      value={row.paymentDate}
                      onChange={(e) =>
                        onUpdate(idx, "paymentDate", e.target.value)
                      }
                      className="w-full h-10 border rounded-lg px-2"
                    />
                  </td>

                  <td className="border p-2 bg-orange-50">
                    <input
                      readOnly
                      value={remaining.toLocaleString("vi-VN")}
                      className="w-full h-10 text-center font-bold text-orange-700 border rounded-lg"
                    />
                  </td>

                  <td className="border p-2 text-center">
                    {rows.length > 1 && (
                      <button
                        onClick={() => onRemove(idx)}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center mx-auto transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t">
        <button
          onClick={onAdd}
          className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
        >
          + Thêm dòng doanh thu
        </button>
      </div>

      <div className="grid grid-cols-3 bg-slate-50 border-t">
        <div className="p-4">
          <div className="text-xs text-slate-500">Doanh thu</div>
          <div className="font-bold text-blue-700 text-lg">
            {totals.totalInvoice.toLocaleString("vi-VN")}đ
          </div>
        </div>

        <div className="p-4 border-l">
          <div className="text-xs text-slate-500">Đã thu</div>
          <div className="font-bold text-green-700 text-lg">
            {totals.totalPaid.toLocaleString("vi-VN")}đ
          </div>
        </div>

        <div className="p-4 border-l">
          <div className="text-xs text-slate-500">Công nợ</div>
          <div className="font-bold text-orange-700 text-lg">
            {totals.remaining.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>
    </div>
  );
}
