import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Send, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";

import { teacherApi, teachingScheduleApi, teachingSessionApi } from "@/service/teaching";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  SESSION_STATUS_ORDER,
  SESSION_STATUS_META,
  type SessionQuery,
  type ScheduleQuery,
  type SessionStatus,
  type Teacher,
  type TeachingSession,
  type TeachingSchedule,
} from "@/types/teaching";

import SessionDetailDrawer from "../components/SessionDetailDrawer";
import { ConfirmModal } from "../components/Modal";
import SessionFormModal from "../components/SessionFormModal";
import SendScheduleModal from "../components/SendScheduleModal";
import SessionTimetable from "../components/SessionTimetable";
import {
  ScheduleResponseLegend,
  scheduleResponseOf,
} from "../components/ScheduleResponseBadge";
import SearchableSelect from "@/components/SearchableSelect";
import {
  SessionDayCalendar,
  SessionMonthCalendar,
  SessionTable,
  SessionWeekCalendar,
  type CreateAtSlot,
} from "../components/SessionViews";
import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
  RangeNav,
  StatusLegend,
  ViewSwitcher,
  selectClass,
} from "../components/Shared";
import ClassSelect from "../components/ClassSelect";
import { usePagedList } from "../hooks/usePagedList";
import {
  useClassesOfSchool,
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  addDays,
  addMonths,
  canManageTeaching,
  dayTitle,
  datesInRange,
  endOfMonth,
  endOfWeek,
  formatDate,
  formatTime,
  monthGridDates,
  monthTitle,
  plannedFromSchedules,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekTitle,
} from "../lib";

// BE trả cả tuần trong 1 query — không gọi 7 request theo ngày.
const PAGE_SIZE = 200;

/** Bộ lọc hiện cả lớp đã ngừng dùng — buổi dạy cũ vẫn gắn với lớp đó. */
const ALL_CLASSES = { activeOnly: false };

type ViewMode = "day" | "week" | "timetable" | "month" | "list";

const VIEW_OPTIONS: [ViewMode, string][] = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  // Cùng khoảng ngày với "Tuần" nhưng đọc theo tiết × thứ như TKB giấy.
  ["timetable", "TKB"],
  ["month", "Tháng"],
  ["list", "Danh sách"],
];

/** Các chế độ xem theo tuần — dùng chung khoảng ngày và bước lùi/tiến. */
const WEEK_VIEWS: ViewMode[] = ["week", "timetable"];

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
  /** Tăng khi mẫu lịch sinh buổi mới → tải lại danh sách. */
  reloadToken: number;
  /** Mở thẳng buổi từ notification Nhân sự nhận được. */
  focusSessionId?: number;
};

