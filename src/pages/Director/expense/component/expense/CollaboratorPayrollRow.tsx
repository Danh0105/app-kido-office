import { useEffect, useState } from "react";
import { Eye, Loader2, RefreshCw } from "lucide-react";

import {
  collaboratorPayrollApi,
  type CollaboratorPayrollSubject,
} from "@/service/collaboratorPayroll";
import { getApiErrorMessage } from "@/utils/apiError";
import CollaboratorPayrollModal from "../../components/CollaboratorPayroll/CollaboratorPayrollModal";
import {
  formatPayrollMoney,
  monthLabel,
  monthRange,
  payrollWarnings,
  type MonthOption,
} from "../../utils/collaboratorPayroll";

/** Trường + môn + tháng của kỳ thu chi đang xem. */
export type CollaboratorPayrollScope = {
  schoolId: number;
  subjectId: number;
  /** null = kỳ tuỳ chỉnh (không gắn tháng dương lịch). */
  month: MonthOption | null;
  schoolName?: string;
  subjectName?: string;
};

type Props = {
  scope: CollaboratorPayrollScope;
  /** Cùng lưới cột với bảng Chi Trường để số nằm đúng cột. */
  gridClass: string;
};

const cellClass =
  "flex min-h-[64px] flex-col items-center justify-center border-r border-amber-200 px-2 py-2 text-center text-sm";

/**
 * Dòng "Lương GV CTV" ở bảng Chi Trường: tổng lương giáo viên cộng tác viên
 * của môn trong tháng của kỳ, tính từ chấm công. Chỉ hiển thị — không lưu,
 * không cộng vào Tổng chi trường.
 */
export default function CollaboratorPayrollRow({ scope, gridClass }: Props) {
  const [subject, setSubject] = useState<CollaboratorPayrollSubject | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const { schoolId, subjectId, month } = scope;

  useEffect(() => {
    setSubject(null);
    setError("");
    if (!month) return;
    let active = true;
    setLoading(true);
    collaboratorPayrollApi
      .summary({ ...monthRange(month.month, month.year), schoolId, subjectId })
      .then((result) => {
        if (!active) return;
        const found =
          result.schools
            .find((school) => school.schoolId === schoolId)
            ?.subjects.find((item) => item.subjectId === subjectId) || null;
        setSubject(found);
      })
      .catch((err) => {
        if (active) {
          setError(getApiErrorMessage(err, "Không tải được lương GV CTV"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId, subjectId, month?.month, month?.year, reloadKey]);

  const warnings = subject ? payrollWarnings(subject) : [];
  const amount = subject?.totalAmount ?? 0;
  const canOpen = !!subject && !loading;

  let note = "Chỉ hiển thị, không cộng vào Tổng chi trường";
  if (!month) note = "Kỳ tuỳ chỉnh không gắn tháng — xem tab Lương GV CTV";
  else if (error) note = error;
  else if (!loading && !subject) note = "Chưa có buổi GV CTV trong tháng";
  else if (warnings.length) note = warnings.join(" · ");

  return (
    <>
      <div
        className={`${gridClass} border-y-2 border-dashed border-amber-300 bg-amber-50 text-slate-700`}
        data-testid="ctv-payroll-row"
      >
        {/* Nội dung */}
        <div className={`${cellClass} items-start text-left`}>
          <span className="font-bold text-amber-900">👩‍🏫 Lương GV CTV</span>
          <span className="text-xs text-amber-800">
            {month ? `Chấm công ${monthLabel(month)}` : "Kỳ tuỳ chỉnh"}
          </span>
          {/* Cột "Chi trường" nằm xa bên phải — nhắc số tiền ngay đầu dòng. */}
          {subject && (
            <span className="text-sm font-bold tabular-nums text-amber-900">
              {formatPayrollMoney(amount)} đ
            </span>
          )}
          {canOpen && (
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="mt-1 inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
            >
              <Eye size={13} /> Chi tiết {subject.teacherCount} GV
            </button>
          )}
        </div>
        {/* Số tiết */}
        <div className={`${cellClass} font-semibold tabular-nums`}>
          {subject ? subject.payablePeriods : "—"}
        </div>
        {/* HS */}
        <div className={cellClass}>—</div>
        {/* Tháng */}
        <div className={cellClass}>{month ? monthLabel(month) : "—"}</div>
        {/* ĐG CSVC, CSVC, ĐG giáo viên, Giáo viên, ĐG thuế, Thuế */}
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        {/* Chi trường */}
        <div className={`${cellClass} font-bold text-amber-800`}>
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <span className="tabular-nums">{formatPayrollMoney(amount)}</span>
          )}
          <span className="text-[11px] font-medium text-amber-700">
            không cộng tổng
          </span>
        </div>
        {/* Hình thức chi, Ngày chi, Nguồn chi, Đã chi, Còn lại, Người chi */}
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        <div className={cellClass} />
        {/* Ghi chú */}
        <div className={`${cellClass} text-xs text-amber-800`}>{note}</div>
        {/* Thao tác */}
        <div className="flex min-h-[64px] items-center justify-center gap-1">
          {canOpen && (
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              title="Xem lương từng giáo viên"
              aria-label="Xem lương từng giáo viên"
              className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-100"
            >
              <Eye size={16} />
            </button>
          )}
          {error && (
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              title="Tải lại"
              aria-label="Tải lại lương GV CTV"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {showDetail && subject && month && (
        <CollaboratorPayrollModal
          title={`Lương GV CTV — ${
            [subject.subjectCode, subject.subjectName]
              .filter(Boolean)
              .join(" • ") ||
            scope.subjectName ||
            "Môn"
          }`}
          subtitle={`${scope.schoolName ? `${scope.schoolName} · ` : ""}Chấm công tháng ${monthLabel(month)}`}
          subjects={[subject]}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
