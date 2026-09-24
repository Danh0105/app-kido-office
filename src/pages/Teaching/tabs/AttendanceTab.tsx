import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Check, MapPin, Plus, RotateCcw, Save, X } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import {
  formatDistance,
  googleMapsUrl,
  isValidLatLng,
  type LatLng,
} from "@/utils/geo";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { teacherApi, teachingScheduleApi, teachingSessionApi } from "@/service/teaching";
import {
  ATTENDANCE_OPTIONS,
  type AttendanceGrandTotal,
  SESSION_STATUS_META,
  type BulkAttendanceItem,
  type AttendanceOtherCost,
  type SessionQuery,
  type ScheduleQuery,
  type SessionStatus,
  type Teacher,
  type TeachingSchedule,
  type TeachingSession,
} from "@/types/teaching";

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
import { MakeupBadge } from "../components/SessionStatusBadge";
import { ConfirmModal } from "../components/Modal";
import SearchableSelect from "@/components/SearchableSelect";
import AttendanceCostsModal from "../components/AttendanceCostsModal";
import SessionTimetable from "../components/SessionTimetable";
import SessionDetailDrawer from "../components/SessionDetailDrawer";
import SessionFormModal from "../components/SessionFormModal";
import { usePagedList } from "../hooks/usePagedList";
import { fetchAllPages } from "../pagedList";
import {
  VUNG_TAU_REGION_ID,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  canManageTeaching,
  canSetTeachingRates,
  classNameOf,
  endOfWeek,
  formatCheckedAt,
  formatDate,
  formatFuelAllowance,
  formatMoney,
  formatTime,
  isDateOrderValid,
  isCheckoutOverdue,
  isValidPeriods,
  datesInRange,
  plannedFromSchedules,
  periodsOf,
  hasGasAllowance,
  MAX_PERIODS,
  RATE_MISSING_LABEL,
  startOfWeek,
  TEACHING_MONEY_FEATURES_ENABLED,
  todayISO,
} from "../lib";

/** Một mốc chấm vị trí trong bảng chấm công. */
function MarkCell({
  at,
  distance,
  outOfRange,
  latitude,
  longitude,
  prefix,
  thumbUrl,
  onOpenImages,
}: {
  at: string | null;
  distance: number | null;
  outOfRange: boolean | null;
  latitude: number | null;
  longitude: number | null;
  prefix?: string;
  /** Ảnh chụp lúc chấm (hiện có ở check-in) — thumbnail bấm vào để xem đầy đủ. */
  thumbUrl?: string | null;
  onOpenImages?: () => void;
}) {
  if (!at) {
    return <span className="block text-gray-300">{prefix ? "" : "—"}</span>;
  }

  const point: LatLng | null = isValidLatLng({
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  })
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;

  return (
    <span className="block">
      <span
        className={`font-medium ${
          outOfRange ? "text-amber-600" : "text-emerald-600"
        }`}
      >
        {prefix ? `${prefix} ` : ""}
        {formatCheckedAt(at)}
      </span>
      {distance != null && (
        <span className="text-[11px] text-gray-400">
          {" "}
          · {formatDistance(distance)}
          {outOfRange ? " · ngoài vùng" : ""}
        </span>
      )}
      {point && (
        <a
          href={googleMapsUrl(point)}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 flex w-fit items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline"
          title="Mở vị trí giáo viên trên Google Maps"
        >
          <MapPin size={11} /> Xem vị trí
        </a>
      )}
      {thumbUrl && (
        <button
          type="button"
          onClick={onOpenImages}
          className="mt-1 block h-9 w-9 overflow-hidden rounded-lg border"
          title="Xem ảnh check-in"
        >
          <img src={thumbUrl} alt="Ảnh check-in" className="h-full w-full object-cover" />
        </button>
      )}
    </span>
  );
}


const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const BULK_LIMIT = 200;

const fetchTimetableSessions = (query: SessionQuery) =>
  fetchAllPages(teachingSessionApi.list, query);
const fetchPendingSchedules = (query: ScheduleQuery) =>
  fetchAllPages(teachingScheduleApi.list, query);

export type AttendanceFilter = {
  teacherId?: number;
  status?: SessionStatus;
  unchecked?: boolean;
  onlyMakeup?: boolean;
  fromDate?: string;
  toDate?: string;
};

type PendingRow = {
  status: SessionStatus;
  attendanceNote: string;
  originalStatus: SessionStatus;
  originalAttendanceNote: string;
  otherCosts: AttendanceOtherCost[];
  originalOtherCosts: AttendanceOtherCost[];
};

const costsOf = (session: TeachingSession) => session.otherCosts ?? [];
const costsEqual = (a: AttendanceOtherCost[], b: AttendanceOtherCost[]) =>
  JSON.stringify(a) === JSON.stringify(b);
const costsTotal = (costs: AttendanceOtherCost[]) =>
  costs.reduce((sum, item) => sum + item.amount, 0);

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
  /** Khu vực (tỉnh/thành) để lọc trường; rỗng = chưa tải xong danh mục. */
  provinces?: RefOption[];
  /** Bộ lọc bắn sang từ bảng tổng hợp khi click vào một ô số. */
  initialFilter?: AttendanceFilter | null;
};

