import { useMemo, useState } from "react";

import { teachingSessionApi } from "@/service/teaching";
import type { SessionQuery, Teacher, TeachingSession } from "@/types/teaching";

import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
  TableCard,
  selectClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "../components/Shared";
import LessonReportModal from "../components/LessonReportModal";
import SearchableSelect from "@/components/SearchableSelect";
import { usePagedList } from "../hooks/usePagedList";
import type { RefOption } from "../hooks/useTeachingRefData";
import {
  classNameOf,
  endOfWeek,
  formatCheckedAt,
  formatDate,
  formatTime,
  isDateOrderValid,
  startOfWeek,
  todayISO,
} from "../lib";

const DEFAULT_PAGE_SIZE = 50;

const hasReport = (session: TeachingSession) =>
  !!(session.lessonName?.trim() || session.lessonEvaluation?.trim());

// Mỗi trường tự đặt khung giờ tiết riêng (không khớp một khung chuẩn chung),
// nên hiện thẳng giờ bắt đầu–kết thúc thay vì gán nhãn "2-SÁNG" dễ gây hiểu nhầm.
const periodLabel = (session: TeachingSession) =>
  `${formatTime(session.startTime)}–${formatTime(session.endTime)}`;

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
};

export default function LessonReportTab({ teachers, schools }: Props) {
  const [fromDate, setFromDate] = useState(startOfWeek(todayISO()));
  const [toDate, setToDate] = useState(endOfWeek(todayISO()));
  const [teacherId, setTeacherId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [reportFilter, setReportFilter] = useState<"" | "yes" | "no">("");
  const [detailSession, setDetailSession] = useState<TeachingSession | null>(null);

  const rangeValid = isDateOrderValid(fromDate, toDate);

  const query = useMemo<SessionQuery>(
    () => ({
      fromDate,
      toDate,
      teacherId: teacherId ? Number(teacherId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
    }),
    [fromDate, toDate, teacherId, schoolId],
  );

  const { items, pagination, page, setPage, loading } = usePagedList<
    TeachingSession,
    SessionQuery
  >({
    fetcher: teachingSessionApi.list,
    query,
    limit: DEFAULT_PAGE_SIZE,
    enabled: rangeValid,
    errorMessage: "Không tải được danh sách báo giảng",
  });

  // Chỉ những buổi đã Check-out mới có thể báo giảng — buổi chưa tới giờ dạy
  // lẫn vào đây (chưa báo) chỉ gây nhiễu số liệu "chưa báo giảng".
  const eligible = items.filter((session) => session.checkoutAt);

  const rows = eligible.filter((session) => {
    if (reportFilter === "yes") return hasReport(session);
    if (reportFilter === "no") return !hasReport(session);
    return true;
  });

  const reportedCount = eligible.filter(hasReport).length;

  const hasFilter = !!teacherId || !!schoolId || !!reportFilter;
  const clearFilters = () => {
    setTeacherId("");
    setSchoolId("");
    setReportFilter("");
  };

  return (
    <div className="space-y-3">
      <FilterCard>
        <div className="flex gap-2 items-center md:col-span-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={() => {
              setFromDate(startOfWeek(todayISO()));
              setToDate(endOfWeek(todayISO()));
            }}
            className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium whitespace-nowrap"
          >
            Tuần này
          </button>
        </div>

        {!rangeValid && (
          <p className="text-xs text-red-500 md:col-span-4">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc
          </p>
        )}

        <div className="flex gap-2 md:contents">
          <SearchableSelect
            value={teacherId}
            onChange={setTeacherId}
            options={teachers}
            placeholder="Tất cả giáo viên"
            searchPlaceholder="Tìm giáo viên…"
            className="flex-1 min-w-0"
          />

          <SearchableSelect
            value={schoolId}
            onChange={setSchoolId}
            options={schools}
            placeholder="Tất cả trường"
            searchPlaceholder="Tìm trường…"
            className="flex-1 min-w-0"
          />
        </div>

        <select
          value={reportFilter}
          onChange={(e) => setReportFilter(e.target.value as typeof reportFilter)}
          className={`${selectClass} md:col-span-2`}
        >
          <option value="">Tất cả buổi đã Check-out</option>
          <option value="yes">Đã báo giảng</option>
          <option value="no">Chưa báo giảng</option>
        </select>

        {hasFilter && (
          <div className="md:col-span-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500"
            >
              Xoá lọc
            </button>
          </div>
        )}
      </FilterCard>

      {!loading && eligible.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2">
          <span className="text-xs text-gray-500">
            Đã báo giảng{" "}
            <b className="text-emerald-700">{reportedCount}</b>/
            {eligible.length} buổi đã Check-out trong trang này
          </span>
        </div>
      )}

      {loading && <Loading />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="📝"
          title="Không có buổi báo giảng nào phù hợp"
          description={
            hasFilter
              ? "Thử đổi khoảng ngày hoặc xoá bớt bộ lọc."
              : "Chọn khoảng ngày khác — chỉ buổi đã Check-out mới có thể báo giảng."
          }
          action={
            hasFilter ? (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Xoá lọc
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <TableCard minWidth={1280}>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Dấu thời gian</th>
              <th className={thClass}>Ngày giảng dạy</th>
              <th className={thClass}>Tên trường</th>
              <th className={thClass}>Họ và tên giáo viên</th>
              <th className={thClass}>Lớp</th>
              <th className={`${thClass} text-right`}>Sĩ số tổng</th>
              <th className={`${thClass} text-right`}>Sĩ số thực học</th>
              <th className={thClass}>Tên bài học</th>
              <th className={thClass}>Tiết</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => {
              const reported = hasReport(session);

              return (
                <tr
                  key={session.id}
                  onClick={() => setDetailSession(session)}
                  className={`${trClass} cursor-pointer`}
                >
                  <td className={`${tdClass} text-xs text-gray-500`}>
                    {session.lessonSubmittedAt
                      ? formatCheckedAt(session.lessonSubmittedAt)
                      : "—"}
                  </td>
                  <td className={`${tdClass} font-medium text-gray-800`}>
                    {formatDate(session.date)}
                  </td>
                  <td className={tdClass}>{session.schoolName}</td>
                  <td className={tdClass}>{session.teacherName || "—"}</td>
                  <td className={tdClass}>{classNameOf(session)}</td>
                  <td className={`${tdClass} text-right`}>
                    {session.classStudentCount ?? "—"}
                  </td>
                  <td className={`${tdClass} text-right font-medium`}>
                    {session.actualStudentCount ?? "—"}
                  </td>
                  <td className={`${tdClass} max-w-64`}>
                    {reported ? (
                      <p
                        className="truncate text-gray-800"
                        title={session.lessonName || undefined}
                      >
                        {session.lessonName?.trim() || "Chưa cập nhật tên bài học"}
                      </p>
                    ) : (
                      <span className="text-xs font-medium text-amber-600">
                        Chưa báo giảng
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>{periodLabel(session)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={setPage}
        disabled={loading}
      />

      {detailSession && (
        <LessonReportModal session={detailSession} onClose={() => setDetailSession(null)} />
      )}
    </div>
  );
}
