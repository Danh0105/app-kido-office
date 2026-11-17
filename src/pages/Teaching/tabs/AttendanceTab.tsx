import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Check, FileSpreadsheet, MapPin, Plus, RotateCcw, Save, X } from "lucide-react";
import type { SheetData } from "write-excel-file/browser";

import { getApiErrorMessage } from "@/utils/apiError";
import { EXCEL_FILE_TYPE, saveBlob } from "@/utils/saveBlob";
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
  type CalendarSession,
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
import InfiniteScrollSentinel from "../components/InfiniteScrollSentinel";
import SessionDetailDrawer from "../components/SessionDetailDrawer";
import SessionFormModal from "../components/SessionFormModal";
import { usePagedList } from "../hooks/usePagedList";
import { useWeeklySessions } from "../hooks/useWeeklySessions";
import { useInfiniteList } from "../hooks/useInfiniteList";
import { fetchAllPages } from "../pagedList";
import {
  VUNG_TAU_REGION_ID,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  canManageTeaching,
  canSetTeachingRates,
  classNameOf,
  endOfMonth,
  endOfWeek,
  formatCheckedAt,
  formatDate,
  formatDayMonth,
  formatFuelAllowance,
  formatMoney,
  formatTeacherLabel,
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
  startOfMonth,
  startOfWeek,
  teacherLabel,
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
/** "Xem tất cả": bỏ phân trang, cuộn tới cuối bảng mới tải thêm từng đợt. */
const SHOW_ALL = "all";
const SHOW_ALL_CHUNK = 100;
const BULK_LIMIT = 200;

const formatExportDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const rangeLabelOf = (value?: boolean | null) =>
  value === true ? "Ngoài phạm vi" : value === false ? "Trong phạm vi" : "";

/** Chấm "Có dạy" hàng loạt cho tiết đủ hay chưa đủ check-in/check-out/báo giảng. */
type MarkPresentMode = "eligible" | "ineligible";

/**
 * Đủ IN · OUT · BG: căn cứ chấm tự động, và là điều kiện của bộ lọc tiến độ.
 * Khai báo ngoài component vì bộ lọc gọi tới nó ngay trong lúc vẽ.
 */
const isReadyForBulkPresent = (session: TeachingSession) =>
  !!session.checkinAt &&
  !!session.checkoutAt &&
  !!(session.lessonName?.trim() || session.lessonEvaluation?.trim());

// Tiết đã chấm công (khác SCHEDULED) không đổi giáo viên được — backend cũng chặn.
// Ô "dự kiến" từ lịch chờ xác nhận chưa có buổi thật (id âm, backend báo
// "sessionIds must not be less than 1" và từ chối cả lượt) — đổi GV cho ô đó
// qua hộp lịch chờ xác nhận khi bấm vào ô.
const isSelectableForAssign = (session: TeachingSession) =>
  session.status === "SCHEDULED" &&
  session.id > 0 &&
  !(session as CalendarSession).fromTemplate;

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
  // Ẩn tiết đã chấm "Có dạy" — chỉ còn những tiết cần xử lý.
  const [hidePresent, setHidePresent] = useState(false);
  const [checkinFilter, setCheckinFilter] = useState<"" | "yes" | "no">("");
  const [checkoutFilter, setCheckoutFilter] = useState<"" | "yes" | "no">("");
  const [imageFilter, setImageFilter] = useState<"" | "yes" | "no">("");
  const [rangeFilter, setRangeFilter] = useState<"" | "inside" | "outside">("");
  const [contentFilter, setContentFilter] = useState<"" | "yes" | "no">("");
  // Tiến độ IN · OUT · BG của giáo viên — lọc dưới database (xem `query`).
  const [progressFilter, setProgressFilter] = useState<"" | "complete" | "incomplete">("");
  const [detailSession, setDetailSession] = useState<TeachingSession | null>(null);
  const [pendingSchedule, setPendingSchedule] = useState<TeachingSchedule | null>(null);
  const [replacementTeacherId, setReplacementTeacherId] = useState("");
  const [replacingTeacher, setReplacingTeacher] = useState(false);
  const [suggestedTeachers, setSuggestedTeachers] = useState<RefOption[]>([]);
  const [conflictFreeTeacherIds, setConflictFreeTeacherIds] = useState<number[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [costSession, setCostSession] = useState<TeachingSession | null>(null);
  const [pageSize, setPageSize] = useState<number | typeof SHOW_ALL>(
    DEFAULT_PAGE_SIZE,
  );
  const showAll = pageSize === SHOW_ALL;
  const [savingPeriods, setSavingPeriods] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<TeachingSession | null>(null);

  const [pending, setPending] = useState<Record<number, PendingRow>>({});
  const [saving, setSaving] = useState(false);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
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
      // Lọc dưới database để phân trang/cuộn không ra trang rỗng. BE chưa
      // có tham số này thì nó bị bỏ qua — `applyClientFilters` vẫn ẩn được.
      excludeStatus: hidePresent ? "PRESENT" : undefined,
      progress:
        progressFilter === "complete"
          ? "COMPLETE"
          : progressFilter === "incomplete"
            ? "INCOMPLETE"
            : undefined,
    }),
    [fromDate, toDate, teacherId, provinceId, schoolId, status, unchecked, hidePresent, progressFilter],
  );

  // Bảng chi tiết có hai chế độ: phân trang (20/50/100 dòng) hoặc "Xem tất
  // cả" — cuộn tới đâu tải tới đó. Chỉ chế độ đang chọn được gọi API.
  const paged = usePagedList<TeachingSession, SessionQuery>({
    fetcher: teachingSessionApi.list,
    query,
    limit: showAll ? DEFAULT_PAGE_SIZE : pageSize,
    enabled: rangeValid && !showAll,
    errorMessage: "Không tải được danh sách buổi dạy",
  });
  const infinite = useInfiniteList<TeachingSession, SessionQuery>({
    fetcher: teachingSessionApi.list,
    query,
    limit: SHOW_ALL_CHUNK,
    enabled: rangeValid && showAll,
    errorMessage: "Không tải được danh sách buổi dạy",
  });
  const { pagination, page, setPage } = paged;
  const items = showAll ? infinite.items : paged.items;
  const setItems = showAll ? infinite.setItems : paged.setItems;
  // "Xem tất cả" chỉ tính lần tải đầu: tải thêm khi cuộn không được làm bảng
  // biến mất rồi hiện lại.
  const loading = showAll ? infinite.initialLoading : paged.loading;
  const reload = showAll ? infinite.reload : paged.reload;
  const totalSessions = showAll ? infinite.total : pagination.total;

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

  // Lưới TKB tải theo tuần: lúc mở chỉ tuần đầu, cuộn tới cuối mới tải tuần
  // kế tiếp. Bảng chi tiết bên dưới vẫn phân trang riêng trên cả khoảng lọc.
  const {
    loadedWeeks: timetableWeekItems,
    hasMore: hasMoreWeeks,
    nextWeek,
    weeks: allWeeks,
    initialLoading: loadingTimetable,
    loading: loadingWeeks,
    failed: timetableFailed,
    loadMore: loadMoreWeeks,
    setItems: setTimetableItems,
    reload: reloadTimetable,
  } = useWeeklySessions({
    query,
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
  // useCallback: lưới tuần dùng hàm này làm khoá cache — đổi tham chiếu mỗi
  // lần vẽ là mọi tuần đã tải phải lọc và vẽ lại từ đầu.
  const applyClientFilters = useCallback((list: TeachingSession[]) =>
    list.filter((session) => {
      if (status && session.status !== status) return false;
      if (unchecked && session.status !== "SCHEDULED") return false;
      // Cả khi vừa chấm "Có dạy" trên bảng (cập nhật lạc quan) — dòng ẩn
      // ngay, không đợi tải lại.
      if (hidePresent && session.status === "PRESENT") return false;
      const school = schools.find((item) => item.id === session.schoolId);
      if (provinceId === VUNG_TAU_REGION_ID && !school?.isVungTau) return false;
      if (provinceId === "6" && (school?.isVungTau || school?.isBinhDuong)) return false;
      if (onlyMakeup && !session.isMakeup) return false;
      if (checkinFilter === "yes" && session.checkinAt == null) return false;
      if (checkinFilter === "no" && session.checkinAt != null) return false;
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
      // BE chưa có tham số `progress` thì nó bị bỏ qua — vẫn lọc được ở đây.
      if (progressFilter === "complete" && !isReadyForBulkPresent(session)) return false;
      if (progressFilter === "incomplete" && isReadyForBulkPresent(session)) return false;
      return true;
    }),
  [
    status,
    unchecked,
    hidePresent,
    progressFilter,
    schools,
    provinceId,
    onlyMakeup,
    checkinFilter,
    checkoutFilter,
    imageFilter,
    rangeFilter,
    contentFilter,
  ]);

  const rows = applyClientFilters(items);

  /**
   * Buổi đã lọc của từng tuần, kèm lịch chờ xác nhận chiếu lên các ngày của
   * tuần đó. Cache theo đúng mảng buổi của tuần: tải thêm một tuần thì các
   * tuần cũ giữ nguyên mảng kết quả → lưới (đã memo) của chúng không vẽ lại.
   */
  const weekSessionsCache = useRef(
    new WeakMap<
      TeachingSession[],
      {
        pending: TeachingSchedule[];
        filter: typeof applyClientFilters;
        sessions: TeachingSession[];
      }
    >(),
  );
  const filteredTimetableWeeks = useMemo(
    () =>
      timetableWeekItems.map((week) => {
        const cached = weekSessionsCache.current.get(week.items);
        if (
          cached &&
          cached.pending === pendingSchedules &&
          cached.filter === applyClientFilters
        ) {
          return { ...week, sessions: cached.sessions };
        }
        const planned = plannedFromSchedules(
          pendingSchedules,
          datesInRange(week.from, week.to),
          week.items,
          { includePast: true },
        ).map((item) => ({
          ...item,
          scheduleResponseStatus: "PENDING" as const,
        }));
        const sessions = applyClientFilters([...week.items, ...planned]);
        weekSessionsCache.current.set(week.items, {
          pending: pendingSchedules,
          filter: applyClientFilters,
          sessions,
        });
        return { ...week, sessions };
      }),
    [timetableWeekItems, pendingSchedules, applyClientFilters],
  );
  const timetableRowCount = filteredTimetableWeeks.reduce(
    (sum, week) => sum + week.sessions.length,
    0,
  );
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
            name: `✓ Phù hợp · ${teacherLabel(teachers, candidate.teacherId, candidate.teacherName)}${
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
  }, [pendingSchedule, teachers]);

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
        name: `Chỉ định thủ công · ${formatTeacherLabel(teacher.name, teacher.phone)}`,
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

  // Khoảng ngày của bộ lọc, hiện trên nút chấm hàng loạt để biết sẽ chấm tới đâu.
  const rangeLabel =
    fromDate === toDate
      ? `ngày ${formatDayMonth(fromDate)}`
      : `${formatDayMonth(fromDate)} – ${formatDayMonth(toDate)}`;
  const [markingPresent, setMarkingPresent] = useState<{
    mode: MarkPresentMode;
    done: number;
    total: number;
  } | null>(null);

  // useCallback cho các hàm truyền xuống lưới tuần (đã memo) — tham chiếu
  // mới mỗi lần vẽ là mọi tuần vẽ lại.
  const toggleSelectSession = useCallback((session: TeachingSession) => {
    if (!isSelectableForAssign(session)) return;
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(session.id)) next.delete(session.id);
      else next.add(session.id);
      return next;
    });
  }, []);

  /** Chọn/bỏ chọn cả nhóm (một Thứ hoặc một Tiết) cùng lúc — bấm lại để bỏ hết. */
  const toggleSelectMany = useCallback((targets: TeachingSession[]) => {
    const ids = targets.filter(isSelectableForAssign).map((s) => s.id);
    if (ids.length === 0) return;
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);

  /** Bấm một ô trên lưới: buổi thật → chi tiết buổi; ô dự kiến → lịch chờ xác nhận. */
  const openTimetableSession = useCallback(
    (session: TeachingSession) => {
      if (!(session as CalendarSession).fromTemplate) {
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
    },
    [pendingSchedules],
  );

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

  /**
   * Chấm "Có dạy" hàng loạt trong **cả khoảng ngày đang lọc** — một ngày,
   * một tuần, một tháng hay khoảng tự chọn — không chỉ trang đang xem.
   *
   * - `eligible`: tiết đủ check-in, check-out và báo giảng.
   * - `ineligible`: tiết **chưa** đủ các căn cứ đó, cho trường hợp Nhân sự /
   *   Giáo vụ đã xác minh giáo viên có dạy (quên check-out, quên báo giảng…).
   *   Tiền công tính như tiết đã dạy nên chỉ lấy tiết đã qua giờ kết thúc và
   *   có giáo viên đứng tên — không bao giờ chấm trước tiết chưa diễn ra.
   *
   * Lưu thẳng theo lô 200 buổi (trần của API) sau khi xác nhận số lượng.
   * Không gửi ghi chú / chi phí khác nên những thứ đó giữ nguyên.
   */
  const markRangePresent = async (mode: MarkPresentMode) => {
    if (!rangeValid || markingPresent) return;

    // Tiết chưa tới ngày thì chưa dạy — khỏi tải phần tương lai của khoảng
    // lọc (lọc cả tháng mà phần lớn là ngày chưa dạy).
    const today = todayISO();
    const lastDate = toDate < today ? toDate : today;
    if (fromDate > lastDate) {
      toast(`Khoảng ${rangeLabel} chưa tới ngày dạy, chưa có tiết nào để chấm`);
      return;
    }
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const hasEnded = (session: TeachingSession) =>
      session.date < today ||
      (session.date === today && formatTime(session.endTime) <= nowTime);
    const hasTeacher = (session: TeachingSession) =>
      !!session.teacherId &&
      session.assignmentStatus === "ASSIGNED" &&
      !session.declinedAt;

    let done = 0;
    setMarkingPresent({ mode, done: 0, total: 0 });
    try {
      const { data } = await fetchAllPages<TeachingSession, SessionQuery>(
        teachingSessionApi.list,
        { ...query, toDate: lastDate, unchecked: true, limit: BULK_LIMIT },
        4,
      );
      const filtered = applyClientFilters(data);
      const matched =
        mode === "eligible"
          ? filtered.filter(isReadyForBulkPresent)
          : filtered.filter(
              (session) =>
                !isReadyForBulkPresent(session) &&
                hasEnded(session) &&
                hasTeacher(session),
            );
      // Dòng đang sửa dở trên bảng: quyết định chưa lưu của người dùng thắng,
      // để họ tự lưu — không ghi đè bằng "Có dạy".
      const targets = matched.filter((session) => !pending[session.id]);
      const keptForReview = matched.length - targets.length;
      const kindLabel =
        mode === "eligible"
          ? "đủ check-in, check-out và báo giảng"
          : "CHƯA đủ check-in, check-out và báo giảng";

      if (targets.length === 0) {
        toast(
          keptForReview > 0
            ? `${keptForReview} tiết đang được sửa dở trên bảng — lưu chúng bằng nút Lưu`
            : mode === "eligible"
              ? `Không có tiết nào trong khoảng ${rangeLabel} đủ check-in, check-out và báo giảng`
              : `Không có tiết nào trong khoảng ${rangeLabel} đã dạy xong mà còn thiếu căn cứ`,
        );
        return;
      }

      let detail = "";
      if (mode === "ineligible") {
        const missing = { checkin: 0, checkout: 0, report: 0 };
        targets.forEach((session) => {
          if (!session.checkinAt) missing.checkin += 1;
          if (!session.checkoutAt) missing.checkout += 1;
          if (!(session.lessonName?.trim() || session.lessonEvaluation?.trim())) {
            missing.report += 1;
          }
        });
        detail =
          "\n\nCác tiết này chưa có đủ căn cứ giảng dạy:" +
          `\n• ${missing.checkin} tiết chưa check-in` +
          `\n• ${missing.checkout} tiết chưa check-out` +
          `\n• ${missing.report} tiết chưa báo giảng` +
          "\n\nTiền công sẽ tính như tiết đã dạy. Chỉ chấm khi đã xác minh giáo viên thực sự có dạy." +
          "\n(Không tính tiết chưa qua giờ kết thúc, tiết chưa có giáo viên hoặc giáo viên đã từ chối.)";
      }

      if (
        !window.confirm(
          `Chấm "Có dạy" cho ${targets.length} tiết ${kindLabel} ` +
            `trong khoảng ${rangeLabel}` +
            (hasFilter ? " (theo bộ lọc đang chọn)" : "") +
            "?" +
            detail +
            (keptForReview > 0
              ? `\n\n${keptForReview} tiết đang sửa dở trên bảng được giữ nguyên để bạn tự lưu.`
              : ""),
        )
      ) {
        return;
      }

      setMarkingPresent({ mode, done: 0, total: targets.length });
      for (let i = 0; i < targets.length; i += BULK_LIMIT) {
        const chunk = targets.slice(i, i + BULK_LIMIT);
        await teachingSessionApi.bulkAttendance(
          chunk.map((session) => ({ sessionId: session.id, status: "PRESENT" })),
        );
        done += chunk.length;
        setMarkingPresent({ mode, done, total: targets.length });
      }
      toast.success(`Đã chấm "Có dạy" ${done} tiết trong khoảng ${rangeLabel}`);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(
          getApiErrorMessage(error, "Chấm Có dạy hàng loạt thất bại") +
            (done > 0 ? ` — đã lưu ${done} tiết trước khi lỗi` : ""),
        );
      }
    } finally {
      setMarkingPresent(null);
      if (done > 0) {
        void reload();
        void reloadTimetable();
      }
    }
  };

  // Cập nhật lạc quan 1 dòng từ response rồi đồng bộ lại danh sách.
  const applyUpdated = (updated: TeachingSession) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    // Hàm này chạy trên mảng buổi của TỪNG tuần: tuần không chứa buổi vừa sửa
    // phải giữ nguyên mảng cũ, không thì cả các tuần đó cũng vẽ lại.
    setTimetableItems((prev) =>
      prev.some((item) => item.id === updated.id)
        ? prev.map((item) => (item.id === updated.id ? updated : item))
        : prev,
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
    hidePresent || !!checkinFilter || !!checkoutFilter || !!imageFilter || !!rangeFilter || !!contentFilter ||
    !!progressFilter;

  const clearFilters = () => {
    setTeacherId("");
    setProvinceId("");
    setSchoolId("");
    setStatus("");
    setUnchecked(false);
    setOnlyMakeup(false);
    setHidePresent(false);
    setProgressFilter("");
    setCheckinFilter("");
    setCheckoutFilter("");
    setImageFilter("");
    setRangeFilter("");
    setContentFilter("");
  };

  /** Xuất toàn bộ buổi khớp bộ lọc, không phụ thuộc trang/chế độ đang xem. */
  const exportFilteredAttendance = async () => {
    if (!rangeValid || exporting) return;

    if (
      dirtyEntries.length > 0 &&
      !window.confirm(
        "Các thay đổi chấm công chưa lưu sẽ không có trong file xuất. Vẫn tiếp tục?",
      )
    ) {
      return;
    }

    setExporting(true);
    try {
      const { data } = await fetchAllPages<TeachingSession, SessionQuery>(
        teachingSessionApi.list,
        query,
        4,
      );
      const exportedRows = applyClientFilters(data);

      if (exportedRows.length === 0) {
        toast("Không có buổi dạy nào khớp bộ lọc để xuất");
        return;
      }

      const headers = [
        "STT",
        "Mã buổi",
        "Ngày",
        "Thứ",
        "Giờ bắt đầu",
        "Giờ kết thúc",
        "Giáo viên",
        "Trường",
        "Cơ sở",
        "Lớp",
        "Môn",
        "Số tiết",
        "Dạy bù",
        "Check-in",
        "Khoảng cách Check-in (m)",
        "Phạm vi Check-in",
        "Check-out",
        "Khoảng cách Check-out (m)",
        "Phạm vi Check-out",
        "Tên bài",
        "Đánh giá buổi học",
        "Sĩ số thực tế",
        "Số ảnh bài dạy",
        "Chi phí khác",
        "Trạng thái chấm công",
        "Người chấm",
        "Thời gian chấm",
        "Ghi chú",
      ];
      const body: SheetData = exportedRows.map((session, index) => [
        index + 1,
        session.id,
        formatDate(session.date),
        session.dayOfWeekLabel || "",
        formatTime(session.startTime),
        formatTime(session.endTime),
        teacherLabel(teachers, session.teacherId, session.teacherName),
        session.schoolName,
        session.locationName || "",
        classNameOf(session),
        session.subjectName,
        periodsOf(session),
        session.isMakeup ? "Có" : "Không",
        formatExportDateTime(session.checkinAt),
        session.checkinDistance,
        session.checkinAt ? rangeLabelOf(session.checkinOutOfRange) : "",
        formatExportDateTime(session.checkoutAt),
        session.checkoutDistance,
        session.checkoutAt ? rangeLabelOf(session.checkoutOutOfRange) : "",
        session.lessonName || "",
        session.lessonEvaluation || "",
        session.actualStudentCount,
        session.lessonImages?.length ?? 0,
        session.otherCostsTotal ?? costsTotal(costsOf(session)),
        session.statusLabel || SESSION_STATUS_META[session.status]?.label || session.status,
        session.checkedByName || "",
        formatExportDateTime(session.checkedAt),
        session.attendanceNote || "",
      ]);
      const sheetData: SheetData = [
        headers.map((value) => ({
          value,
          fontWeight: "bold" as const,
          textColor: "#ffffff",
          backgroundColor: "#047857",
          align: "center" as const,
          alignVertical: "center" as const,
          wrap: true,
          height: 30,
        })),
        ...body.map((row) =>
          row.map((cell) => ({
            value: cell ?? "",
            alignVertical: "top" as const,
            wrap: true,
          })),
        ),
      ];
      const columnWidths = [
        7, 11, 13, 12, 12, 12, 28, 30, 22, 20, 18, 10, 10, 22,
        20, 19, 22, 21, 19, 30, 40, 15, 17, 17, 22, 22, 22, 36,
      ];
      const { default: writeExcelFile } = await import("write-excel-file/browser");
      const blob = await writeExcelFile(sheetData, {
        sheet: "Chấm công",
        columns: columnWidths.map((width) => ({ width })),
        stickyRowsCount: 1,
        orientation: "landscape",
        zoomScale: 0.8,
      }).toBlob();

      await saveBlob(
        blob,
        `danh-sach-cham-cong_${fromDate}_${toDate}.xlsx`,
        EXCEL_FILE_TYPE,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xuất được danh sách chấm công"));
    } finally {
      setExporting(false);
    }
  };

  // Một thao tác ở tab khác có thể làm trang cuối không còn dòng nào. Lùi một
  // trang và để hook tải lại, tránh để người dùng mắc ở một trang rỗng giả.
  useEffect(() => {
    if (showAll) return;
    if (!loading && items.length === 0 && pagination.total > 0 && page > 1) {
      setPage(page - 1);
    }
  }, [showAll, items.length, loading, page, pagination.total]);

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
        <div className="flex flex-wrap gap-2 items-center md:col-span-2">
          {/* Thiếu chỗ (điện thoại) thì các nút chọn nhanh xuống dòng, không bóp ô ngày. */}
          <div className="flex flex-1 min-w-[17rem] items-center gap-2">
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
          </div>
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
            <button
              type="button"
              onClick={() => {
                setFromDate(startOfMonth(todayISO()));
                setToDate(endOfMonth(todayISO()));
              }}
              className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600"
            >
              Tháng này
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
            options={teachers.map((item) => ({ id: item.id, name: formatTeacherLabel(item.name, item.phone) }))}
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
            <label
              className="flex items-center gap-1.5 text-sm text-gray-600"
              title="Ẩn các tiết đã chấm “Có dạy” ở cả lưới TKB và bảng chi tiết — chỉ còn tiết cần xử lý"
            >
              <input
                type="checkbox"
                checked={hidePresent}
                onChange={(e) => setHidePresent(e.target.checked)}
              />
              Ẩn tiết Có dạy
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportFilteredAttendance}
              disabled={!rangeValid || exporting}
              title="Xuất toàn bộ danh sách chấm công theo các bộ lọc đang chọn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              {exporting ? "Đang xuất…" : "Xuất danh sách"}
            </button>
            {hasFilter && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500"
              >
                Xoá lọc
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:col-span-4 md:grid-cols-3 lg:grid-cols-6">
          <select
            value={progressFilter}
            onChange={(e) => setProgressFilter(e.target.value as typeof progressFilter)}
            className={selectClass}
            aria-label="Tiến độ IN · OUT · BG"
            title="IN = check-in, OUT = check-out, BG = báo giảng (như nhãn trên lưới)"
          >
            <option value="">Mọi tiến độ IN·OUT·BG</option>
            <option value="complete">Đủ IN · OUT · BG</option>
            <option value="incomplete">Thiếu IN / OUT / BG</option>
          </select>
          <select value={checkinFilter} onChange={(e) => setCheckinFilter(e.target.value as typeof checkinFilter)} className={selectClass} aria-label="Trạng thái Check-in">
            <option value="">Mọi Check-in</option><option value="yes">Đã Check-in</option><option value="no">Chưa Check-in</option>
          </select>
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
        {(checkinFilter || checkoutFilter || imageFilter || rangeFilter || contentFilter) && (
          <p className="text-[11px] text-amber-600 md:col-span-4">Trên bảng, các bộ lọc Check-in, Check-out, ảnh, phạm vi và nội dung chỉ áp dụng cho trang hiện tại; file xuất sẽ áp dụng trên toàn bộ dữ liệu.</p>
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
              options={teachers.filter((item) => item.isActive).map((item) => ({ id: item.id, name: formatTeacherLabel(item.name, item.phone) }))}
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => markRangePresent("eligible")}
            disabled={!rangeValid || !!markingPresent || saving}
            title="Chấm Có dạy cho mọi tiết đã check-in, check-out và báo giảng trong cả khoảng ngày đang lọc (không chỉ trang đang xem)"
            className="flex-1 min-w-[16rem] flex items-center justify-center gap-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={16} />
            {markingPresent?.mode === "eligible"
              ? markingPresent.total > 0
                ? `Đang chấm ${markingPresent.done}/${markingPresent.total} tiết…`
                : "Đang tìm tiết đủ điều kiện…"
              : `Chấm Có dạy mọi tiết đủ điều kiện · ${rangeLabel}`}
          </button>
          <button
            onClick={() => markRangePresent("ineligible")}
            disabled={!rangeValid || !!markingPresent || saving}
            title="Chấm Có dạy cho tiết đã qua giờ kết thúc nhưng còn thiếu check-in, check-out hoặc báo giảng — chỉ dùng khi đã xác minh giáo viên có dạy"
            className="flex-1 min-w-[16rem] flex items-center justify-center gap-1 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AlertTriangle size={16} />
            {markingPresent?.mode === "ineligible"
              ? markingPresent.total > 0
                ? `Đang chấm ${markingPresent.done}/${markingPresent.total} tiết…`
                : "Đang tìm tiết chưa đủ điều kiện…"
              : `Chấm Có dạy tiết chưa đủ điều kiện · ${rangeLabel}`}
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
          {showAll ? (
            infinite.hasMore && (
              <p className="text-[11px] text-gray-400">
                Chỉ tính {rows.length} buổi đã tải trên {totalSessions} buổi.
                Cuộn hết bảng chi tiết hoặc xem tab “Tổng hợp” để có tổng đầy đủ.
              </p>
            )
          ) : pagination.totalPages > 1 && (
            <p className="text-[11px] text-gray-400">
              Chỉ tính {rows.length} buổi của trang {page}/{pagination.totalPages}
              . Thu hẹp khoảng ngày hoặc xem tab “Tổng hợp” để có tổng đầy đủ.
            </p>
          )}
        </div>
      )}

      {resultsLoading && <Loading />}

      {!resultsLoading && rows.length === 0 && timetableRowCount === 0 && (
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

      {/* Lưới tự tải thêm tuần khi cuộn qua nên bảng chi tiết bên dưới cứ bị
          đẩy xuống — cho lối tắt nhảy thẳng tới đó. Nhảy tức thì (không cuộn
          mượt) để không đi ngang qua mốc tự tải và kích hoạt nó. */}
      {!timetableLoading && hasMoreWeeks && rows.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("attendance-detail")
                ?.scrollIntoView({ block: "start" })
            }
            className="text-xs font-medium text-gray-600 hover:underline"
          >
            Xuống bảng chi tiết chấm công ↓
          </button>
        </div>
      )}

      {/* Mỗi tuần một lưới riêng — lọc nhiều tuần không còn dồn các ngày khác
          nhau vào cùng một ô Thứ + giờ. */}
      {!timetableLoading &&
        filteredTimetableWeeks.map((week) =>
          week.sessions.length > 0 ? (
            <SessionTimetable
              key={week.from}
              anchorDate={week.from}
              sessions={week.sessions}
              selectable={canManage ? isSelectableForAssign : undefined}
              selectedIds={canManage ? selectedSessionIds : undefined}
              onToggleSelect={canManage ? toggleSelectSession : undefined}
              onToggleMany={canManage ? toggleSelectMany : undefined}
              onSelect={openTimetableSession}
              showAttendanceBadges
              teachers={teachers}
            />
          ) : allWeeks.length > 1 ? (
            <p
              key={week.from}
              className="rounded-xl border border-dashed border-gray-200 px-4 py-2 text-center text-xs text-gray-400"
            >
              Tuần {formatDayMonth(week.from)} – {formatDayMonth(week.to)}: không có buổi dạy
            </p>
          ) : null,
        )}

      {!timetableLoading && hasMoreWeeks && nextWeek && (
        <InfiniteScrollSentinel
          onVisible={loadMoreWeeks}
          disabled={loadingWeeks || timetableFailed}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500">
            {loadingWeeks ? (
              <span className="animate-pulse">Đang tải thời khoá biểu…</span>
            ) : (
              <>
                <span>
                  {timetableFailed ? "Không tải được tuần " : "Cuộn xuống để xem tuần "}
                  {formatDayMonth(nextWeek.from)} – {formatDayMonth(nextWeek.to)}
                  {` (đã hiện ${timetableWeekItems.length}/${allWeeks.length} tuần)`}
                </span>
                <button
                  type="button"
                  onClick={loadMoreWeeks}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {timetableFailed ? "Thử lại" : "Tải ngay"}
                </button>
              </>
            )}
          </div>
        </InfiniteScrollSentinel>
      )}

      {!loading && rows.length > 0 && (
        <div id="attendance-detail" className="flex items-center justify-between pt-1 scroll-mt-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Chi tiết chấm công</h3>
            <p className="text-[11px] text-gray-400">Sửa trạng thái và ghi chú theo từng buổi</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              {showAll
                ? `Đã hiện ${items.length} / ${totalSessions} buổi`
                : pagination.total === 0
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
                  const value = event.target.value;
                  setPageSize(value === SHOW_ALL ? SHOW_ALL : Number(value));
                }}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
                aria-label="Số dòng mỗi trang"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}/trang
                  </option>
                ))}
                <option value={SHOW_ALL}>Xem tất cả</option>
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
                    title={
                      showAll
                        ? "Chọn tất cả tiết chưa chấm công đang hiện trong bảng"
                        : "Chọn tất cả tiết chưa chấm công trên trang này"
                    }
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
                        {teacherLabel(teachers, session.teacherId, session.teacherName)}
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

      {showAll ? (
        !loading &&
        (infinite.hasMore || infinite.failed) && (
          <InfiniteScrollSentinel
            onVisible={infinite.loadMore}
            disabled={infinite.loading || infinite.failed}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500">
              {infinite.loading ? (
                <span className="animate-pulse">Đang tải thêm buổi dạy…</span>
              ) : (
                <>
                  <span>
                    {infinite.failed
                      ? "Không tải được thêm buổi dạy."
                      : `Đã hiện ${items.length} / ${totalSessions} buổi — cuộn xuống để tải thêm.`}
                  </span>
                  <button
                    type="button"
                    onClick={infinite.loadMore}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {infinite.failed ? "Thử lại" : "Tải thêm"}
                  </button>
                </>
              )}
            </div>
          </InfiniteScrollSentinel>
        )
      ) : (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          onChange={changePage}
          disabled={loading || saving}
        />
      )}

      {bulkAssignOpen && bulkAssignTeacherId && (
        <ConfirmModal
          title="Đổi giáo viên cho các tiết đã chọn"
          message={
            <>
              Đổi giáo viên cho <b>{selectedSessionIds.size} tiết</b> đã chọn
              sang{" "}
              <b>{teacherLabel(teachers, bulkAssignTeacherId)}</b>?
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
                <b>{teacherLabel(teachers, pendingSchedule.teacherId, pendingSchedule.teacherName)}</b>
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
