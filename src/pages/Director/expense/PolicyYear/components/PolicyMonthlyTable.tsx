import { ClipboardList } from "lucide-react";
import { PolicyMonthlyInput, PolicySubject, PolicySummary } from "../types";
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

const getSubjectCashPolicyAmount = (rows: PolicyMonthlyInput[]) => {
  const amount = rows.find((row) => Number(row.cashPolicyAmount || 0) > 0)
    ?.cashPolicyAmount;

  return Number(amount || rows[0]?.cashPolicyAmount || 0);
};

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
  const groupedRows = subjects.flatMap((subject) => {
    const subjectRows = rows.filter((row) => row.subjectId === subject.id);

    return subjectRows.length ? [{ subject, rows: subjectRows }] : [];
  });
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="sticky top-0 z-30">
            <tr className="text-xs font-black uppercase tracking-wide text-white">
              <th
                colSpan={5}
                className="border-r border-slate-600 bg-slate-800 px-3 py-2.5 text-left"
              >
                Thông tin nhập
              </th>
              <th
                colSpan={2}
                className="border-r border-orange-500 bg-orange-600 px-3 py-2.5 text-center"
              >
                Chính sách dự kiến
              </th>
              <th colSpan={2} className="bg-slate-700 px-3 py-2.5 text-center">
                Khác
              </th>
            </tr>
            <tr className="bg-slate-100 text-slate-600">
              <th
                className={`sticky left-0 z-40 bg-slate-100 text-left ${columnHeaderClass}`}
              >
                Môn học
              </th>
              <th className={columnHeaderClass}>Năm học</th>
              <th className={columnHeaderClass}>Tháng</th>
              <th className={columnHeaderClass}>SL HS đã thu</th>

              <th className={columnHeaderClass}>Số tháng thu</th>
              <th className={`bg-amber-50 ${columnHeaderClass}`}>
                Chi chính sách
              </th>
              <th className={`bg-amber-50 ${columnHeaderClass}`}>
                Phần chi (đã trừ thuế 10%)
              </th>
              <th className={`${columnHeaderClass} text-left`}>Ghi chú</th>
              <th
                className={`sticky right-0 z-40 bg-slate-100 ${columnHeaderClass}`}
              >
                Thao tác
              </th>
            </tr>
          </thead>
          {groupedRows.length ? (
            groupedRows.map(({ subject, rows: subjectRows }) => (
              <tbody key={subject.id}>
                <tr className="border-y border-blue-200 bg-blue-50">
                  <td
                    colSpan={9}
                    className="px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-blue-800"
                  >
                    Môn học: {subject.name}
                    <span className="ml-2 font-bold normal-case tracking-normal text-blue-500">
                      ({subjectRows.length} dòng)
                    </span>
                    <span className="ml-6 font-black normal-case tracking-normal text-orange-700">
                      Chi tiền mặt:{" "}
                      {formatCurrency(getSubjectCashPolicyAmount(subjectRows))}
                    </span>
                  </td>
                </tr>
                {subjectRows.map((row) => (
                  <PolicyMonthlyRow
                    key={`${subject.id}-${row.id}`}
                    row={row}
                    subject={subject}
                    disabled={disabled}
                    databaseFieldsReadonly={databaseFieldsReadonly}
                    onChange={onChange}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            ))
          ) : (
            <tbody>
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <ClipboardList size={34} className="mx-auto text-slate-300" />
                  <p className="mt-3 font-bold text-slate-500">
                    Không có dòng dữ liệu phù hợp
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Hãy thay đổi bộ lọc hoặc thêm dòng mới.
                  </p>
                </td>
              </tr>
            </tbody>
          )}
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-blue-50 text-base font-black text-slate-800 shadow-[0_-1px_0_#bfdbfe]">
                <td
                  colSpan={3}
                  className="sticky left-0 z-30 bg-blue-50 px-3 py-4 text-left text-lg text-blue-800"
                >
                  TỔNG CỘNG
                </td>
                <td className="px-3 py-3 text-right text-lg">
                  {formatCurrency(summary.totalStudents)}
                </td>
                <td />
                <td />
                <td className="px-3 py-3 text-right text-lg text-amber-700">
                  {formatCurrency(Math.round(summary.totalPolicyAfterTax))}
                </td>
                <td className="px-3 py-3 text-right text-xs font-black uppercase tracking-wide text-blue-800">
                  Tổng đề xuất đã chi
                </td>
                <td className="sticky right-0 bg-blue-50 px-3 py-3 text-right text-lg font-black text-emerald-700">
                  {formatCurrency(Math.round(summary.totalPaid))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
