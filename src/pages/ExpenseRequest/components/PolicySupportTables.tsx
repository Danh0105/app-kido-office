import type { PolicySupport } from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";

const money = (value: number | null | undefined) =>
  `${formatVnd(Number(value ?? 0)) || "0"} đ`;

/**
 * Hỗ trợ tiền mặt và hỗ trợ thiết bị trong chính sách đã duyệt của trường —
 * kinh doanh xem trước khi lập Đề xuất chi Năm cho trường (chỉ lập được khi
 * một trong hai có số tiền).
 */
export default function PolicySupportTables({
  support,
  loading,
  error,
}: {
  support: PolicySupport | null;
  loading?: boolean;
  error?: string;
}) {
  if (loading) {
    return <p className="text-xs text-gray-400">Đang tải chính sách của trường…</p>;
  }
  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!support) return null;

  if (!support.hasCash && !support.hasEquipment) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
        Chính sách đã duyệt của trường năm học {support.schoolYear} không có hỗ
        trợ tiền mặt hoặc thiết bị nên chưa lập được đề xuất chi Năm cho trường
        này.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {support.hasCash && (
        <section className="rounded-xl border border-emerald-100 overflow-hidden">
          <div className="flex items-center justify-between bg-emerald-50 px-3 py-2">
            <h4 className="text-xs font-semibold text-emerald-800">
              💵 Hỗ trợ tiền mặt trong chính sách
            </h4>
            <span className="text-xs font-semibold text-emerald-800">
              {money(support.cashActualTotal)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Môn</th>
                  <th className="px-2 py-1.5 text-left font-medium">Loại</th>
                  <th className="px-2 py-1.5 text-right font-medium">Số tiền</th>
                  <th className="px-2 py-1.5 text-right font-medium">Thực tế</th>
                </tr>
              </thead>
              <tbody>
                {support.cash.map((row, index) => (
                  <tr key={`${row.policyId}-${index}`} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-800">{row.subjectName || `Môn #${row.subjectId}`}</td>
                    <td className="px-2 py-1.5 text-gray-600">{row.type || "—"}</td>
                    <td className="px-2 py-1.5 text-right text-gray-800">{money(row.money)}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-emerald-700">
                      {money(row.actualAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {support.hasEquipment && (
        <section className="rounded-xl border border-indigo-100 overflow-hidden">
          <div className="flex items-center justify-between bg-indigo-50 px-3 py-2">
            <h4 className="text-xs font-semibold text-indigo-800">
              🧰 Hỗ trợ thiết bị trong chính sách
            </h4>
            <span className="text-xs font-semibold text-indigo-800">
              {money(support.equipmentTotal)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Môn</th>
                  <th className="px-2 py-1.5 text-left font-medium">Thiết bị</th>
                  <th className="px-2 py-1.5 text-right font-medium">SL</th>
                  <th className="px-2 py-1.5 text-right font-medium">Đơn giá</th>
                  <th className="px-2 py-1.5 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {support.equipment.map((row, index) => (
                  <tr key={`${row.policyId}-${index}`} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-800">{row.subjectName || `Môn #${row.subjectId}`}</td>
                    <td className="px-2 py-1.5 text-gray-600">{row.category || "—"}</td>
                    <td className="px-2 py-1.5 text-right text-gray-800">{row.qty || "—"}</td>
                    <td className="px-2 py-1.5 text-right text-gray-800">
                      {row.price ? money(row.price) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-indigo-700">
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
