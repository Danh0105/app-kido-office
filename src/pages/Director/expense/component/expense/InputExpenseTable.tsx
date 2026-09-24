import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import { formatDecimal } from "@/utils/decimal";
import DecimalInput from "@/components/DecimalInput";

type Props = {
  rows: InputExpenseRow[];
  onUpdate: (index: number, field: keyof InputExpenseRow, value: any) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  defaultFee?: number;
  classCount: number;
};

export default function InputExpenseTable({
  rows,
  onUpdate,
  onAdd,
  onRemove,
  classCount,
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
      <div className="flex items-center justify-between px-7 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div>
          <h2 className="font-bold text-lg">💰 Doanh Thu</h2>
          <p className="text-sm text-indigo-100 mt-1">
            Quản lý thu học phí và công nợ
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-indigo-100">Thành tiền</div>
          <div className="font-bold text-2xl">
            {totals.totalInvoice.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1500px] border-collapse font-semibold text-xl">
          <thead className="text-xl">
            <tr className="bg-slate-900 text-white">
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📄 Nội dung
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🕒 Số tiết
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                👨‍🎓 HS
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📅 Tháng
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                💵 Đơn giá
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🧾 Thành tiền
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                💰 Đã thu
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🏦 Hình thức
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📅 Ngày thu
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📊 Còn lại
              </th>
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
              const locked = !!row.invoiceLocked;

              return (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="border p-3 min-w-[220px]">
                    <textarea
                      value={row.content || ""}
                      maxLength={500}
                      disabled={locked}
                      onChange={(e) =>
                        onUpdate(idx, "content", e.target.value.slice(0, 500))
                      }
                      placeholder="Nhập nội dung..."
                      rows={2}
                      className="w-full min-h-16 border rounded-lg px-3 py-2 text-sm resize-y whitespace-normal break-words disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number(row.totalPeriods) || ""}
                      disabled={locked}
                      onChange={(e) => {
                        const periods = Number(e.target.value || 0);

                        onUpdate(idx, "totalPeriods", periods);
                        onUpdate(
                          idx,
                          "studentCount",
                          classCount > 0
                            ? Math.round((periods / 4) * classCount)
                            : 0,
                        );
                      }}
                      className="w-full h-16 text-center border rounded-lg text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number(row.studentCount) || ""}
                      disabled={locked}
                      onChange={(e) => {
                        onUpdate(idx, "studentCount", Number(e.target.value || 0));
                      }}
                      className="w-full h-16 text-center border rounded-lg text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>
                  <td className="border p-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Number(row.monthsCount) || ""}
                      disabled={locked}
                      onChange={(e) => {
                        const value = e.target.value;

                        onUpdate(
                          idx,
                          "monthsCount",
                          value === "" ? 0 : Number(value),
                        );
                      }}
                      className="w-full h-16 text-center border rounded-lg text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-2 bg-emerald-50">
                    <DecimalInput
                      value={row.unitPrice}
                      disabled={locked}
                      onValueChange={(value) =>
                        onUpdate(idx, "unitPrice", value)
                      }
                      placeholder="0"
                      allowDecimal={false}
                      className="w-full h-14 text-center font-bold text-emerald-700 border rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-2 bg-blue-50">
                    <input
                      readOnly
                      value={formatDecimal(invoiceAmount) || ""}
                      className="w-full h-14 text-center font-bold text-blue-700 border rounded-lg text-sm"
                    />
                  </td>

                  <td className="border p-2 bg-green-50">
                    <DecimalInput
                      value={row.paidAmount}
                      onValueChange={(value) =>
                        onUpdate(idx, "paidAmount", value)
                      }
                      placeholder="0"
                      allowDecimal={false}
                      className="w-full h-16 text-center font-bold text-sm text-green-700 border rounded-lg"
                    />
                  </td>

                  <td className="border p-3">
                    <select
                      value={row.paymentMethod}
                      disabled={locked}
                      onChange={(e) =>
                        onUpdate(idx, "paymentMethod", e.target.value)
                      }
                      className="w-full h-14 border rounded-lg px-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">Chọn</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                    </select>
                  </td>

                  <td className="border p-3">
                    <input
                      type="date"
                      value={row.paymentDate}
                      disabled={locked}
                      onChange={(e) =>
                        onUpdate(idx, "paymentDate", e.target.value)
                      }
                      className="w-full h-14 border rounded-lg px-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-2 bg-orange-50">
                    <input
                      readOnly
                      value={formatDecimal(remaining) || ""}
                      className="w-full h-14 text-center font-bold text-orange-700 border rounded-lg text-sm"
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