export default function AttendanceTab({
  teachers,
  schools,
  provinces = [],
  initialFilter,
}: Props) {
  const canManage = canManageTeaching();
  const canManageRates = canSetTeachingRates();

  const [fromDate, setFromDate] = useState(
    initialFilter?.fromDate || todayISO(),
  );
  const [toDate, setToDate] = useState(
    initialFilter?.toDate || todayISO(),
  );
  const [teacherId, setTeacherId] = useState(
    initialFilter?.teacherId ? String(initialFilter.teacherId) : "",
  );
  const [provinceId, setProvinceId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [status, setStatus] = useState<SessionStatus | "">(
    initialFilter?.status || "",
  );
  const [unchecked, setUnchecked] = useState(!!initialFilter?.unchecked);
  const [onlyMakeup, setOnlyMakeup] = useState(!!initialFilter?.onlyMakeup);
  const [checkoutFilter, setCheckoutFilter] = useState<"" | "yes" | "no">("");
  const [imageFilter, setImageFilter] = useState<"" | "yes" | "no">("");
  const [rangeFilter, setRangeFilter] = useState<"" | "inside" | "outside">("");
  const [contentFilter, setContentFilter] = useState<"" | "yes" | "no">("");
  const [detailSession, setDetailSession] = useState<TeachingSession | null>(null);
  const [pendingSchedule, setPendingSchedule] = useState<TeachingSchedule | null>(null);
  const [replacementTeacherId, setReplacementTeacherId] = useState("");
  const [replacingTeacher, setReplacingTeacher] = useState(false);
  const [suggestedTeachers, setSuggestedTeachers] = useState<RefOption[]>([]);
  const [conflictFreeTeacherIds, setConflictFreeTeacherIds] = useState<number[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [costSession, setCostSession] = useState<TeachingSession | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [savingPeriods, setSavingPeriods] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<TeachingSession | null>(null);

  const [pending, setPending] = useState<Record<number, PendingRow>>({});
  const [saving, setSaving] = useState(false);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [paySummary, setPaySummary] = useState<AttendanceGrandTotal | null>(null);

  // Chọn nhiều tiết trên bảng chấm công để đổi giáo viên hàng loạt.
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignTeacherId, setBulkAssignTeacherId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  /**
   * Trường của khu vực đang chọn. Trường chưa gắn xã/phường không có khu vực
   * nên sẽ không hiện khi đang lọc — đúng với việc lọc theo khu vực, và backend
   * cũng loại chúng khỏi danh sách buổi dạy theo cùng điều kiện.
   */
  const schoolOptions = useMemo(
    () =>
      provinceId === VUNG_TAU_REGION_ID
        ? schools.filter((school) => school.isVungTau)
        : provinceId
        ? schools.filter(
            (school) =>
              String(school.provinceId) === provinceId &&
              // Hồ Chí Minh không còn gộp các trường Vũng Tàu/Bình Dương cũ vào danh sách.
              !((school.isVungTau || school.isBinhDuong) && school.provinceId === 6),
          )
        : schools,
    [schools, provinceId],
  );

  // Đổi khu vực → trường đang lọc có thể không còn thuộc khu vực mới.
  useEffect(() => {
    setSchoolId((prev) =>
      prev && !schoolOptions.some((school) => String(school.id) === prev)
        ? ""
        : prev,
    );
  }, [schoolOptions]);

  const rangeValid = isDateOrderValid(fromDate, toDate);

  const query = useMemo<SessionQuery>(
    () => ({
      fromDate,
      toDate,
      teacherId: teacherId ? Number(teacherId) : undefined,
      // Chọn trường rồi thì trường đã nằm trong khu vực, gửi thêm khu vực chỉ
      // thừa một điều kiện JOIN.
      provinceId:
        !schoolId && provinceId && provinceId !== VUNG_TAU_REGION_ID
          ? Number(provinceId)
          : undefined,
      region: provinceId === VUNG_TAU_REGION_ID
        ? VUNG_TAU_REGION_ID
        : provinceId === "6"
          ? "HO_CHI_MINH_CORE"
          : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      status: status || undefined,
      unchecked: unchecked || undefined,
    }),
    [fromDate, toDate, teacherId, provinceId, schoolId, status, unchecked],
  );

  const { items, setItems, pagination, page, setPage, loading, reload } =
    usePagedList<TeachingSession, SessionQuery>({
      fetcher: teachingSessionApi.list,
      query,
      limit: pageSize,
      enabled: rangeValid,
      errorMessage: "Không tải được danh sách buổi dạy",
    });

  useEffect(() => {
    if (!TEACHING_MONEY_FEATURES_ENABLED || !rangeValid) return;
    let active = true;
    teachingSessionApi.summary({
      fromDate,
      toDate,
      teacherId: teacherId ? Number(teacherId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
    }).then((result) => {
      if (active) setPaySummary(result.grandTotal || null);
    }).catch(() => {
      if (active) setPaySummary(null);
    });
    return () => { active = false; };
  }, [fromDate, toDate, teacherId, schoolId, rangeValid]);

  // Lưới tuần tải tất cả các trang. API giới hạn 200 buổi/trang nên tăng limit
  // không đủ để lấy hết lịch; bảng chi tiết bên dưới vẫn phân trang riêng.
  const { items: timetableItems, setItems: setTimetableItems, loading: loadingTimetable, reload: reloadTimetable } = usePagedList<TeachingSession, SessionQuery>({
    fetcher: fetchTimetableSessions,
    query,
    limit: 200,
    enabled: rangeValid,
    errorMessage: "Không tải được thời khoá biểu",
  });

  const pendingScheduleQuery = useMemo<ScheduleQuery>(
    () => ({
      confirmationStatus: "PENDING",
      teacherId: teacherId ? Number(teacherId) : undefined,
      // Lịch chờ xác nhận vẽ đè lên TKB nên phải thu theo cùng khu vực, không
      // thì lọc khu vực xong vẫn thấy tiết của trường tỉnh khác.
      provinceId:
        !schoolId && provinceId && provinceId !== VUNG_TAU_REGION_ID
          ? Number(provinceId)
          : undefined,
      region: provinceId === VUNG_TAU_REGION_ID
        ? VUNG_TAU_REGION_ID
        : provinceId === "6"
          ? "HO_CHI_MINH_CORE"
          : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
    }),
    [teacherId, provinceId, schoolId],
  );
  const { items: pendingSchedules, loading: loadingPendingSchedules, reload: reloadPendingSchedules } = usePagedList<TeachingSchedule, ScheduleQuery>({
    fetcher: fetchPendingSchedules,
    query: pendingScheduleQuery,
    limit: 100,
    enabled: rangeValid,
    errorMessage: "Không tải được các lịch chưa xác nhận",
  });
  const pendingTimetableItems = useMemo(
    () =>
      plannedFromSchedules(
        pendingSchedules,
        datesInRange(fromDate, toDate),
        timetableItems,
        { includePast: true },
      ).map((item) => ({
        ...item,
        scheduleResponseStatus: "PENDING" as const,
      })),
    [pendingSchedules, fromDate, toDate, timetableItems],
  );

  const applyClientFilters = (list: TeachingSession[]) =>
    list.filter((session) => {
      if (status && session.status !== status) return false;
      if (unchecked && session.status !== "SCHEDULED") return false;
      const school = schools.find((item) => item.id === session.schoolId);
      if (provinceId === VUNG_TAU_REGION_ID && !school?.isVungTau) return false;
      if (provinceId === "6" && (school?.isVungTau || school?.isBinhDuong)) return false;
      if (onlyMakeup && !session.isMakeup) return false;
      if (checkoutFilter === "yes" && session.checkoutAt == null) return false;
      if (checkoutFilter === "no" && session.checkoutAt != null) return false;
      const hasImages = (session.lessonImages?.length ?? 0) > 0;
      if (imageFilter === "yes" && !hasImages) return false;
      if (imageFilter === "no" && hasImages) return false;
      if (rangeFilter === "inside" && session.checkoutOutOfRange !== false) return false;
      if (rangeFilter === "outside" && session.checkoutOutOfRange !== true) return false;
      const hasContent = !!(session.lessonName?.trim() || session.lessonEvaluation?.trim());
      if (contentFilter === "yes" && !hasContent) return false;
      if (contentFilter === "no" && hasContent) return false;
      return true;
    });

  const rows = applyClientFilters(items);
  const timetableRows = applyClientFilters([
    ...timetableItems,
    ...pendingTimetableItems,
  ]);
  // Lịch chờ xác nhận có thể tồn tại khi chưa có buổi dạy trong bảng chấm công.
  const timetableLoading = loadingTimetable || loadingPendingSchedules;
  const resultsLoading = loading || timetableLoading;

  const rowStatus = (session: TeachingSession) =>
    pending[session.id]?.status ?? session.status;

  const rowNote = (session: TeachingSession) =>
    pending[session.id]?.attendanceNote ?? session.attendanceNote ?? "";

  useEffect(() => {
    if (!pendingSchedule) {
      setSuggestedTeachers([]);
      setConflictFreeTeacherIds([]);
      return;
    }

    let active = true;
    setLoadingSuggestions(true);
    teacherApi.candidates({
      schoolId: pendingSchedule.schoolId,
      subjectId: pendingSchedule.subjectId,
      dayOfWeek: pendingSchedule.dayOfWeek,
      startTime: pendingSchedule.startTime,
      endTime: pendingSchedule.endTime,
      effectiveFrom: pendingSchedule.effectiveFrom,
      effectiveTo: pendingSchedule.effectiveTo,
      periods: pendingSchedule.periods || 1,
      exceptScheduleId: pendingSchedule.id,
    }).then((result) => {
      if (!active) return;
      const hasScheduleConflict = (candidate: (typeof result.candidates)[number]) =>
        candidate.conflicts.length > 0 ||
        candidate.reasons.some(
          (reason) =>
            reason.kind === "FAIL" &&
            /CONFLICT|OVERLAP|SCHEDULE|TIME|TRÙNG|LỊCH/i.test(
              `${reason.code} ${reason.message}`,
            ),
        );
      setConflictFreeTeacherIds(
        result.candidates
          .filter(
            (candidate) =>
              candidate.teacherId !== pendingSchedule.teacherId &&
              !hasScheduleConflict(candidate),
          )
          .map((candidate) => candidate.teacherId),
      );
      setSuggestedTeachers(
        result.candidates
          .filter(
            (candidate) =>
              candidate.eligible &&
              candidate.teacherId !== pendingSchedule.teacherId,
          )
          .map((candidate) => ({
            id: candidate.teacherId,
            name: `✓ Phù hợp · ${candidate.teacherName}${
              candidate.distanceKm != null
                ? ` · ${candidate.distanceKm.toFixed(1)} km`
                : ""
            } · ${candidate.assignedPeriodsInWeek} tiết/tuần`,
          })),
      );
    }).catch(() => {
      if (active) {
        setSuggestedTeachers([]);
        setConflictFreeTeacherIds([]);
        toast.error("Không tải được gợi ý giáo viên thay thế");
      }
    }).finally(() => {
      if (active) setLoadingSuggestions(false);
    });

    return () => {
      active = false;
    };
  }, [pendingSchedule]);

  const replacementTeacherOptions = useMemo<RefOption[]>(() => {
    if (!pendingSchedule) return [];
    const suggestedIds = new Set(suggestedTeachers.map((teacher) => teacher.id));
    const conflictFreeIds = new Set(conflictFreeTeacherIds);
    const manualOptions = teachers
      .filter(
        (teacher) =>
          teacher.isActive &&
          teacher.id !== pendingSchedule.teacherId &&
          conflictFreeIds.has(teacher.id) &&
          !suggestedIds.has(teacher.id),
      )
      .map((teacher) => ({
        id: teacher.id,
        name: `Chỉ định thủ công · ${teacher.name}`,
      }));
    return [...suggestedTeachers, ...manualOptions];
  }, [pendingSchedule, suggestedTeachers, conflictFreeTeacherIds, teachers]);

  const replacePendingTeacher = async () => {
    if (!pendingSchedule || !replacementTeacherId) return;
    setReplacingTeacher(true);
    try {
      await teachingScheduleApi.update(pendingSchedule.id, {
        teacherId: Number(replacementTeacherId),
      });
      toast.success("Đã phân giáo viên mới, chờ giáo viên xác nhận");
      setPendingSchedule(null);
      setReplacementTeacherId("");
      await Promise.all([
        reloadPendingSchedules(),
        reloadTimetable(),
        reload(),
      ]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể phân giáo viên khác"));
    } finally {
      setReplacingTeacher(false);
    }
  };

  const isDirty = (session: TeachingSession) => {
    const entry = pending[session.id];
    if (!entry) return false;
    return (
      entry.status !== session.status ||
      entry.attendanceNote !== (session.attendanceNote || "") ||
      !costsEqual(entry.otherCosts, costsOf(session))
    );
  };

  const dirtyRows = rows.filter(isDirty);
  const dirtyEntries = Object.entries(pending).filter(([, entry]) =>
    entry.status !== entry.originalStatus ||
    entry.attendanceNote !== entry.originalAttendanceNote ||
    !costsEqual(entry.otherCosts, entry.originalOtherCosts),
  );

  // Thao tác hàng loạt và nút Lưu phải tuân theo bộ lọc hiện tại. Các thay đổi
  // ở khu vực/trang khác vẫn giữ trong bộ nhớ để người dùng quay lại xử lý,
  // nhưng tuyệt đối không bị lưu ké khi đang xem một bộ lọc khác.
  const visibleSessionIds = useMemo(
    () => new Set(rows.map((session) => session.id)),
    [rows],
  );
  const visibleDirtyEntries = dirtyEntries.filter(([sessionId]) =>
    visibleSessionIds.has(Number(sessionId)),
  );

  /**
   * Cộng tiền các buổi khớp `match`. Buổi vẫn được đếm khi chưa khai đơn giá,
   * chỉ không cộng vào tiền — `amount === null` là "chưa khai giá", khác hẳn 0
   * đồng, gộp chung thì bảng công thiếu tiền mà không ai biết.
   */
  const sumPay = (match: (session: TeachingSession) => boolean) => {
    let sessions = 0;
    let periods = 0;
    let total = 0;
    let missing = 0;

    rows.forEach((session) => {
      if (!match(session)) return;
      sessions += 1;
      periods += periodsOf(session);
      if (session.amount == null && !hasGasAllowance(session)) missing += 1;
      else if (session.amount != null) total += session.amount;
    });

    return { sessions, periods, total, missing };
  };

  // Tiết đã hoàn thành = đã chấm "Có dạy". Chỉ trạng thái này được trả công,
  // giống hệt bộ lọc `attendanceSummary` của backend.
  const done = sumPay((session) => session.status === "PRESENT");

  // Số sẽ có sau khi bấm Lưu — gồm cả dòng vừa đổi sang/khỏi "Có dạy".
  const projected = sumPay((session) => rowStatus(session) === "PRESENT");

  const setRow = (session: TeachingSession, patch: Partial<PendingRow>) =>
    setPending((prev) => ({
      ...prev,
      [session.id]: {
        status: prev[session.id]?.status ?? session.status,
        attendanceNote:
          prev[session.id]?.attendanceNote ?? session.attendanceNote ?? "",
        originalStatus: prev[session.id]?.originalStatus ?? session.status,
        originalAttendanceNote:
          prev[session.id]?.originalAttendanceNote ?? session.attendanceNote ?? "",
        otherCosts: prev[session.id]?.otherCosts ?? costsOf(session),
        originalOtherCosts: prev[session.id]?.originalOtherCosts ?? costsOf(session),
        ...patch,
      },
    }));

  const clearRow = (sessionId: number) =>
    setPending((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });

  /**
   * Chỉ sửa được số tiết khi buổi chưa qua ngày và chưa có dấu vết chấm công
   * (check-in/check-out/báo giảng) — trùng điều kiện BE chặn ở `update()`,
   * kiểm tra trước ở FE để không bấm vào rồi mới nhận lỗi 409.
   */
  const canEditPeriods = (session: TeachingSession) =>
    session.date >= todayISO() &&
    !session.checkinAt &&
    !session.checkoutAt &&
    !session.lessonSubmittedAt;

  const savePeriods = async (session: TeachingSession, value: number) => {
    if (value === periodsOf(session)) return;
    setSavingPeriods(session.id);
    try {
      const updated = await teachingSessionApi.update(session.id, {
        periods: value,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === session.id ? updated : item)),
      );
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không đổi được số tiết"));
    } finally {
      setSavingPeriods(null);
    }
  };

  /** Đủ căn cứ chấm tự động: check-in, check-out và báo giảng. */
  const isReadyForBulkPresent = (session: TeachingSession) =>
    !!session.checkinAt &&
    !!session.checkoutAt &&
    !!(session.lessonName?.trim() || session.lessonEvaluation?.trim());

  // `rows` đã đi qua toàn bộ bộ lọc server + bộ lọc trên trang hiện tại.
  const bulkPresentTargets = rows.filter(
    (session) => rowStatus(session) === "SCHEDULED" && isReadyForBulkPresent(session),
  );

  // Tiết đã chấm công (khác SCHEDULED) không đổi giáo viên được — backend cũng chặn.
  const isSelectableForAssign = (session: TeachingSession) =>
    session.status === "SCHEDULED";

  const toggleSelectSession = (session: TeachingSession) => {
    if (!isSelectableForAssign(session)) return;
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(session.id)) next.delete(session.id);
      else next.add(session.id);
      return next;
    });
  };

  /** Chọn/bỏ chọn cả nhóm (một Thứ hoặc một Tiết) cùng lúc — bấm lại để bỏ hết. */
  const toggleSelectMany = (targets: TeachingSession[]) => {
    const ids = targets.filter(isSelectableForAssign).map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectableRows = rows.filter(isSelectableForAssign);
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((session) => selectedSessionIds.has(session.id));

  const toggleSelectAllRows = () => {
    setSelectedSessionIds((prev) => {
      if (allSelectableSelected) {
        const next = new Set(prev);
        selectableRows.forEach((session) => next.delete(session.id));
        return next;
      }
      const next = new Set(prev);
      selectableRows.forEach((session) => next.add(session.id));
      return next;
    });
  };

  const bulkAssignTeacher = async () => {
    if (!bulkAssignTeacherId || selectedSessionIds.size === 0 || bulkAssigning) return;
    setBulkAssigning(true);
    try {
      const result = await teachingSessionApi.bulkAssign({
        sessionIds: [...selectedSessionIds],
        teacherId: Number(bulkAssignTeacherId),
      });
      if (result.updated) {
        toast.success(
          `Đã đổi giáo viên cho ${result.updated} tiết` +
            (result.swapped ? ` (${result.swapped} tiết đổi chéo do GV đích bận cùng giờ)` : ""),
        );
      }
      result.results
        .filter((r) => r.status === "FAILED")
        .slice(0, 3)
        .forEach((r) => toast.error(`Tiết #${r.sessionId}: ${r.message || "Không đổi được"}`));
      if (result.failed > 3) toast.error(`Còn ${result.failed - 3} tiết không đổi được`);
      setSelectedSessionIds(new Set());
      setBulkAssignOpen(false);
      setBulkAssignTeacherId("");
      await reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Đổi giáo viên hàng loạt thất bại"));
    } finally {
      setBulkAssigning(false);
    }
  };

  const markAllPresent = () => {
    const targets = bulkPresentTargets;
    if (targets.length === 0) {
      toast("Không có buổi nào đủ check-in, check-out và báo giảng để chấm tự động");
      return;
    }
    setPending((prev) => {
      const next = { ...prev };
      targets.forEach((s) => {
        next[s.id] = {
          status: "PRESENT",
          attendanceNote: prev[s.id]?.attendanceNote ?? s.attendanceNote ?? "",
          originalStatus: prev[s.id]?.originalStatus ?? s.status,
          originalAttendanceNote:
            prev[s.id]?.originalAttendanceNote ?? s.attendanceNote ?? "",
          otherCosts: prev[s.id]?.otherCosts ?? costsOf(s),
          originalOtherCosts: prev[s.id]?.originalOtherCosts ?? costsOf(s),
        };
      });
      return next;
    });
  };

  // Cập nhật lạc quan 1 dòng từ response rồi đồng bộ lại danh sách.
  const applyUpdated = (updated: TeachingSession) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setTimetableItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    clearRow(updated.id);
  };

  // Chấm nhanh 1 dòng — không qua batch.
  const saveRow = async (session: TeachingSession, next?: SessionStatus) => {
    const target = next ?? rowStatus(session);
    const currentCosts = pending[session.id]?.otherCosts ?? costsOf(session);
    if (
      target === "SCHEDULED" &&
      currentCosts.length > 0 &&
      !window.confirm("Bỏ chấm sẽ xóa toàn bộ chi phí khác của buổi này. Tiếp tục?")
    ) return;
    setSavingRow(session.id);
    try {
      const updated = await teachingSessionApi.attendance(session.id, {
        status: target,
        attendanceNote: rowNote(session).trim() || null,
        ...(canManageRates
          ? { otherCosts: pending[session.id]?.otherCosts ?? costsOf(session) }
          : {}),
      });
      applyUpdated(updated);
      toast.success(target === "SCHEDULED" ? "Đã bỏ chấm" : "Đã chấm công");
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Chấm công thất bại"));
      }
    } finally {
      setSavingRow(null);
    }
  };

  const changeStatus = (session: TeachingSession, next: SessionStatus) => {
    const currentCosts = pending[session.id]?.otherCosts ?? costsOf(session);
    if (
      next === "SCHEDULED" &&
      currentCosts.length > 0 &&
      !window.confirm("Bỏ chấm sẽ xóa toàn bộ chi phí khác của buổi này. Tiếp tục?")
    ) return;
    setRow(session, {
      status: next,
      ...(next === "SCHEDULED" ? { otherCosts: [] } : {}),
    });
  };

  // Lưu hàng loạt — chỉ gửi dòng đã đổi.
  const saveBulk = async () => {
    if (visibleDirtyEntries.length === 0) return;

    if (visibleDirtyEntries.length > BULK_LIMIT) {
      toast.error(`Chỉ chấm được tối đa ${BULK_LIMIT} buổi mỗi lần lưu`);
      return;
    }

    const payload: BulkAttendanceItem[] = visibleDirtyEntries.map(([sessionId, entry]) => ({
      sessionId: Number(sessionId),
      status: entry.status,
      attendanceNote: entry.attendanceNote.trim() || null,
      ...(canManageRates ? { otherCosts: entry.otherCosts } : {}),
    }));

    setSaving(true);
    try {
      const res = await teachingSessionApi.bulkAttendance(payload);
      toast.success(`Đã chấm công ${res?.updated ?? payload.length} buổi`);
      setPending({});
      reload();
      reloadTimetable();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Lưu chấm công thất bại"));
      }
    } finally {
      setSaving(false);
    }
  };

  const hasFilter =
    !!teacherId || !!provinceId || !!schoolId || !!status || unchecked || onlyMakeup ||
    !!checkoutFilter || !!imageFilter || !!rangeFilter || !!contentFilter;

  const clearFilters = () => {
    setTeacherId("");
    setProvinceId("");
    setSchoolId("");
    setStatus("");
    setUnchecked(false);
    setOnlyMakeup(false);
    setCheckoutFilter("");
    setImageFilter("");
    setRangeFilter("");
    setContentFilter("");
  };

  // Một thao tác ở tab khác có thể làm trang cuối không còn dòng nào. Lùi một
  // trang và để hook tải lại, tránh để người dùng mắc ở một trang rỗng giả.
  useEffect(() => {
    if (!loading && items.length === 0 && pagination.total > 0 && page > 1) {
      setPage(page - 1);
    }
  }, [items.length, loading, page, pagination.total]);

  const changePage = (nextPage: number) => {
    if (loading || nextPage === page) return;
    if (dirtyEntries.length > 0) {
      toast("Các thay đổi chưa lưu vẫn được giữ để bạn lưu sau.");
    }
    setPage(nextPage);
  };

  return (
    <div className="space-y-3">
      {/* Khoảng ngày + bộ lọc */}
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
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const today = todayISO();
                setFromDate(today);
                setToDate(today);
              }}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(startOfWeek(todayISO()));
                setToDate(endOfWeek(todayISO()));
              }}
              className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600"
            >
              Tuần này
            </button>
          </div>
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

          {/* Khu vực đứng trước trường: chọn khu vực là ô trường thu lại còn
              các trường thuộc khu vực đó. */}
          <SearchableSelect
            value={provinceId}
            onChange={setProvinceId}
            options={[
              { id: VUNG_TAU_REGION_ID, name: "Vũng Tàu" },
              ...provinces,
            ]}
            placeholder="Tất cả khu vực"
            searchPlaceholder="Tìm khu vực…"
            className="flex-1 min-w-0"
          />
        </div>

        <div className="flex gap-2 md:contents">
          <SearchableSelect
            value={schoolId}
            onChange={setSchoolId}
            options={schoolOptions}
            placeholder={
              provinceId
                ? `Tất cả trường trong khu vực (${schoolOptions.length})`
                : "Tất cả trường"
            }
            searchPlaceholder="Tìm trường…"
            emptyLabel="Khu vực này chưa có trường nào"
            className="flex-1 min-w-0"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SessionStatus | "")}
            className={`${selectClass} flex-1 min-w-0`}
          >
            <option value="">Tất cả trạng thái</option>
            {ATTENDANCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="CANCELLED">Đã huỷ</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap md:col-span-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={unchecked}
                onChange={(e) => setUnchecked(e.target.checked)}
              />
              Chưa chấm
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={onlyMakeup}
                onChange={(e) => setOnlyMakeup(e.target.checked)}
              />
              Dạy bù
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

        <div className="grid grid-cols-2 gap-2 md:col-span-4 md:grid-cols-4">
          <select value={checkoutFilter} onChange={(e) => setCheckoutFilter(e.target.value as typeof checkoutFilter)} className={selectClass}>
            <option value="">Mọi Check-out</option><option value="yes">Đã Check-out</option><option value="no">Chưa Check-out</option>
          </select>
          <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as typeof imageFilter)} className={selectClass}>
            <option value="">Mọi ảnh bài dạy</option><option value="yes">Có ảnh</option><option value="no">Không có ảnh</option>
          </select>
          <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value as typeof rangeFilter)} className={selectClass}>
            <option value="">Mọi phạm vi</option><option value="inside">Trong phạm vi</option><option value="outside">Ngoài phạm vi</option>
          </select>
          <select value={contentFilter} onChange={(e) => setContentFilter(e.target.value as typeof contentFilter)} className={selectClass}>
            <option value="">Mọi nội dung</option><option value="yes">Có nội dung</option><option value="no">Chưa có nội dung</option>
          </select>
        </div>
        {(checkoutFilter || imageFilter || rangeFilter || contentFilter) && (
          <p className="text-[11px] text-amber-600 md:col-span-4">Các bộ lọc Check-out, ảnh, phạm vi và nội dung chỉ áp dụng trên dữ liệu của trang hiện tại.</p>
        )}
      </FilterCard>

      {canManage && selectedSessionIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
          <span className="text-sm font-medium text-purple-800">
            Đã chọn {selectedSessionIds.size} tiết
          </span>
          <div className="flex-1 min-w-[180px]">
            <SearchableSelect
              value={bulkAssignTeacherId}
              onChange={setBulkAssignTeacherId}
              options={teachers.filter((item) => item.isActive).map((item) => ({ id: item.id, name: item.name }))}
              placeholder="— Chọn giáo viên nhận các tiết này —"
              searchPlaceholder="Tìm giáo viên…"
              portal
            />
          </div>
          <button
            onClick={() => setBulkAssignOpen(true)}
            disabled={!bulkAssignTeacherId}
            className="px-3 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium active:scale-95 disabled:opacity-40"
          >
            Đổi giáo viên
          </button>
          <button
            onClick={() => setSelectedSessionIds(new Set())}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-medium active:scale-95"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {canManage && rows.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={markAllPresent}
            disabled={bulkPresentTargets.length === 0}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={16} /> Đánh dấu {bulkPresentTargets.length} tiết đủ điều kiện là Có dạy
          </button>
          {dirtyEntries.length > 0 && (
            <button
              onClick={() => setPending({})}
              className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-medium active:scale-95"
              title="Bỏ các thay đổi chưa lưu"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      )}

      {/* Tổng tiền các tiết đã hoàn thành trong khoảng đang lọc */}
      {TEACHING_MONEY_FEATURES_ENABLED && !loading && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-xs text-gray-500">
              Tiền theo tiết đã hoàn thành{" "}
              <b className="text-lg text-emerald-700">
                {formatMoney(done.total)}
              </b>
            </span>
            <span className="text-xs text-gray-500">
              Phụ cấp xăng{" "}
              <b className="text-lg text-emerald-700">
                {formatMoney(paySummary?.fuelAllowanceAmount ?? 0)}
              </b>
              <span className="ml-1 text-gray-400">(gộp theo mỗi lần đến trường)</span>
            </span>
            <span className="text-xs text-gray-400">
              {done.sessions.toLocaleString("vi-VN")} buổi ·{" "}
              {done.periods.toLocaleString("vi-VN")} tiết
            </span>

            {/* Dòng chưa lưu có thể làm tăng lẫn giảm số trên. */}
            {projected.total !== done.total && (
              <span className="text-xs font-medium text-blue-600">
                → {formatMoney(projected.total)} sau khi lưu{" "}
                {dirtyRows.length} dòng
              </span>
            )}
          </div>

          {done.missing > 0 && (
            <p className="text-xs font-medium text-amber-600">
              {done.missing} buổi đã dạy chưa khai đơn giá — chưa được cộng vào
              số này.
            </p>
          )}

          {/* Bảng chỉ tải từng trang nên tổng chỉ đúng phạm vi đang hiển thị. */}
          {pagination.totalPages > 1 && (
            <p className="text-[11px] text-gray-400">
              Chỉ tính {rows.length} buổi của trang {page}/{pagination.totalPages}
              . Thu hẹp khoảng ngày hoặc xem tab “Tổng hợp” để có tổng đầy đủ.
            </p>
          )}
        </div>
      )}

      {resultsLoading && <Loading />}

      {!resultsLoading && rows.length === 0 && timetableRows.length === 0 && (
        <EmptyState
          icon="🗒️"
          title="Không có buổi dạy nào trong khoảng đã chọn"
          description={
            hasFilter
              ? "Thử đổi khoảng ngày hoặc xoá bớt bộ lọc."
              : "Chọn khoảng ngày khác, hoặc sinh buổi dạy từ mẫu lịch tuần."
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

      {!timetableLoading && timetableRows.length > 0 && (
        <SessionTimetable
          anchorDate={fromDate}
          sessions={timetableRows}
          selectable={canManage ? isSelectableForAssign : undefined}
          selectedIds={canManage ? selectedSessionIds : undefined}
          onToggleSelect={canManage ? toggleSelectSession : undefined}
          onToggleMany={canManage ? toggleSelectMany : undefined}
          onSelect={(session) => {
            if (!session.fromTemplate) {
              setDetailSession(session);
              return;
            }
            const schedule = pendingSchedules.find(
              (item) => item.id === session.scheduleId,
            );
            if (schedule) {
              setPendingSchedule(schedule);
              setReplacementTeacherId("");
            }
          }}
          showAttendanceBadges
          teachers={teachers}
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Chi tiết chấm công</h3>
            <p className="text-[11px] text-gray-400">Sửa trạng thái và ghi chú theo từng buổi</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              {pagination.total === 0
                ? "0 buổi"
                : `${(page - 1) * pagination.limit + 1}–${Math.min(
                    page * pagination.limit,
                    pagination.total,
                  )} / ${pagination.total} buổi`}
            </span>
            <label className="flex items-center gap-1">
              <span className="sr-only">Số dòng mỗi trang</span>
              <select
                value={pageSize}
                disabled={loading}
                onChange={(event) => {
                  if (dirtyEntries.length > 0) {
                    toast("Các thay đổi chưa lưu vẫn được giữ để bạn lưu sau.");
                  }
                  setPageSize(Number(event.target.value));
                }}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
                aria-label="Số dòng mỗi trang"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}/trang
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <TableCard minWidth={canManage ? 1940 : 1660} draggable>
          <thead className={theadClass}>
            <tr>
              {canManage && (
                <th className={thClass}>
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAllRows}
                    title="Chọn tất cả tiết chưa chấm công trên trang này"
                  />
                </th>
              )}
              <th className={thClass}>Ngày</th>
              <th className={thClass}>Giờ</th>
              <th className={thClass}>Giáo viên</th>
              <th className={thClass}>Trường</th>
              <th className={thClass}>Lớp</th>
              <th className={thClass}>Môn</th>
              <th className={`${thClass} text-right`}>Tiết</th>
              {TEACHING_MONEY_FEATURES_ENABLED && (
                <th className={`${thClass} text-right`}>Tiền công</th>
              )}
              <th className={`${thClass} text-right`}>Chi phí khác</th>
              <th className={thClass}>Check-in / out</th>
              <th className={thClass}>Nội dung bài học</th>
              <th className={thClass}>Trạng thái</th>
              <th className={thClass}>Ghi chú</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:align-top">
            {rows.map((session) => {
              const current = rowStatus(session);
              const meta = SESSION_STATUS_META[current];
              const dirty = isDirty(session);
              const checked = session.status !== "SCHEDULED";
              const checkoutOverdue = isCheckoutOverdue(session);

              return (
                <tr
                  key={session.id}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("button, input, select, textarea, a, [role='button']")) return;
                    setDetailSession(session);
                  }}
                  className={`${trClass} cursor-pointer ${
                    checkoutOverdue
                      ? "bg-red-50/70 hover:bg-red-100/70"
                      : dirty
                        ? "bg-amber-50/70"
                        : ""
                  }`}
                  title="Bấm để xem chi tiết buổi dạy"
                >
                  {canManage && (
                    <td className={tdClass}>
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.has(session.id)}
                        disabled={!isSelectableForAssign(session)}
                        onChange={() => toggleSelectSession(session)}
                        title={
                          isSelectableForAssign(session)
                            ? undefined
                            : "Đã chấm công, không đổi giáo viên được"
                        }
                      />
                    </td>
                  )}
                  <td className={`${tdClass} font-medium text-gray-800`}>
                    {formatDate(session.date)}
                    <span className="block text-[11px] text-gray-400 font-normal">
                      {session.dayOfWeekLabel}
                    </span>
                  </td>
                  <td className={`${tdClass} ${meta?.strike ? "line-through" : ""}`}>
                    {formatTime(session.startTime)}–{formatTime(session.endTime)}
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          checkoutOverdue ? "font-semibold text-red-600" : undefined
                        }
                        title={
                          checkoutOverdue
                            ? "Đã quá giờ kết thúc nhưng giáo viên chưa check-out"
                            : undefined
                        }
                      >
                        {session.teacherName}
                      </span>
                      {session.isMakeup && (
                        <MakeupBadge forSessionId={session.makeupForSessionId} />
                      )}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {session.schoolName}
                    {session.locationName && (
                      <span className="block text-[11px] text-gray-400 font-normal">
                        {session.locationName}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${tdClass} ${
                      session.className
                        ? "font-medium text-gray-800"
                        : "text-gray-300"
                    }`}
                  >
                    {classNameOf(session)}
                  </td>
                  <td className={tdClass}>{session.subjectName}</td>
                  <td
                    className={`${tdClass} text-right font-medium`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canManage && canEditPeriods(session) ? (
                      <input
                        type="number"
                        min={1}
                        max={MAX_PERIODS}
                        defaultValue={periodsOf(session)}
                        disabled={savingPeriods === session.id}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (!isValidPeriods(value)) {
                            e.target.value = String(periodsOf(session));
                            return;
                          }
                          void savePeriods(session, value);
                        }}
                        className="w-14 rounded-md border border-gray-200 px-1.5 py-0.5 text-right text-sm disabled:opacity-50"
                      />
                    ) : (
                      <span
                        title={
                          canManage
                            ? "Buổi đã qua ngày hoặc đã có dấu vết chấm công, không đổi được số tiết"
                            : undefined
                        }
                      >
                        {periodsOf(session)}
                      </span>
                    )}
                  </td>

                  {/* Chỉ trạng thái "Có dạy" mới được trả công → gạch mờ các trạng thái khác. */}
                  {TEACHING_MONEY_FEATURES_ENABLED && (
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      {hasGasAllowance(session) ? (
                        <span className={current === "PRESENT" ? "font-semibold text-emerald-700" : "text-gray-300 line-through"}>
                          {formatFuelAllowance(session)}
                        </span>
                      ) : session.amount == null ? (
                        <span
                          className={
                            current === "PRESENT"
                              ? "text-xs font-medium text-amber-600"
                              : "text-xs text-gray-300"
                          }
                        >
                          {current === "PRESENT" ? RATE_MISSING_LABEL : "—"}
                        </span>
                      ) : (
                        <>
                          <span
                            className={
                              current === "PRESENT"
                                ? "font-semibold text-emerald-700"
                                : "text-gray-300 line-through"
                            }
                          >
                            {formatMoney(session.amount)}
                          </span>
                          <span className="block text-[11px] text-gray-400">
                            {formatMoney(session.ratePerPeriod)}/tiết
                          </span>
                        </>
                      )}
                    </td>
                  )}

                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    {(() => {
                      const currentCosts = pending[session.id]?.otherCosts ?? costsOf(session);
                      const total = pending[session.id]
                        ? costsTotal(currentCosts)
                        : session.otherCostsTotal ?? costsTotal(currentCosts);
                      return (
                        <>
                          <span className={total > 0 ? "font-semibold text-blue-700" : "text-gray-300"}>
                            {total > 0 ? formatMoney(total) : "—"}
                          </span>
                          {(canManageRates || currentCosts.length > 0) && (
                            <button
                              type="button"
                              onClick={() => setCostSession(session)}
                              className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-blue-600"
                            >
                              <Plus size={12} /> {currentCosts.length > 0 ? (canManageRates ? "Xem/Sửa" : "Xem") : "Thêm"}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </td>

                  {/* Check-in / check-out của giáo viên — căn cứ để chấm công. */}
                  <td className={`${tdClass} text-xs`}>
                    <MarkCell
                      at={session.checkinAt}
                      distance={session.checkinDistance}
                      outOfRange={session.checkinOutOfRange}
                      latitude={session.checkinLatitude}
                      longitude={session.checkinLongitude}
                      thumbUrl={
                        session.checkinImages?.[0]
                          ? resolveApiFileUrl(session.checkinImages[0].url)
                          : null
                      }
                      onOpenImages={() => setDetailSession(session)}
                    />
                    <MarkCell
                      at={session.checkoutAt}
                      distance={session.checkoutDistance}
                      outOfRange={session.checkoutOutOfRange}
                      latitude={session.checkoutLatitude}
                      longitude={session.checkoutLongitude}
                      prefix="→"
                    />
                  </td>

                  <td className={`${tdClass} min-w-44 max-w-56`}>
                    <p className={`truncate text-xs font-medium ${session.lessonName?.trim() ? "text-gray-800" : "text-gray-400"}`} title={session.lessonName || undefined}>
                      {session.lessonName?.trim() || "Chưa cập nhật"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      {(session.lessonImages?.length ?? 0) > 0 && <span className="text-gray-400">{session.lessonImages?.length} ảnh</span>}
                      <button type="button" onClick={() => setDetailSession(session)} className="font-medium text-blue-600 hover:underline">Xem chi tiết</button>
                    </div>
                  </td>

                  <td className={tdClass}>
                    {canManage ? (
                      <>
                        <div className="inline-flex gap-1 bg-gray-100 rounded-lg p-0.5">
                          {ATTENDANCE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => changeStatus(session, opt.value)}
                              className={`px-2 py-1 text-[11px] font-medium rounded-md transition ${
                                current === opt.value
                                  ? opt.active
                                  : "bg-white text-gray-500"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          {checked && (
                            <span className="text-gray-400">
                              {session.checkedByName} ·{" "}
                              {formatCheckedAt(session.checkedAt)}
                            </span>
                          )}
                          {dirty && (
                            <button
                              onClick={() => saveRow(session)}
                              disabled={savingRow === session.id}
                              className="flex items-center gap-0.5 text-blue-600 font-medium disabled:opacity-50"
                            >
                              <Save size={12} /> Lưu ngay
                            </button>
                          )}
                          {checked && !dirty && (
                            <button
                              onClick={() => saveRow(session, "SCHEDULED")}
                              disabled={savingRow === session.id}
                              className="text-gray-500 underline disabled:opacity-50"
                            >
                              Bỏ chấm
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <span
                          className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium ${meta?.badge}`}
                        >
                          {session.statusLabel || meta?.label}
                        </span>
                        {checked && (
                          <span className="block text-[11px] text-gray-400 mt-1">
                            {session.checkedByName} ·{" "}
                            {formatCheckedAt(session.checkedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className={tdClass}>
                    {canManage ? (
                      <input
                        value={rowNote(session)}
                        onChange={(e) =>
                          setRow(session, { attendanceNote: e.target.value })
                        }
                        maxLength={500}
                        placeholder="Ghi chú…"
                        className="w-44 px-2 py-1.5 border rounded-lg text-xs"
                      />
                    ) : (
                      <span className="text-gray-500 text-xs">
                        {session.attendanceNote || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={changePage}
        disabled={loading || saving}
      />

      {bulkAssignOpen && bulkAssignTeacherId && (
        <ConfirmModal
          title="Đổi giáo viên cho các tiết đã chọn"
          message={
            <>
              Đổi giáo viên cho <b>{selectedSessionIds.size} tiết</b> đã chọn
              sang{" "}
              <b>{teachers.find((item) => String(item.id) === bulkAssignTeacherId)?.name}</b>?
            </>
          }
          hint="GV đích đang bận đúng khung giờ đó (VD 2 GV dạy song song 2 lớp cùng giờ) thì buổi đang chiếm chỗ của họ sẽ tự đổi chéo về GV nguồn, không cần làm gì thêm. Tiết nào lỗi thật (đã chấm công, vượt định mức tuần...) sẽ giữ nguyên giáo viên cũ và báo lỗi riêng, các tiết còn lại vẫn đổi."
          submitLabel={`Đổi ${selectedSessionIds.size} tiết`}
          submitColor="bg-purple-600"
          loading={bulkAssigning}
          onClose={() => setBulkAssignOpen(false)}
          onSubmit={bulkAssignTeacher}
        />
      )}

      {/* Thanh lưu cố định — hiện số dòng đang chờ lưu */}
      {canManage && visibleDirtyEntries.length > 0 && (
        <div className="fixed bottom-16 left-0 w-full px-3 md:px-6 xl:px-8 z-40">
          <div>
            <button
              onClick={saveBulk}
              disabled={saving}
              className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg active:scale-95 disabled:opacity-60"
            >
              {saving
                ? "Đang lưu…"
                : `Lưu chấm công (${visibleDirtyEntries.length} dòng)`}
            </button>
          </div>
        </div>
      )}
      {detailSession && (
        <SessionDetailDrawer
          session={detailSession}
          canManage={canManage}
          teachers={teachers}
          onClose={() => setDetailSession(null)}
          onChanged={(updated) => {
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item),
              );
            }
            void reload();
            void reloadTimetable();
          }}
          onEdit={(session) => {
            setDetailSession(null);
            setFormTarget(session);
          }}
          onManageCosts={
            canManageRates || (detailSession.otherCosts?.length ?? 0) > 0
              ? (session) => {
                  setDetailSession(null);
                  setCostSession(session);
                }
              : undefined
          }
        />
      )}
      {formTarget && (
        <SessionFormModal
          session={formTarget}
          teachers={teachers}
          schools={schools}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            reload();
            reloadTimetable();
          }}
        />
      )}
      {costSession && (
        <AttendanceCostsModal
          costs={pending[costSession.id]?.otherCosts ?? costsOf(costSession)}
          readOnly={!canManageRates}
          onClose={() => setCostSession(null)}
          onSave={(otherCosts) => setRow(costSession, { otherCosts })}
        />
      )}
      {pendingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="font-semibold text-gray-900">Chi tiết lịch chưa xác nhận</h3>
                <p className="text-xs text-orange-600">Đang chờ giáo viên phản hồi lịch</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingSchedule(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 p-4 text-sm">
              <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
                <span className="text-gray-500">Giáo viên</span>
                <b>{pendingSchedule.teacherName}</b>
                <span className="text-gray-500">Trường</span>
                <b>{pendingSchedule.schoolName}</b>
                <span className="text-gray-500">Lớp</span>
                <b>{pendingSchedule.className || "Chưa xếp lớp"}</b>
                <span className="text-gray-500">Môn</span>
                <b>{pendingSchedule.subjectName}</b>
                <span className="text-gray-500">Thời gian</span>
                <b>
                  {pendingSchedule.dayOfWeekLabel} · {formatTime(pendingSchedule.startTime)}–{formatTime(pendingSchedule.endTime)}
                </b>
                <span className="text-gray-500">Hiệu lực</span>
                <b>
                  {formatDate(pendingSchedule.effectiveFrom)}
                  {pendingSchedule.effectiveTo
                    ? ` – ${formatDate(pendingSchedule.effectiveTo)}`
                    : " trở đi"}
                </b>
              </div>

              {canManage && (
                <div className="border-t pt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Gợi ý giáo viên thay thế
                  </label>
                  <SearchableSelect
                    value={replacementTeacherId}
                    onChange={setReplacementTeacherId}
                    options={replacementTeacherOptions}
                    disabled={loadingSuggestions}
                    placeholder={
                      loadingSuggestions
                        ? "Đang tìm giáo viên phù hợp…"
                        : replacementTeacherOptions.length > 0
                          ? "Chọn hoặc chỉ định giáo viên"
                          : "Không có giáo viên đang hoạt động"
                    }
                    searchPlaceholder="Tìm giáo viên…"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Giáo viên phù hợp được ưu tiên ở đầu. Có thể chỉ định thủ công
                    người ngoài gợi ý nếu không trùng tiết trong khung giờ này.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                onClick={() => setPendingSchedule(null)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-600"
              >
                Đóng
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={replacePendingTeacher}
                  disabled={!replacementTeacherId || replacingTeacher}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {replacingTeacher ? "Đang phân…" : "Phân giáo viên"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
