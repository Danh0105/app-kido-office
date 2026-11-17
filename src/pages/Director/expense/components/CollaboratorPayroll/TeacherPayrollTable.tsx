import type {
  CollaboratorPayrollSubject,
  CollaboratorPayrollTeacher,
} from "@/service/collaboratorPayroll";
import {
  formatPayrollMoney,
  formatRateRange,
  payrollWarnings,
} from "../../utils/collaboratorPayroll";

type Props = {
  teachers: CollaboratorPayrollTeacher[];
  /** Dòng tổng cuối bảng — thường là môn chứa các giáo viên này. */
  total?: Pick<
    CollaboratorPayrollSubject,
    | "presentSessions"
    | "payablePeriods"
    | "teachingAmount"
    | "otherCostsAmount"
    | "totalAmount"
  >;
};

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide";
const td = "px-3 py-2 text-sm";
const num = `${td} text-right tabular-nums`;

/** Lương từng giáo viên CTV: buổi, tiết, đơn giá, tiền dạy, chi phí khác. */
export default function TeacherPayrollTable({ teachers, total }: Props) {
  if (!teachers.length) {
    return (
      <p className="px-3 py-4 text-sm text-slate-500">
        Chưa có giáo viên cộng tác viên nào.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className={th}>Giáo viên</th>
            <th className={`${th} text-right`}>Buổi dạy</th>
            <th className={`${th} text-right`}>Số tiết</th>
            <th className={`${th} text-right`}>Đơn giá tiết</th>
            <th className={`${th} text-right`}>Tiền dạy</th>
            <th className={`${th} text-right`}>Chi phí khác</th>
            <th className={`${th} text-right`}>Tổng lương</th>
            <th className={th}>Lưu ý</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => {
            const warnings = payrollWarnings(teacher);
            return (
              <tr
                key={teacher.teacherId}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className={`${td} font-medium text-slate-800`}>
                  {teacher.teacherName}
                </td>
                <td className={num}>{teacher.presentSessions}</td>
                <td className={num}>{teacher.payablePeriods}</td>
                <td className={num}>
                  {formatRateRange(teacher.minRate, teacher.maxRate)}
                </td>
                <td className={num}>
                  {formatPayrollMoney(teacher.teachingAmount)}
                </td>
                <td className={num}>
                  {formatPayrollMoney(teacher.otherCostsAmount)}
                </td>
                <td className={`${num} font-bold text-indigo-700`}>
                  {formatPayrollMoney(teacher.totalAmount)}
                </td>
                <td className={`${td} text-xs text-amber-700`}>
                  {warnings.join(" · ") || ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        {total && (
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className={td}>Tổng cộng</td>
              <td className={num}>{total.presentSessions}</td>
              <td className={num}>{total.payablePeriods}</td>
              <td className={num} />
              <td className={num}>{formatPayrollMoney(total.teachingAmount)}</td>
              <td className={num}>
                {formatPayrollMoney(total.otherCostsAmount)}
              </td>
              <td className={`${num} text-indigo-700`}>
                {formatPayrollMoney(total.totalAmount)}
              </td>
              <td className={td} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