export default function SessionTab({
  teachers,
  schools,
  reloadToken,
  focusSessionId,
}: Props) {
  const canManage = canManageTeaching();

  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(todayISO());

  const [teacherId, setTeacherId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [unchecked, setUnchecked] = useState(false);
  const [declinedOnly, setDeclinedOnly] = useState(false);
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false);

  const [selected, setSelected] = useState<TeachingSession | null>(null);
  const [formTarget, setFormTarget] = useState<
    TeachingSession | null | undefined
  >(undefined);
  const [makeupFor, setMakeupFor] = useState<TeachingSession | null>(null);
  // Ngày/giờ bấm trên lịch → điền sẵn vào form thêm buổi.
  const [createSlot, setCreateSlot] = useState<{
    date: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [sending, setSending] = useState(false);

  /** Bấm ô trống trên lịch = thêm buổi lẻ cho đúng ngày/giờ vừa bấm. */
  const createAtSlot: CreateAtSlot = (date, startTime, endTime) => {
    setMakeupFor(null);
    setCreateSlot({ date, startTime, endTime });
    setFormTarget(null);
  };

  const { subjects } = useSubjectsOfSchool(schoolId);
  const { classes, loading: loadingClasses } = useClassesOfSchool(
    schoolId,
    ALL_CLASSES,
  );

  // Đổi trường → bỏ lớp và môn đang lọc (cả hai đều thuộc về trường).
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setClassId("");
    setSubjectId("");
  };

  // Khoảng ngày tải về theo chế độ xem.
  const { fromDate, toDate } = useMemo(() => {
    if (view === "day") {
      return { fromDate: anchor, toDate: anchor };
    }
    if (view === "month") {
      const cells = monthGridDates(anchor);
      return { fromDate: cells[0], toDate: cells[cells.length - 1] };
    }
    if (view === "list") {
      return { fromDate: startOfMonth(anchor), toDate: endOfMonth(anchor) };
    }
    // "Tuần" và "TKB" cùng lấy trọn tuần chứa `anchor`.
    return { fromDate: startOfWeek(anchor), toDate: endOfWeek(anchor) };
  }, [view, anchor]);

  const query = useMemo<SessionQuery>(
    () => ({
      fromDate,
      toDate,
      teacherId: teacherId ? Number(teacherId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      classId: classId ? Number(classId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
      status: status || undefined,
      unchecked: unchecked || undefined,
    }),
    [
      fromDate,
      toDate,
      teacherId,
      schoolId,
      classId,
      subjectId,
      status,
      unchecked,
    ],
  );

  const { items, pagination, page, setPage, loading, reload } = usePagedList<
    TeachingSession,
    SessionQuery
  >({
    fetcher: teachingSessionApi.list,
    query,
    limit: PAGE_SIZE,
    errorMessage: "Không tải được danh sách buổi dạy",
  });

  const pendingScheduleQuery = useMemo<ScheduleQuery>(
    () => ({
      confirmationStatus: "PENDING",
      teacherId: teacherId ? Number(teacherId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      classId: classId ? Number(classId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
    }),
    [teacherId, schoolId, classId, subjectId],
  );
  const { items: pendingSchedules } = usePagedList<TeachingSchedule, ScheduleQuery>({
    fetcher: teachingScheduleApi.list,
    query: pendingScheduleQuery,
    limit: PAGE_SIZE,
    enabled: view === "timetable" || unconfirmedOnly,
    errorMessage: "Không tải được các lịch chưa xác nhận",
  });

  const pendingCalendarItems = useMemo(
    () =>
      plannedFromSchedules(
        pendingSchedules,
        datesInRange(fromDate, toDate),
        items,
        { includePast: true },
      ).map((item) => ({
        ...item,
        scheduleResponseStatus: "PENDING" as const,
      })),
    [pendingSchedules, fromDate, toDate, items],
  );

  const rejectedQuery = useMemo<ScheduleQuery>(
    () => ({
      confirmationStatus: "REJECTED",
      teacherId: teacherId ? Number(teacherId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      classId: classId ? Number(classId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
    }),
    [teacherId, schoolId, classId, subjectId],
  );
  const { items: rejectedSchedules, reload: reloadRejected } = usePagedList<TeachingSchedule, ScheduleQuery>({
    fetcher: teachingScheduleApi.list,
    query: rejectedQuery,
    limit: 100,
    enabled: declinedOnly,
    errorMessage: "Không tải được các tiết giáo viên từ chối",
  });

  const rejectedCalendarItems = useMemo(
    () =>
      plannedFromSchedules(
        rejectedSchedules.filter(
          (item) => String(item.confirmationStatus).toUpperCase() === "REJECTED",
        ),
        datesInRange(fromDate, toDate),
        [],
        { includePast: true },
      ).map((item) => ({
        ...item,
        rejectedTemplate: true,
        scheduleResponseStatus: "DECLINED" as const,
        declinedAt: rejectedSchedules.find((schedule) => schedule.id === item.scheduleId)?.confirmedAt,
        declineReason: rejectedSchedules.find((schedule) => schedule.id === item.scheduleId)?.rejectionReason,
        declinedTeacherName: item.teacherName,
      })),
    [rejectedSchedules, fromDate, toDate],
  );

  // Notification có thể trỏ tới buổi nằm ngoài tuần/tháng đang xem, nên tải
  // trực tiếp theo id thay vì phụ thuộc danh sách hiện tại.
  const openedNotificationRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focusSessionId || openedNotificationRef.current === focusSessionId) return;
    openedNotificationRef.current = focusSessionId;
    teachingSessionApi
      .findOne(focusSessionId)
      .then(setSelected)
      .catch(() => {
        // Danh sách vẫn dùng bình thường nếu notification đã cũ hoặc buổi bị xoá.
      });
  }, [focusSessionId]);

  // Sinh buổi dạy ở tab mẫu lịch xong → làm mới danh sách buổi.
  // Bỏ qua lần chạy đầu: khi mount, usePagedList đã tự tải.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  /** Lùi/tiến 1 ngày, 1 tuần hoặc 1 tháng theo chế độ đang xem. */
  const shift = (direction: 1 | -1) => {
    if (view === "day") return setAnchor(addDays(anchor, direction));
    if (WEEK_VIEWS.includes(view)) {
      return setAnchor(addDays(anchor, 7 * direction));
    }
    setAnchor(addMonths(anchor, direction));
  };

  const navTitle =
    view === "day"
      ? dayTitle(anchor)
      : WEEK_VIEWS.includes(view)
      ? weekTitle(anchor)
      : monthTitle(anchor);

  const hasFilter =
    !!teacherId ||
    !!schoolId ||
    !!classId ||
    !!subjectId ||
    !!status ||
    unchecked ||
    declinedOnly ||
    unconfirmedOnly;

  // Buổi bị từ chối được mở lại và gỡ teacherId, vì vậy không thể tìm bằng
  // bộ lọc giáo viên hiện tại. Lọc theo dấu vết từ chối mà BE giữ trên buổi.
  const declinedItems = useMemo(
    () => items.filter((item) => scheduleResponseOf(item) === "DECLINED"),
    [items],
  );
  const visibleItems = useMemo(() => {
    const source = declinedOnly
      ? rejectedCalendarItems
      : view === "timetable" || unconfirmedOnly
        ? [...items, ...pendingCalendarItems]
        : items;
    return unconfirmedOnly
      ? source.filter((item) => scheduleResponseOf(item) === "PENDING")
      : source;
  }, [declinedOnly, rejectedCalendarItems, view, items, pendingCalendarItems, unconfirmedOnly]);
  const [rejectedDetail, setRejectedDetail] = useState<TeachingSchedule | null>(null);
  const [replacementTeacherId, setReplacementTeacherId] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [replacementOptions, setReplacementOptions] = useState<RefOption[]>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [deleteScheduleTarget, setDeleteScheduleTarget] =
    useState<TeachingSchedule | null>(null);
  const [deleteScheduleError, setDeleteScheduleError] = useState("");
  const [deletingSchedule, setDeletingSchedule] = useState(false);

  useEffect(() => {
    if (!rejectedDetail) {
      setReplacementOptions([]);
      return;
    }
    let active = true;
    setLoadingReplacements(true);
    teacherApi.candidates({
      schoolId: rejectedDetail.schoolId,
      subjectId: rejectedDetail.subjectId,
      dayOfWeek: rejectedDetail.dayOfWeek,
      startTime: rejectedDetail.startTime,
      endTime: rejectedDetail.endTime,
      effectiveFrom: rejectedDetail.effectiveFrom,
      effectiveTo: rejectedDetail.effectiveTo,
      periods: rejectedDetail.periods || 1,
      exceptScheduleId: rejectedDetail.id,
    }).then((result) => {
      if (!active) return;
      setReplacementOptions(result.candidates
        .filter((candidate) => candidate.eligible && candidate.teacherId !== rejectedDetail.teacherId)
        .map((candidate) => ({ id: candidate.teacherId, name: candidate.teacherName })));
    }).catch((error) => {
      if (active) toast.error(getApiErrorMessage(error, "Không tải được giáo viên đang trống lịch"));
    }).finally(() => active && setLoadingReplacements(false));
    return () => { active = false; };
  }, [rejectedDetail]);

  const openSession = (session: TeachingSession) => {
    if ((session as TeachingSession & { rejectedTemplate?: boolean }).rejectedTemplate) {
      const schedule = rejectedSchedules.find((item) => item.id === session.scheduleId);
      if (schedule) {
        setReplacementTeacherId("");
        setRejectedDetail(schedule);
      }
      return;
    }
    if (session.fromTemplate) return;
    setSelected(session);
  };

  const replaceRejectedTeacher = async () => {
    if (!rejectedDetail || !replacementTeacherId) return;
    setReplacing(true);
    try {
      await teachingScheduleApi.update(rejectedDetail.id, {
        teacherId: Number(replacementTeacherId),
      });
      toast.success("Đã xếp giáo viên khác, chờ giáo viên mới xác nhận");
      setRejectedDetail(null);
      await Promise.all([reloadRejected(), reload()]);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xếp giáo viên khác thất bại"));
      }
    } finally {
      setReplacing(false);
    }
  };

  /** Không xếp được giáo viên khác thì bỏ hẳn mẫu lịch bị từ chối. */
  const removeRejectedSchedule = async () => {
    if (!deleteScheduleTarget) return;
    setDeletingSchedule(true);
    setDeleteScheduleError("");
    try {
      await teachingScheduleApi.remove(deleteScheduleTarget.id);
      toast.success("Đã xoá lịch bị từ chối");
      setDeleteScheduleTarget(null);
      setRejectedDetail(null);
      await Promise.all([reloadRejected(), reload()]);
    } catch (error: any) {
      // 409 = mẫu đã có buổi chấm công; giữ modal để đọc lý do.
      if (error?.response?.status === 409) {
        setDeleteScheduleError(
          getApiErrorMessage(error, "Lịch đã có buổi chấm công, không xoá được"),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá lịch thất bại"));
      }
    } finally {
      setDeletingSchedule(false);
    }
  };

  const clearFilters = () => {
    setTeacherId("");
    setSchoolId("");
    setClassId("");
    setSubjectId("");
    setStatus("");
    setUnchecked(false);
    setDeclinedOnly(false);
    setUnconfirmedOnly(false);
  };

  const truncated = view !== "list" && pagination.total > items.length;

  const handleChanged = () => {
    setSelected(null);
    reload();
  };

  return (
    <div className="space-y-3">
      {/* Chế độ xem + điều hướng kỳ — desktop gộp về một hàng */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
        <ViewSwitcher<ViewMode>
          value={view}
          options={VIEW_OPTIONS}
          onChange={setView}
        />

        <div className="md:flex-1">
          <RangeNav
            title={navTitle}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={() => setAnchor(todayISO())}
          />
        </div>

        {canManage && (
          <button
            onClick={() => setSending(true)}
            disabled={loading || items.length === 0}
            className="w-full md:w-auto flex items-center justify-center gap-1 py-2 md:px-4 rounded-xl bg-blue-500 text-white text-sm font-medium active:scale-95 disabled:opacity-50"
          >
            <Send size={15} /> Gửi lịch dạy
          </button>
        )}
      </div>

      {/* Bộ lọc */}
      <FilterCard>
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
            onChange={changeSchool}
            options={schools}
            placeholder="Tất cả trường"
            searchPlaceholder="Tìm trường…"
            className="flex-1 min-w-0"
          />
        </div>

        <div className="flex gap-2 md:contents">
          <ClassSelect
            value={classId}
            onChange={setClassId}
            classes={classes}
            loading={loadingClasses}
            schoolPicked={!!schoolId}
            placeholder="Tất cả lớp"
            className={`flex-1 min-w-0 ${selectClass}`}
          />

          <SearchableSelect
            value={subjectId}
            onChange={setSubjectId}
            options={subjects}
            disabled={!schoolId}
            placeholder={schoolId ? "Tất cả môn" : "Chọn trường trước"}
            searchPlaceholder="Tìm môn học…"
            className="flex-1 min-w-0"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SessionStatus | "")}
            className={`flex-1 min-w-0 ${selectClass}`}
          >
            <option value="">Tất cả trạng thái</option>
            {SESSION_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {SESSION_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 md:col-span-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={unchecked}
                onChange={(e) => setUnchecked(e.target.checked)}
              />
              Chỉ buổi chưa chấm
            </label>
            <label className="flex items-center gap-1.5 text-sm font-medium text-rose-700">
              <input
                type="checkbox"
                checked={declinedOnly}
                onChange={(e) => {
                  setDeclinedOnly(e.target.checked);
                  if (e.target.checked) setUnconfirmedOnly(false);
                }}
              />
              Giáo viên từ chối
            </label>
            <label className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
              <input
                type="checkbox"
                checked={unconfirmedOnly}
                onChange={(e) => {
                  setUnconfirmedOnly(e.target.checked);
                  if (e.target.checked) setDeclinedOnly(false);
                }}
              />
              Chưa được giáo viên xác nhận
            </label>
          </div>

          {hasFilter && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500"
            >
              Xoá lọc
            </button>
          )}
        </div>
      </FilterCard>

      {!loading && declinedItems.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2 border-b border-rose-200 px-3 py-2.5 text-rose-800">
            <AlertTriangle size={17} />
            <h3 className="text-sm font-semibold">
              {declinedItems.length} tiết giáo viên đã từ chối
            </h3>
          </div>
          <div className="divide-y divide-rose-100">
            {declinedItems.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => openSession(session)}
                className="block w-full px-3 py-2.5 text-left transition hover:bg-rose-100/60 active:bg-rose-100"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-rose-900">
                    {session.declinedTeacherName ||
                      session.teacherName ||
                      "Giáo viên được phân công"}
                  </span>
                  <span className="text-xs font-medium text-rose-700">
                    {formatDate(session.date)} · {formatTime(session.startTime)}–{formatTime(session.endTime)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-700">
                  {session.subjectName} · {session.schoolName}
                  {session.className ? ` · Lớp ${session.className}` : ""}
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  <span className="font-semibold">Lý do:</span>{" "}
                  {session.declineReason || "Không có ghi chú"}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {truncated && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Đang hiển thị {items.length}/{pagination.total} buổi. Hãy lọc thêm theo
          giáo viên hoặc trường để xem đầy đủ.
        </div>
      )}

      {loading && <Loading />}

      {/* Lịch luôn hiển thị kể cả khi rỗng — nhìn được khung giờ trống. */}
      {!loading && view !== "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <StatusLegend />
            <ScheduleResponseLegend />
            {canManage && view !== "timetable" && (
              <p className="text-[10px] text-blue-500">
                {view === "month"
                  ? "Bấm ô ngày để thêm buổi"
                  : "Bấm ô giờ trống để thêm buổi"}
              </p>
            )}
            {view === "timetable" && (
              <p className="text-[10px] text-blue-500">
                Bấm vào lớp hoặc giáo viên để mở chi tiết buổi
              </p>
            )}
          </div>

          {view === "timetable" && (
            <SessionTimetable
              anchorDate={anchor}
              sessions={visibleItems}
              onSelect={openSession}
              teachers={teachers}
            />
          )}

          {view === "day" && (
            <SessionDayCalendar
              anchorDate={anchor}
              sessions={visibleItems}
              onSelect={openSession}
              onCreate={canManage ? createAtSlot : undefined}
            />
          )}
          {view === "week" && (
            <SessionWeekCalendar
              anchorDate={anchor}
              sessions={visibleItems}
              onSelect={openSession}
              onCreate={canManage ? createAtSlot : undefined}
            />
          )}
          {view === "month" && (
            <SessionMonthCalendar
              anchorDate={anchor}
              sessions={visibleItems}
              onSelect={openSession}
              onCreate={canManage ? createAtSlot : undefined}
            />
          )}

          {visibleItems.length === 0 && (
            <p className="text-xs text-gray-400 text-center px-4 leading-relaxed">
              {hasFilter
                ? "Không có buổi dạy nào khớp bộ lọc trong khoảng này."
                : canManage
                ? "Chưa có buổi dạy nào. Tạo mẫu lịch tuần rồi bấm “Sinh buổi dạy”, hoặc bấm vào ô trống trên lịch để thêm buổi lẻ."
                : "Chưa có buổi dạy nào trong khoảng này."}
            </p>
          )}
        </>
      )}

      {!loading && view === "list" && (
        <>
          {visibleItems.length > 0 ? (
            <SessionTable sessions={visibleItems} onSelect={openSession} />
          ) : (
            <EmptyState
              icon="📅"
              title="Không có buổi dạy nào trong khoảng này"
              description={
                hasFilter
                  ? "Thử đổi khoảng thời gian hoặc xoá bớt bộ lọc."
                  : "Tạo mẫu lịch tuần rồi bấm “Sinh buổi dạy”, hoặc mở lịch Ngày/Tuần/Tháng rồi bấm vào ô trống để thêm buổi lẻ."
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

          <Pagination
            page={page}
            totalPages={pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}

      {selected && (
        <SessionDetailDrawer
          session={selected}
          canManage={canManage}
          teachers={teachers}
          onClose={() => setSelected(null)}
          onChanged={handleChanged}
          onEdit={(session) => {
            setSelected(null);
            setMakeupFor(null);
            setCreateSlot(null);
            setFormTarget(session);
          }}
          onCreateMakeup={(session) => {
            setSelected(null);
            setCreateSlot(null);
            setMakeupFor(session);
            setFormTarget(null);
          }}
        />
      )}

      {rejectedDetail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRejectedDetail(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle size={19} />
                <h3 className="font-bold">Chi tiết lịch bị từ chối</h3>
              </div>
              <button type="button" onClick={() => setRejectedDetail(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
                <span className="text-gray-500">Giáo viên</span><b className="text-rose-700">{rejectedDetail.teacherName}</b>
                <span className="text-gray-500">Trường</span><b>{rejectedDetail.schoolName}</b>
                <span className="text-gray-500">Lớp</span><b>{rejectedDetail.className || "Chưa gắn lớp"}</b>
                <span className="text-gray-500">Môn</span><b>{rejectedDetail.subjectName}</b>
                <span className="text-gray-500">Thời gian</span><b>{rejectedDetail.dayOfWeekLabel} · {formatTime(rejectedDetail.startTime)}–{formatTime(rejectedDetail.endTime)}</b>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
                <p className="text-xs font-semibold uppercase">Lý do từ chối</p>
                <p className="mt-1 whitespace-pre-wrap">{rejectedDetail.rejectionReason || "Không có lý do"}</p>
              </div>
              {canManage && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-2 font-semibold text-gray-800">Chọn giáo viên khác</p>
                  <SearchableSelect
                    value={replacementTeacherId}
                    onChange={setReplacementTeacherId}
                    options={replacementOptions}
                    disabled={loadingReplacements}
                    placeholder={loadingReplacements ? "Đang tìm giáo viên trống lịch…" : "— Chọn giáo viên phù hợp —"}
                    searchPlaceholder="Tìm giáo viên…"
                    emptyLabel="Không có giáo viên phù hợp và trống lịch"
                  />
                  <button type="button" onClick={replaceRejectedTeacher} disabled={!replacementTeacherId || replacing} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50">
                    {replacing ? "Đang lưu…" : "Xếp giáo viên này"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteScheduleError("");
                      setDeleteScheduleTarget(rejectedDetail);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2.5 font-semibold text-red-600 active:scale-95"
                  >
                    <Trash2 size={15} /> Xoá lịch này
                  </button>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                    Xoá mẫu lịch khỏi thời khoá biểu, kèm các buổi chưa chấm công
                    đã sinh từ mẫu này.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteScheduleTarget && (
        <ConfirmModal
          title="Xoá lịch bị từ chối"
          message={
            deleteScheduleError ? (
              <span className="text-red-600">{deleteScheduleError}</span>
            ) : (
              <>
                Xoá lịch <b>{deleteScheduleTarget.className || "—"}</b> ·{" "}
                <b>{deleteScheduleTarget.teacherName}</b> (
                {deleteScheduleTarget.dayOfWeekLabel}{" "}
                {formatTime(deleteScheduleTarget.startTime)}–
                {formatTime(deleteScheduleTarget.endTime)})? Các buổi dạy đã sinh
                từ lịch này cũng bị xoá.
              </>
            )
          }
          hint={
            deleteScheduleError
              ? "Lịch đã có buổi được chấm công nên không xoá được."
              : undefined
          }
          submitLabel={deleteScheduleError ? "Đóng" : "Xoá"}
          submitColor={deleteScheduleError ? "bg-gray-400" : "bg-red-500"}
          loading={deletingSchedule}
          onClose={() => {
            setDeleteScheduleTarget(null);
            setDeleteScheduleError("");
          }}
          onSubmit={() =>
            deleteScheduleError
              ? setDeleteScheduleTarget(null)
              : removeRejectedSchedule()
          }
        />
      )}

      {sending && (
        <SendScheduleModal
          payload={{
            fromDate,
            toDate,
            teacherId: teacherId ? Number(teacherId) : undefined,
            schoolId: schoolId ? Number(schoolId) : undefined,
            classId: classId ? Number(classId) : undefined,
            subjectId: subjectId ? Number(subjectId) : undefined,
          }}
          rangeLabel={navTitle}
          sessions={items}
          onClose={() => setSending(false)}
        />
      )}

      {formTarget !== undefined && (
        <SessionFormModal
          session={formTarget}
          makeupFor={makeupFor}
          teachers={teachers}
          schools={schools}
          defaultDate={createSlot?.date || anchor}
          defaultStartTime={createSlot?.startTime}
          defaultEndTime={createSlot?.endTime}
          onClose={() => {
            setFormTarget(undefined);
            setMakeupFor(null);
            setCreateSlot(null);
          }}
          onSaved={reload}
        />
      )}
    </div>
  );
}
