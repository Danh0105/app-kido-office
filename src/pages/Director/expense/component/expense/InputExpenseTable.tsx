import { useEffect, useMemo } from "react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  data: InputExpenseRow;
  onChange: <K extends keyof InputExpenseRow>(
    field: K,
    value: InputExpenseRow[K],
  ) => void;
  subjects: any;
};

export default function InputExpenseTable({ data, onChange, subjects }: Props) {
  const periods = Number(data.totalPeriods || 0);
  const students = Number(data.studentCount || 0);
  const months = Number(data.monthsCount || 0);
  const csvc = Number(subjects?.policies?.[0]?.data?.csvc || 0);
  const unitPrice = Number(data.unitPrice || 0);

  const { invoiceAmount, totalSchoolExpense } = useMemo(() => {
    const invoiceAmount = students * months * unitPrice;

    const totalSchoolExpense = csvc * students + invoiceAmount * 0.02;

    return {
      invoiceAmount,
      totalSchoolExpense,
    };
  }, [students, months, unitPrice, csvc]);
  const remainingAmount = invoiceAmount - Number(data.paidAmount || 0);
  useEffect(() => {
    if (!data.unitPrice && csvc > 0) {
      onChange("unitPrice", csvc);
    }
  }, [csvc]);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Title */}
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
            {invoiceAmount.toLocaleString("vi-VN")}đ
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
            </tr>
          </thead>

          <tbody>
            <tr className="hover:bg-slate-50 transition">
              <td className="border p-2">
                <input
                  type="number"
                  value={data.totalPeriods}
                  onChange={(e) => {
                    const periods = Number(e.target.value || 0);

                    onChange("totalPeriods", periods);

                    const students = (periods / 4) * 30;

                    onChange("studentCount", Math.round(students));
                  }}
                  className="w-full h-10 text-center border rounded-lg"
                />
              </td>

              <td className="border p-2">
                <input
                  type="number"
                  value={data.studentCount}
                  onChange={(e) => {
                    const students = Number(e.target.value || 0);

                    onChange("studentCount", students);

                    const periods = (students * 4) / 30;

                    onChange("totalPeriods", Math.round(periods));
                  }}
                  className="w-full h-10 text-center border rounded-lg"
                />
              </td>

              <td className="border p-2">
                <input
                  type="number"
                  value={data.monthsCount}
                  onChange={(e) =>
                    onChange("monthsCount", Number(e.target.value || 0))
                  }
                  className="w-full h-10 text-center border rounded-lg"
                />
              </td>

              <td className="border p-2 bg-emerald-50">
                <input
                  type="number"
                  value={data.unitPrice}
                  onChange={(e) =>
                    onChange("unitPrice", Number(e.target.value || 0))
                  }
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
                  checked={data.invoiced}
                  onChange={(e) => onChange("invoiced", e.target.checked)}
                  className="w-5 h-5"
                />
              </td>

              <td className="border p-2">
                <input
                  type="date"
                  value={data.invoiceDate}
                  onChange={(e) => onChange("invoiceDate", e.target.value)}
                  className="w-full h-10 border rounded-lg px-2"
                />
              </td>

              <td className="border p-2 bg-green-50">
                <input
                  type="number"
                  value={data.paidAmount}
                  onChange={(e) =>
                    onChange("paidAmount", Number(e.target.value || 0))
                  }
                  className="w-full h-10 text-center font-bold text-green-700 border rounded-lg"
                />
              </td>

              <td className="border p-2">
                <select
                  value={data.paymentMethod}
                  onChange={(e) =>
                    onChange(
                      "paymentMethod",
                      e.target.value as "cash" | "bank_transfer" | "",
                    )
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
                  value={data.paymentDate}
                  onChange={(e) => onChange("paymentDate", e.target.value)}
                  className="w-full h-10 border rounded-lg px-2"
                />
              </td>

              <td className="border p-2 bg-orange-50">
                <input
                  readOnly
                  value={remainingAmount.toLocaleString("vi-VN")}
                  className="w-full h-10 text-center font-bold text-orange-700 border rounded-lg"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 bg-slate-50 border-t">
        <div className="p-4">
          <div className="text-xs text-slate-500">Doanh thu</div>
          <div className="font-bold text-blue-700 text-lg">
            {invoiceAmount.toLocaleString("vi-VN")}đ
          </div>
        </div>

        <div className="p-4 border-l">
          <div className="text-xs text-slate-500">Đã thu</div>
          <div className="font-bold text-green-700 text-lg">
            {Number(data.paidAmount || 0).toLocaleString("vi-VN")}đ
          </div>
        </div>

        <div className="p-4 border-l">
          <div className="text-xs text-slate-500">Công nợ</div>
          <div className="font-bold text-orange-700 text-lg">
            {remainingAmount.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>
    </div>
  );
}
