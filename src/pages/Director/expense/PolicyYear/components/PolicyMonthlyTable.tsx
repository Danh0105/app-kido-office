import { ClipboardList } from "lucide-react";
import {
  PolicyMonthlyInput,
  PolicySubject,
  PolicySummary,
} from "../types";
import { formatCurrency } from "../utils";
import PolicyMonthlyRow from "./PolicyMonthlyRow";

type PolicyMonthlyTableProps = {
  rows: PolicyMonthlyInput[];
  subjects: PolicySubject[];
  summary: PolicySummary;
  disabled?: boolean;
  databaseFieldsReadonly?: boolean;
  onChange: (row: PolicyMonthlyInput) => void;
  onEdit: (row: PolicyMonthlyInput) => void;
  onDelete: (rowId: number) => void;
};

const columnHeaderClass =
  "whitespace-nowrap px-3 py-3 text-center text-[11px] font-black uppercase tracking-wide";

export default function PolicyMonthlyTable({
  rows,
  subjects,
  summary,
  disabled = false,
  databaseFieldsReadonly = false,
  onChange,
  onEdit,
  onDelete,
}: PolicyMonthlyTableProps) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[620px] overflow-auto">
        <table className="min-w-[3070px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-30">
            <tr className="text-xs font-black uppercase tracking-wide text-white">
              <th
                colSpan={6}
                className="border-r border-slate-600 bg-slate-800 px-3 py-2.5 text-left"
              >
                Thông tin nhập
              </th>
              <th
                colSpan={4}
                className="border-r border-emerald-600 bg-emerald-700 px-3 py-2.5 text-center"
              >
                Doanh thu
              </th>
              <th
                colSpan={4}
                className="border-r border-orange-500 bg-orange-600 px-3 py-2.5 text-center"
              >
                Chính sách dự kiến
              </th>
              <th
                colSpan={2}
                className="border-r border-amber-500 bg-amber-600 px-3 py-2.5 text-center"
              >
                Chính sách tính toán
              </th>
              <th
                colSpan={4}
                className="border-r border-rose-500 bg-rose-600 px-3 py-2.5 text-center"
              >
                Đã chi
              </th>
              <th colSpan={2} className="bg-slate-700 px-3 py-2.5 text-center">
                Khác
              </th>
            </tr>
            <tr className="bg-slate-100 text-slate-600">
              <th className={`sticky left-0 z-40 min-w-[150px] bg-slate-100 text-left ${columnHeaderClass}`}>
                Môn học
              </th>
              <th className={columnHeaderClass}>Năm học</th>
              <th className={columnHeaderClass}>Tháng</th>
              <th className={columnHeaderClass}>SL HS đã thu</th>
              <th className={columnHeaderClass}>Đơn giá</th>
              <th className={columnHeaderClass}>Số tháng thu</th>
              <th className={`bg-emerald-50 ${columnHeaderClass}`}>Doanh thu trường</th>
              <th className={`bg-emerald-50 ${columnHeaderClass}`}>TKD</th>
              <th className={`bg-blue-50 ${columnHeaderClass}`}>Để lại trường</th>
              <th className={`bg-violet-50 ${columnHeaderClass}`}>Công ty nhận</th>
              <th className={`bg-orange-50 ${columnHeaderClass}`}>Chi hiệu trưởng</th>
              <th className={`bg-orange-50 ${columnHeaderClass}`}>Chi tiền mặt</th>
              <th className={`bg-orange-50 ${columnHeaderClass}`}>Chi thiết bị</th>
              <th className={`bg-orange-50 ${columnHeaderClass}`}>Tổng dự kiến</th>
              <th className={`bg-amber-50 ${columnHeaderClass}`}>Chi chính sách</th>
              <th className={`bg-amber-50 ${columnHeaderClass}`}>Sau thuế</th>
              <th className={`bg-rose-50 ${columnHeaderClass}`}>Đã chi tiền mặt</th>
              <th className={`bg-rose-50 ${columnHeaderClass}`}>Đã chi thiết bị</th>
              <th className={`bg-rose-50 ${columnHeaderClass}`}>Tổng đã chi</th>
              <th className={`bg-rose-50 ${columnHeaderClass}`}>Còn lại chi</th>
              <th className={`${columnHeaderClass} text-left`}>Ghi chú</th>
              <th className={`sticky right-0 z-40 bg-slate-100 ${columnHeaderClass}`}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const subject = subjectMap.get(row.subjectId);
                if (!subject) return null;

                return (
                  <PolicyMonthlyRow
                    key={row.id}
                    row={row}
                    subject={subject}
                    disabled={disabled}
                    databaseFieldsReadonly={databaseFieldsReadonly}
                    onChange={onChange}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                );
              })
            ) : (
              <tr>
                <td colSpan={22} className="py-16 text-center">
                  <ClipboardList
                    size={34}
                    className="mx-auto text-slate-300"
                  />
                  <p className="mt-3 font-bold text-slate-500">
                    Không có dòng dữ liệu phù hợp
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Hãy thay đổi bộ lọc hoặc thêm dòng mới.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-blue-50 text-xs font-black text-slate-800 shadow-[0_-1px_0_#bfdbfe]">
                <td
                  colSpan={3}
                  className="sticky left-0 z-30 bg-blue-50 px-3 py-3 text-left text-blue-800"
                >
                  TỔNG CỘNG
                </td>
                <td className="px-3 py-3 text-right">
                  {formatCurrency(summary.totalStudents)}
                </td>
                <td />
                <td />
                <td className="px-3 py-3 text-right text-emerald-700">
                  {formatCurrency(summary.totalRevenue)}
                </td>
                <td className="px-3 py-3 text-right">
                  {formatCurrency(summary.totalTkd)}
                </td>
                <td className="px-3 py-3 text-right text-blue-700">
                  {formatCurrency(summary.totalSchoolRetain)}
                </td>
                <td className="px-3 py-3 text-right text-violet-700">
                  {formatCurrency(summary.totalCompanyPayment)}
                </td>
                <td />
                <td />
                <td />
                <td className="px-3 py-3 text-right text-orange-700">
                  {formatCurrency(summary.totalInitialPolicy)}
                </td>
                <td />
                <td className="px-3 py-3 text-right text-amber-700">
                  {formatCurrency(Math.round(summary.totalPolicyAfterTax))}
                </td>
                <td />
                <td />
                <td className="px-3 py-3 text-right text-rose-700">
                  {formatCurrency(summary.totalPaid)}
                </td>
                <td className="px-3 py-3 text-right text-rose-700">
                  {formatCurrency(Math.round(summary.totalRemaining))}
                </td>
                <td />
                <td className="sticky right-0 bg-blue-50" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
