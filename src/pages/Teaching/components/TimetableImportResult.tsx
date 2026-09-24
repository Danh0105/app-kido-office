import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";

import type {
  BulkResultRow,
  DraftResolution,
  TimetableCommitResult,
} from "@/types/teaching";

import { TableCard, tdClass, thClass, theadClass, trClass } from "./Shared";

/**
 * Kết quả sau khi xác nhận. Các dòng bị bỏ qua **luôn hiện, không lọc bỏ**:
 * bị bỏ qua thường là do lịch đã tồn tại hoặc trùng giờ giáo viên, và Nhân sự
 * cần biết để đi xử lý tay.
 */
export default function TimetableImportResult({
  result,
  resolution,
}: {
  result: TimetableCommitResult;
  resolution: DraftResolution;
}) {
  const navigate = useNavigate();

  // Backend chia lô 200 mẫu lịch mỗi lần gọi nên số liệu phải cộng dồn.
  const { created, sessionsCreated, skipped } = useMemo(() => {
    const batches = result.scheduleResults ?? [];
    return {
      created: batches.reduce((sum, batch) => sum + (batch.created ?? 0), 0),
      sessionsCreated: batches.reduce(
        (sum, batch) => sum + (batch.sessionsCreated ?? 0),
        0,
      ),
      skipped: batches.flatMap((batch) =>
        (batch.results ?? []).filter((row) => row.status === "SKIPPED"),
      ),
    };
  }, [result]);

  const goToSchedules = () => {
    const params = new URLSearchParams({ tab: "timetable" });
    if (resolution.schoolId) params.set("schoolId", String(resolution.schoolId));
    if (resolution.teacherId)
      params.set("teacherId", String(resolution.teacherId));
    if (resolution.schoolYear) params.set("schoolYear", resolution.schoolYear);
    navigate(`/nhan-su/lich-day?${params}`);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} /> Đã tạo xong
        </p>

        <dl className="mt-2 space-y-1 text-sm text-emerald-900">
          <Line label="Lớp tạo mới" value={result.createdClasses?.length ?? 0} />
          <Line label="Mẫu lịch tạo mới" value={created} />
          {sessionsCreated > 0 && (
            <Line label="Buổi dạy đã sinh" value={sessionsCreated} />
          )}
          {skipped.length > 0 && (
            <Line label="Dòng bị bỏ qua" value={skipped.length} warn />
          )}
        </dl>

        <button
          onClick={goToSchedules}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:scale-95"
        >
          <CalendarCheck2 size={15} /> Xem ở Thời khóa biểu
        </button>
      </div>

      {result.createdClasses?.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Lớp vừa được tạo ({result.createdClasses.length})
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-700">
            {result.createdClasses.map((item) => item.name).join(", ")}
          </p>
        </div>
      )}

      {skipped.length > 0 && <SkippedTable rows={skipped} />}
    </div>
  );
}

function SkippedTable({ rows }: { rows: BulkResultRow[] }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs leading-relaxed text-amber-700">
        {rows.length} dòng không được tạo — thường do lịch đã tồn tại hoặc giáo
        viên đã có lịch trùng giờ. Cần xử lý tay ở màn Thời khóa biểu.
      </p>

      <TableCard minWidth={640}>
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Lớp</th>
            <th className={thClass}>Trường</th>
            <th className={thClass}>Môn</th>
            <th className={thClass}>Lý do bỏ qua</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.classId}-${index}`} className={trClass}>
              <td className={`${tdClass} font-medium text-gray-800`}>
                {row.className || "—"}
              </td>
              <td className={`${tdClass} text-gray-600`}>
                {row.schoolName || "—"}
              </td>
              <td className={`${tdClass} text-gray-600`}>
                {row.subjectName || "—"}
              </td>
              <td className={`${tdClass} whitespace-normal text-amber-700`}>
                {row.reason || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}

function Line({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className={`font-semibold ${warn ? "text-amber-700" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
