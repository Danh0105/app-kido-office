import { useEffect, useState } from "react";

import { teachingSessionApi } from "@/service/teaching";
import { getApiErrorMessage } from "@/utils/apiError";
import type { TeachingSession } from "@/types/teaching";

import Modal from "./Modal";
import { EmptyState, Loading } from "./Shared";
import { formatDate } from "../lib";

/** Tối đa backend trả trong 1 trang (`MAX_LIMIT` của danh sách buổi dạy). */
const PAGE_LIMIT = 200;

export type MissingRateFilter = {
  fromDate: string;
  toDate: string;
  /** Bỏ trống = mọi giáo viên (dòng Tổng cộng). */
  teacherId?: number;
  teacherName?: string;
  schoolId?: number;
  classId?: number;
};

/**
 * Chi tiết "thiếu giá N buổi" của bảng tổng hợp: các buổi đã chấm "Có dạy"
 * nhưng chưa có đơn giá tiết (backend lọc `missingRate` cùng điều kiện với
 * con số trên bảng).
 */
export default function MissingRateSessionsModal({
  filter,
  onClose,
}: {
  filter: MissingRateFilter;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teachingSessionApi
      .list({
        fromDate: filter.fromDate,
        toDate: filter.toDate,
        teacherId: filter.teacherId,
        schoolId: filter.schoolId,
        classId: filter.classId,
        missingRate: true,
        limit: PAGE_LIMIT,
      })
      .then((res) => {
        if (cancelled) return;
        setSessions(res?.data || []);
        setTotal(res?.pagination?.total ?? res?.data?.length ?? 0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Không tải được danh sách buổi"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const showTeacher = !filter.teacherId;
  const title = filter.teacherName
    ? `Buổi thiếu giá — ${filter.teacherName}`
    : "Buổi thiếu giá";

  return (
    <Modal title={title} wide cancelLabel="Đóng" onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Buổi đã chấm <b>Có dạy</b> nhưng chưa có đơn giá/tiết nên tiền tiết
          dạy chưa được tính. Đơn giá được chốt theo đơn giá/tiết mặc định của
          giáo viên tại lúc gán buổi. ({formatDate(filter.fromDate)} –{" "}
          {formatDate(filter.toDate)})
        </p>

        {loading ? (
          <Loading />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : sessions.length === 0 ? (
          <EmptyState title="Không có buổi thiếu giá" />
        ) : (
          <>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ngày</th>
                    <th className="px-3 py-2 text-left font-semibold">Giờ</th>
                    {showTeacher && (
                      <th className="px-3 py-2 text-left font-semibold">
                        Giáo viên
                      </th>
                    )}
                    <th className="px-3 py-2 text-left font-semibold">Trường</th>
                    <th className="px-3 py-2 text-left font-semibold">Lớp</th>
                    <th className="px-3 py-2 text-left font-semibold">Môn</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Số tiết
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-t border-slate-100 hover:bg-amber-50/50"
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {session.dayOfWeekLabel
                          ? `${session.dayOfWeekLabel}, `
                          : ""}
                        {formatDate(session.date)}
                        {session.isMakeup && (
                          <span className="ml-1 rounded bg-purple-50 px-1.5 text-xs text-purple-700">
                            bù
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-gray-700">
                        {session.startTime}–{session.endTime}
                      </td>
                      {showTeacher && (
                        <td className="px-3 py-2 text-gray-800">
                          {session.teacherName || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-gray-800">
                        {session.schoolName}
                        {session.locationName ? ` · ${session.locationName}` : ""}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {session.className || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {session.subjectName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                        {session.periods ?? 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              {total > sessions.length
                ? `Hiển thị ${sessions.length}/${total} buổi đầu tiên.`
                : `${total} buổi.`}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
