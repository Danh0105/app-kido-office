import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, ArrowRightLeft, CalendarPlus, CalendarRange, ChevronDown, ChevronUp, Eraser, Plus, Sparkles, Trash2, X } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teacherApi, teachingBulkApi, teachingScheduleApi } from "@/service/teaching";
import {
  DAY_OF_WEEK_OPTIONS,
  type BulkResultRow,
  type BulkScheduleItem,
  type ScheduleQuery,
  type SchoolClass,
  type Teacher,
  type TeachingSchedule,
} from "@/types/teaching";

import SearchableSelect from "@/components/SearchableSelect";
import "./TimetableTab.css";
import { NoClassNotice } from "../components/ClassSelect";
import GenerateSessionsModal from "../components/GenerateSessionsModal";
import ScheduleFormModal from "../components/ScheduleFormModal";
import DragScrollContainer from "../components/DragScrollContainer";
import { ConfirmModal, Field, inputClass } from "../components/Modal";
import {
  useClassesOfSchool,
  useLocationsOfSchool,
  useSchoolPeriodRows,
  useSchoolsOfTeacher,
  useSchoolYearsOfSchool,
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import { schoolPeriodApi } from "@/service/school.api";
import { fetchAllPages } from "../pagedList";
import {
  appendMissingTimetableRows,
  normalizeTimetableRows as normalizeRows,
  timetableSlotKey,
  updateTimetableRowTime,
} from "../timetableRows";
import {
  catalogsOfSubjects,
  cellKey,
  currentSchoolYear,
  daysBetween,
  DEFAULT_TIMETABLE_DAYS,
  DEFAULT_TIMETABLE_ROWS,
  endOfMonth,
  formatDate,
  formatTime,
  isDateOrderValid,
  isTimeOrderValid,
  inLocationScope,
  isValidPeriods,
  locationScopeOptions,
  MAX_BULK_ITEMS,
  MAX_GENERATE_DAYS,
  MAX_PERIODS,
  SESSION_LABELS,
  teacherColor,
  todayISO,
  type SchoolCatalogOption,
  type TimetableRow,
} from "../lib";

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
  /** Role chỉ-xem vẫn đọc được TKB nhưng không sửa được ô nào. */
  canManage: boolean;
  /** Xếp xong có thể sinh buổi luôn → tab "Buổi dạy" phải tải lại. */
  onCreated: () => void;
  /**
   * Bộ lọc mở sẵn khi tới từ màn khác (VD: nhập TKB bằng ảnh xong bấm sang xem
   * kết quả). Chỉ là giá trị khởi tạo — sau đó Nhân sự đổi thoải mái.
   */
  initialSchoolId?: string;
  initialTeacherId?: string;
  initialSchoolYear?: string;
  /** Mở thẳng mẫu lịch bị từ chối từ notification Nhân sự nhận được. */
  focusScheduleId?: number;
};

/** Nội dung một ô: lớp nào, ai dạy. */
/** `catalogId` rỗng = dùng môn đang chọn ở tiêu đề TKB. */
type Cell = { classId: string; teacherId: string; catalogId: string };
type CellDrafts = Record<string, Cell[]>;

/** Kết quả trả về của ô sau khi lưu — ô bị bỏ qua giữ nguyên lý do để sửa. */
type CellResult = { status: "CREATED" | "SKIPPED"; reason?: string };

/**
 * Bề ngang tối thiểu của lưới — đọc theo cách của bảng chấm công: mỗi cột đủ chỗ
 * cho tên lớp và tên giáo viên đầy đủ, thừa ra thì kéo ngang, không bóp chữ.
 */
const DESKTOP_COLUMNS = {
  session: 56,
  period: 92,
  time: 248,
  class: 128,
  subject: 150,
  teacher: 224,
};
/**
 * Điện thoại: ba cột dính bên trái phải gọn (≈150px) để còn chỗ nhìn thấy ít
 * nhất một thứ; khung giờ xếp dọc 2 dòng, cột Buổi thu thành dải mảnh.
 */
const MOBILE_COLUMNS = {
  session: 24,
  period: 40,
  time: 60,
  // Lớp / Môn / GV xếp dọc trong một ô, nên 3 cột con chia đều ~210px.
  class: 70,
  subject: 70,
  teacher: 70,
};
const MOBILE_QUERY = "(max-width: 767px)";

const useIsMobile = () => {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return mobile;
};

/** Phần nào của tiêu đề TKB đang được sửa tại chỗ. */
type EditingField =
  | "school"
  | "location"
  | "catalog"
  | "year"
  | "range"
  | null;

/**
 * Xếp thời khoá biểu theo lưới **tiết × thứ**, đúng dạng TKB giấy nhà trường
 * đang dùng: mỗi ô là một lớp + một giáo viên.
 *
 * Mỗi ô đã điền tương ứng **một mẫu lịch tuần**; giờ của mẫu lấy theo dòng tiết
 * nên sửa giờ một dòng là đổi cho cả hàng ngang.
 *
 * Lưu bằng `POST /teaching-schedules/bulk` nên mọi kiểm tra trùng lịch của
 * backend vẫn nguyên vẹn — ô nào lỗi thì bỏ qua đúng ô đó kèm lý do, các ô còn
 * lại vẫn được tạo.
 */

/** Tên trường kèm xã/phường, vd "TH Phú Hội – Xã Phú Hội". */
function schoolLabel(school: RefOption) {
  return school.wardName ? `${school.name} – ${school.wardName}` : school.name;
}

export default function TimetableTab({
  teachers,
  schools,
  canManage,
  onCreated,
  initialSchoolId = "",
  initialTeacherId = "",
  initialSchoolYear = "",
  focusScheduleId,
}: Props) {
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const isMobile = useIsMobile();
  const columns = isMobile ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
  const gridFixedWidth = columns.session + columns.period + columns.time;
  // Bộ ba cột Lớp + Môn + GV dạy của một thứ.
  const dayColumnWidth = columns.class + columns.subject + columns.teacher;
  // Mobile bỏ hàng tiêu đề phụ Lớp/Môn/GV vì ô đã xếp dọc.
  const headerRows = isMobile ? 1 : 2;
  /** "" = cả trường (mọi cơ sở). Chỉ có nghĩa khi trường đã khai điểm trường. */
  const [schoolLocationId, setSchoolLocationId] = useState("");
  const [schoolYear, setSchoolYear] = useState(initialSchoolYear);
  const [catalogId, setCatalogId] = useState("");
  const [defaultTeacherId, setDefaultTeacherId] = useState(initialTeacherId);

  const [days, setDays] = useState<number[]>(DEFAULT_TIMETABLE_DAYS);
  const [rows, setRows] = useState<TimetableRow[]>(DEFAULT_TIMETABLE_ROWS);
  /** Chỉ lưu khung khi người dùng sửa, không ghi lại dữ liệu vừa tải. */
  const rowsEditedRef = useRef(false);
  /**
   * Khung giờ của từng dòng tiết ở lần lưu gần nhất (`rowKey` → `slotKey`).
   * Sửa giờ một dòng là **đổi giờ của chính tiết đó**: mẫu lịch đã xếp ở
   * khung giờ cũ phải được cập nhật sang giờ mới, nếu không chúng rớt lại
   * khung cũ và `appendMissingTimetableRows` lại đẻ ra một dòng tiết "?" mới.
   */
  const persistedSlotsRef = useRef<Map<string, string>>(new Map());
  const snapshotSlots = (list: TimetableRow[]) => {
    const map = new Map<string, string>();
    list.forEach((row) => {
      if (row.isPeriod && row.startTime && row.endTime) {
        map.set(row.key, timetableSlotKey(row.startTime, row.endTime));
      }
    });
    return map;
  };
  const [cells, setCells] = useState<CellDrafts>({});

  const [periods, setPeriods] = useState("1");
  // Lịch đột xuất phải áp dụng ngay hôm nay: mặc định "Hiệu lực từ" là hôm
  // nay, không lùi về đầu tháng (đầu tháng chỉ sinh buổi quá khứ vô nghĩa).
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [effectiveTo, setEffectiveTo] = useState(endOfMonth(todayISO()));
  // Mặc định chỉ lưu mẫu lịch — sinh buổi là bước riêng qua nút "Sinh buổi dạy",
  // tránh sinh nhầm hàng loạt buổi khi chỉ đang lưu một ô mới xếp.
  const [generate, setGenerate] = useState(false);

  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Mẫu lịch đã xếp của trường — hiện thẳng lên lưới, không còn tab riêng.
  const [existing, setExisting] = useState<TeachingSchedule[]>([]);
  const [rejectedSchedules, setRejectedSchedules] = useState<TeachingSchedule[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TeachingSchedule | null>(null);
  const [rejectedDetail, setRejectedDetail] = useState<TeachingSchedule | null>(null);
  /** Mẫu lịch đã lưu đang mở ra sửa (đổi lớp / đổi giáo viên / đổi giờ). */
  const [editTarget, setEditTarget] = useState<TeachingSchedule | null>(null);
  const [replaceTeacherId, setReplaceTeacherId] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteTeacherOpen, setDeleteTeacherOpen] = useState(false);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [deleteSchoolOpen, setDeleteSchoolOpen] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState(false);
  const [bulkReplaceTeacherId, setBulkReplaceTeacherId] = useState("");
  const [bulkReplaceOpen, setBulkReplaceOpen] = useState(false);
  const [bulkReplacing, setBulkReplacing] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [cellResults, setCellResults] = useState<Record<string, CellResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lớp chỉ cần khi xếp lịch; role chỉ-xem không được đọc /school-classes nên
  // đừng gọi để khỏi nhận 403 (lưới TKB đã có tên lớp trong mẫu lịch).
  // Khung giờ tiết riêng của trường; null = trường chưa khai, dùng khung mặc định.
  const { rows: savedRows, loading: loadingPeriodRows } = useSchoolPeriodRows(schoolId);

  const { classes, loading: loadingClasses } = useClassesOfSchool(schoolId, {
    enabled: canManage,
  });
  // Trường một cơ sở trả mảng rỗng → không hiện ô chọn điểm trường.
  const { locations } = useLocationsOfSchool(schoolId);
  const { years } = useSchoolYearsOfSchool(schoolId, {
    includeClasses: canManage,
  });
  // Môn xếp lịch được là môn **trường đã khai**, không phải cả danh mục dùng chung.
  const { subjects, loading: loadingSubjects } = useSubjectsOfSchool(schoolId);
  // Trường đã lên TKB cho giáo viên đang chọn — dùng để thu gọn danh sách trường.
  const { schoolIds: teacherSchoolIds, loading: loadingTeacherSchools } =
    useSchoolsOfTeacher(defaultTeacherId);

  // Đổi trường → lưới cũ vô nghĩa vì lớp và môn đều thuộc về trường.
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setCatalogId("");
    setCells({});
    setCellResults({});
    // Điểm trường thuộc về một trường cụ thể — giữ lại là lọc theo cơ sở của
    // trường cũ, lưới sẽ trống trơn mà không rõ vì sao.
    setSchoolLocationId("");
  };

  /** Đổi cơ sở → bỏ các ô đang soạn dở, vì lớp của cơ sở cũ không còn hợp lệ. */
  const changeSchoolLocation = (value: string) => {
    setSchoolLocationId(value);
    setCells({});
    setCellResults({});
  };

  // Trường có năm học nào thì chọn sẵn năm mới nhất.
  useEffect(() => {
    if (years.length > 0) setSchoolYear((prev) => prev || years[0]);
  }, [years]);

  /**
   * Mẫu lịch đang áp dụng của trường. Không chọn giáo viên = xem cả TKB của
   * trường; chọn một giáo viên = chỉ lịch của người đó (và ô mới tạo cũng mặc
   * định là người đó).
   */
  const existingRequestRef = useRef(0);
  const loadExisting = useCallback(async () => {
    const requestId = ++existingRequestRef.current;
    if (!schoolId) {
      setExisting([]);
      return;
    }

    try {
      // BE chặn tối đa 100 dòng/trang dù xin nhiều hơn — trường đông tiết phải
      // đọc hết các trang, không thì các tiết cuối tuần rớt khỏi lưới.
      const res = await fetchAllPages<TeachingSchedule, ScheduleQuery>(teachingScheduleApi.list, {
        schoolId: Number(schoolId),
        schoolLocationId: schoolLocationId
          ? Number(schoolLocationId)
          : undefined,
        teacherId: defaultTeacherId ? Number(defaultTeacherId) : undefined,
        isActive: true,
        limit: MAX_BULK_ITEMS,
      });
      if (requestId !== existingRequestRef.current) return;
      setExisting(res?.data || []);
    } catch (error: any) {
      if (requestId !== existingRequestRef.current) return;
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải được mẫu lịch đã xếp"));
      }
      setExisting([]);
    }
  }, [schoolId, schoolLocationId, defaultTeacherId]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const rejectedRequestRef = useRef(0);
  const loadRejected = useCallback(async () => {
    const requestId = ++rejectedRequestRef.current;
    try {
      const res = await fetchAllPages<TeachingSchedule, ScheduleQuery>(teachingScheduleApi.list, {
        confirmationStatus: "REJECTED",
        schoolId: schoolId ? Number(schoolId) : undefined,
        schoolLocationId: schoolLocationId
          ? Number(schoolLocationId)
          : undefined,
        teacherId: defaultTeacherId ? Number(defaultTeacherId) : undefined,
        limit: 100,
      });
      if (requestId !== rejectedRequestRef.current) return;
      // Phòng trường hợp BE phiên bản cũ bỏ qua query confirmationStatus: chỉ
      // giữ đúng mẫu REJECTED để không ghép lặp toàn bộ lịch chính lên lưới.
      setRejectedSchedules(
        (res?.data || []).filter(
          (item) => String(item.confirmationStatus).toUpperCase() === "REJECTED",
        ),
      );
    } catch (error: any) {
      if (requestId !== rejectedRequestRef.current) return;
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải được các tiết giáo viên từ chối"));
      }
      setRejectedSchedules([]);
    }
  }, [schoolId, schoolLocationId, defaultTeacherId]);

  /**
   * Xếp giáo viên khác cho mẫu lịch đã bị từ chối. Backend tự chuyển
   * `confirmationStatus` về PENDING và gửi yêu cầu xác nhận cho người mới —
   * không cần Nhân sự tạo lại mẫu lịch từ đầu.
   */
  const replaceRejectedTeacher = async () => {
    if (!rejectedDetail || !replaceTeacherId) return;
    setReplacing(true);
    try {
      await teachingScheduleApi.update(rejectedDetail.id, {
        teacherId: Number(replaceTeacherId),
      });
      toast.success("Đã xếp giáo viên khác, chờ giáo viên mới xác nhận");
      setRejectedDetail(null);
      loadExisting();
      loadRejected();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xếp giáo viên khác thất bại"));
      }
    } finally {
      setReplacing(false);
    }
  };

  const [replacementOptions, setReplacementOptions] = useState<RefOption[]>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);

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

  useEffect(() => {
    loadRejected();
  }, [loadRejected]);

  // Tới từ notification "giáo viên từ chối lịch dạy" — mở thẳng popup chi
  // tiết, đồng thời chuyển ô lọc trường đúng theo mẫu lịch đó.
  const openedNotificationRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focusScheduleId || openedNotificationRef.current === focusScheduleId) {
      return;
    }
    openedNotificationRef.current = focusScheduleId;
    teachingScheduleApi
      .findOne(focusScheduleId)
      .then((schedule) => {
        setSchoolId(String(schedule.schoolId));
        setRejectedDetail(schedule);
      })
      .catch(() => {
        // Notification cũ hoặc mẫu lịch đã bị xoá/đổi trạng thái — bỏ qua.
      });
  }, [focusScheduleId]);

  /** Mẫu lịch lưu `subjectId` là môn *của trường*; bộ lọc ở tiêu đề chọn theo
   * danh mục dùng chung nên phải quy về `catalogId` mới so được. */
  const catalogOfSubject = useMemo(() => {
    const map = new Map<number, number>();
    subjects.forEach((item) => {
      if (item.catalogId) map.set(item.id, item.catalogId);
    });
    return map;
  }, [subjects]);

  /** Không chọn môn = xem đủ mọi môn; chọn rồi thì chỉ lịch của môn đó. */
  const matchesCatalog = useCallback(
    (item: TeachingSchedule) =>
      !catalogId || catalogOfSubject.get(item.subjectId) === Number(catalogId),
    [catalogId, catalogOfSubject],
  );

  /** Mẫu lịch của từng ô, khớp theo thứ + cả giờ bắt đầu và kết thúc của dòng tiết. */
  const existingByCell = useMemo(() => {
    const map = new Map<string, TeachingSchedule[]>();

    existing.forEach((item) => {
      if (String(item.schoolId) !== schoolId) return;
      if (!matchesCatalog(item)) return;
      const key = `${item.dayOfWeek}|${timetableSlotKey(item.startTime, item.endTime)}`;
      map.set(key, [...(map.get(key) || []), item]);
    });

    return map;
  }, [existing, schoolId, matchesCatalog]);

  /** Mẫu bị từ chối không còn nằm trong danh sách lịch hoạt động, nhưng vẫn
   * phải hiện đúng ô để Nhân sự nhìn thấy và xếp giáo viên mới ngay bên dưới. */
  const rejectedByCell = useMemo(() => {
    const map = new Map<string, TeachingSchedule[]>();
    rejectedSchedules.forEach((item) => {
      if (String(item.schoolId) !== schoolId) return;
      if (!matchesCatalog(item)) return;
      // Endpoint lịch chính có thể đã bao gồm REJECTED; cùng id chỉ vẽ một lần.
      if (existing.some((saved) => saved.id === item.id)) return;
      const key = `${item.dayOfWeek}|${timetableSlotKey(item.startTime, item.endTime)}`;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [existing, rejectedSchedules, schoolId, matchesCatalog]);

  /**
   * TKB xếp cho một năm học; lớp năm khác lọt vào lưới là xếp nhầm khoá.
   * Đang lọc theo một cơ sở thì cũng chỉ được xếp lớp của chính cơ sở đó —
   * lớp cơ sở khác lọt vào là giáo viên bị điều tới nhầm địa điểm.
   */
  const classOptions = useMemo(() => {
    let list = schoolYear
      ? classes.filter((item) => item.schoolYear === schoolYear)
      : classes;

    // "Trường chính" (0) chỉ lấy lớp chưa gắn điểm trường — lớp các cơ sở là
    // phạm vi riêng, không trộn vào.
    return list.filter((item) =>
      inLocationScope(item.schoolLocationId, schoolLocationId),
    );
  }, [classes, schoolYear, schoolLocationId]);

  /** Môn của trường trong đúng năm học đang xếp — gộp về danh mục dùng chung. */
  const catalogOptions = useMemo(
    () => catalogsOfSubjects(subjects, schoolYear),
    [subjects, schoolYear],
  );

  // Trường có môn nhưng ở năm khác thì phải nói rõ, không để danh sách rỗng im lặng.
  const hasOtherYearSubjects =
    catalogOptions.length === 0 && catalogsOfSubjects(subjects).length > 0;

  const school = schools.find((item) => String(item.id) === schoolId);
  const catalog = catalogOptions.find((item) => String(item.id) === catalogId);

  /**
   * Chọn một giáo viên rồi thì danh sách trường thu về đúng những trường đã lên
   * TKB cho người đó — hơn 200 trường mà chỉ vài trường có lịch của họ, cuộn tìm
   * là mất công vô ích.
   *
   * Trường đang chọn luôn được giữ lại kể cả khi giáo viên chưa có lịch ở đó:
   * bỏ ra thì ô select mất tên trường trong khi tiêu đề TKB vẫn hiện, nhìn như
   * hỏng. Chưa chọn giáo viên (hoặc đang tải) thì hiện đủ như cũ.
   */
  const schoolOptions = useMemo(() => {
    const allowed = new Set(teacherSchoolIds);
    const list =
      !defaultTeacherId || loadingTeacherSchools
        ? schools
        : schools.filter(
            (item) => allowed.has(item.id) || String(item.id) === schoolId,
          );
    // Nhiều trường trùng tên ở các xã/phường khác nhau — ghép tên xã/phường
    // vào nhãn để phân biệt (và tìm được theo xã/phường).
    return list.map((item) => ({ ...item, name: schoolLabel(item) }));
  }, [
    schools,
    defaultTeacherId,
    loadingTeacherSchools,
    teacherSchoolIds,
    schoolId,
  ]);

  /** Giáo viên chưa có mẫu lịch ở đâu → không thu gọn được gì, phải nói rõ. */
  const teacherHasNoSchool =
    !!defaultTeacherId && !loadingTeacherSchools && teacherSchoolIds.length === 0;

  // Nói thẳng danh sách trường đang bị thu gọn, nếu không người dùng tưởng mất trường.
  const teacherHint = !defaultTeacherId
    ? "Chọn một người: lưới chỉ hiện lịch của người đó và ô mới tự điền sẵn."
    : loadingTeacherSchools
      ? "Đang tìm các trường đã lên TKB cho giáo viên này…"
      : teacherHasNoSchool
        ? "Giáo viên này chưa có TKB ở trường nào. Bỏ chọn để xem đủ danh sách trường."
        : `Danh sách trường thu về ${teacherSchoolIds.length} trường đã lên TKB cho giáo viên này.`;

  // Đổi năm học → môn đang chọn có thể không còn được khai ở năm đó.
  useEffect(() => {
    if (loadingSubjects) return;
    setCatalogId((prev) =>
      prev && !catalogOptions.some((item) => String(item.id) === prev)
        ? ""
        : prev,
    );
  }, [catalogOptions, loadingSubjects]);

  const periodRows = rows.filter((row) => row.isPeriod);

  const setCell = (key: string, index: number, patch: Partial<Cell>) => {
    setCells((prev) => {
      const next = { ...prev };
      // catalogId "" = đi theo môn ở tiêu đề (đổi tiêu đề là đổi theo).
      const empty: Cell = { classId: "", teacherId: "", catalogId: "" };
      const drafts = [...(prev[key] ?? [empty])];
      const base: Cell = drafts[index] ?? empty;
      const merged: Cell = { ...base, ...patch };

      // Bỏ lớp = bỏ đúng dòng nháp, không ảnh hưởng lớp khác cùng khung giờ.
      if (!merged.classId) drafts.splice(index, 1);
      else drafts[index] = merged;
      if (drafts.length === 0) delete next[key];
      else next[key] = drafts;

      return next;
    });
    // Ô vừa sửa thì kết quả lần lưu trước không còn đúng nữa.
    const resultKey = `${key}#${index}`;
    setCellResults((prev) => {
      if (!prev[resultKey]) return prev;
      const next = { ...prev };
      delete next[resultKey];
      return next;
    });
  };

  /** Chọn lớp ở ô trống thì điền luôn giáo viên mặc định — đỡ 1 thao tác/ô. */
  const pickClass = (key: string, index: number, value: string) =>
    setCell(key, index, {
      classId: value,
      ...(value && !cells[key]?.[index]?.teacherId && defaultTeacherId
        ? { teacherId: defaultTeacherId }
        : {}),
    });

  const addCellDraft = (key: string) =>
    setCells((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        { classId: "", teacherId: defaultTeacherId, catalogId: "" },
      ],
    }));

  /**
   * Dựng một bản nháp TKB để Nhân sự duyệt trước khi lưu. Ưu tiên giáo viên
   * backend gợi ý theo lớp + môn, rồi giáo viên mặc định, rồi người đủ năng lực.
   * Chỉ dùng ô hoàn toàn trống để không đè lịch thật hoặc bản nháp người dùng.
   */
  const suggestTimetable = async () => {
    if (!schoolId || !schoolYear || !catalogId) {
      toast.error("Chọn trường, năm học và môn trước khi gợi ý");
      return;
    }

    const alreadyScheduled = new Set(
      existing
        .filter((item) => item.classId != null)
        .map((item) => Number(item.classId)),
    );
    Object.values(cells).flat().forEach((cell) => {
      if (cell.classId) alreadyScheduled.add(Number(cell.classId));
    });

    const waiting = classOptions.filter((item) => !alreadyScheduled.has(item.id));
    const slots = periodRows.flatMap((row) =>
      days.map((day) => ({ row, day, key: cellKey(row.key, day) })),
    ).filter(({ row, day, key }) =>
      !(cells[key]?.length) &&
      !(existingByCell.get(`${day}|${timetableSlotKey(row.startTime, row.endTime)}`)?.length),
    );

    if (waiting.length === 0) {
      toast("Tất cả lớp của năm học này đã có trên TKB");
      return;
    }
    if (slots.length === 0) {
      toast.error("Không còn ô trống để tạo gợi ý");
      return;
    }

    setSuggesting(true);
    const next: CellDrafts = { ...cells };
    let added = 0;
    let unavailable = 0;
    try {
    // API hiện gợi ý theo một lớp + một khung giờ, nên gọi tuần tự để bản nháp
    // vừa chọn không làm người dùng tưởng nhiều lớp đã được kiểm tra cùng lúc.
    for (const [index, schoolClass] of waiting.slice(0, slots.length).entries()) {
      const subject = schoolClass.subjects?.find(
        (item) => item.catalogId === Number(catalogId),
      );
      if (!subject?.id) { unavailable += 1; continue; }

      try {
        const candidates = await teacherApi.candidates({
          schoolId: schoolClass.schoolId,
          subjectId: subject.id,
          dayOfWeek: slots[index].day,
          startTime: slots[index].row.startTime,
          endTime: slots[index].row.endTime,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          periods: Number(periods),
        });
        // Backend đã xếp đúng thứ tự; tuyệt đối không chọn người eligible=false.
        const teacher = candidates.candidates.find((item) => item.eligible);
        if (!teacher) { unavailable += 1; continue; }

        next[slots[index].key] = [{
          classId: String(schoolClass.id),
          teacherId: String(teacher.teacherId),
          catalogId,
        }];
        added += 1;
      } catch {
        unavailable += 1;
      }
    }

    setCells(next);
    setCellResults({});
    if (added === 0) toast.error("Chưa có giáo viên phù hợp để tạo gợi ý");
    else toast.success(`Đã gợi ý ${added} lớp${unavailable ? `, ${unavailable} lớp chưa có giáo viên phù hợp` : ""} — kiểm tra lại trước khi lưu`);
    } finally {
      setSuggesting(false);
    }
  };

  /**
   * Đổi trường thì nạp khung tiết đã lưu của trường đó; trường chưa khai thì
   * quay về khung mặc định. `savedRows` chỉ đổi khi tải xong nên không đè lên
   * thao tác người dùng đang sửa dở.
   */
  useEffect(() => {
    if (loadingPeriodRows) return;
    const loaded = normalizeRows(savedRows ?? DEFAULT_TIMETABLE_ROWS);
    setRows(loaded);
    persistedSlotsRef.current = snapshotSlots(loaded);
    rowsEditedRef.current = false;
  }, [savedRows, schoolId, loadingPeriodRows]);

  // Chạy sau khi nạp khung; kết quả không phụ thuộc API lịch hay API tiết về trước.
  useEffect(() => {
    if (loadingPeriodRows || !schoolId) return;
    const displayed = [...existing, ...rejectedSchedules].filter(
      (item) => String(item.schoolId) === schoolId,
    );
    setRows((prev) => {
      const next = appendMissingTimetableRows(prev, displayed);
      if (next !== prev && !rowsEditedRef.current) {
        persistedSlotsRef.current = snapshotSlots(next);
      }
      return next;
    });
  }, [existing, rejectedSchedules, savedRows, schoolId, loadingPeriodRows]);

  /**
   * Tự lưu khung giờ tiết của trường mỗi khi người dùng sửa trên lưới — không
   * có nút Lưu riêng.
   *
   * Hoãn 800ms: gõ giờ bằng ô `type="time"` bắn thay đổi liên tục theo từng
   * chữ số, lưu ngay mỗi lần gõ sẽ dội hàng loạt request và ghi cả những giá
   * trị dở dang. Dòng thiếu/sai giờ thì bỏ qua lần lưu đó, chờ gõ xong.
   */
  useEffect(() => {
    if (!schoolId || !canManage || loadingPeriodRows || !rowsEditedRef.current) return;

    const valid = rows.every(
      (row) => row.startTime && row.endTime && isTimeOrderValid(row.startTime, row.endTime),
    );
    if (!valid) return;
    // Hai tiết cùng khung giờ thì `normalizeTimetableRows` sẽ bỏ bớt một dòng
    // khi lưu — chờ người dùng gõ xong cho hết trùng rồi mới lưu.
    const slots = rows
      .filter((row) => row.isPeriod)
      .map((row) => timetableSlotKey(row.startTime, row.endTime));
    if (new Set(slots).size !== slots.length) return;

    const timer = setTimeout(() => {
      schoolPeriodApi
        .replace(
          Number(schoolId),
          rows.map((row, index) => ({
            periodNo: index + 1,
            startTime: row.startTime,
            endTime: row.endTime,
            label: row.label,
            session: row.session,
            isPeriod: row.isPeriod,
          })),
        )
        .then(async (res) => {
          // Chồng giờ chỉ là nhắc nhở — khung giờ đã lưu xong, không mất gì.
          res?.warnings?.forEach((message) => toast(`⚠️ ${message}`));
          await retimeSchedulesOfChangedRows(rows);
          persistedSlotsRef.current = snapshotSlots(rows);
        })
        .catch((error) => {
          // Lưu khung giờ hỏng không được chặn việc xếp lịch đang làm dở.
          toast.error(getApiErrorMessage(error, "Không lưu được giờ tiết học"));
        });
    }, 800);

    return () => clearTimeout(timer);
  }, [rows, schoolId, canManage, loadingPeriodRows]);

  /**
   * Đổi giờ một dòng tiết = đổi giờ của **chính các mẫu lịch đã xếp ở dòng
   * đó**, không để chúng rớt lại khung giờ cũ (rớt lại thì lưới tự thêm một
   * dòng tiết "?" — nhìn như vừa đẻ thêm tiết mới).
   */
  const retimeSchedulesOfChangedRows = async (list: TimetableRow[]) => {
    const moves = list.flatMap((row) => {
      if (!row.isPeriod || !row.startTime || !row.endTime) return [];
      const oldSlot = persistedSlotsRef.current.get(row.key);
      const newSlot = timetableSlotKey(row.startTime, row.endTime);
      if (!oldSlot || oldSlot === newSlot) return [];
      return [{ oldSlot, startTime: row.startTime, endTime: row.endTime }];
    });
    if (moves.length === 0) return;

    const schedules = [...existing, ...rejectedSchedules].filter(
      (item) => String(item.schoolId) === schoolId,
    );
    const jobs = moves.flatMap((move) =>
      schedules
        .filter(
          (item) => timetableSlotKey(item.startTime, item.endTime) === move.oldSlot,
        )
        .map((item) =>
          teachingScheduleApi.update(item.id, {
            startTime: move.startTime,
            endTime: move.endTime,
          }),
        ),
    );
    if (jobs.length === 0) return;

    const results = await Promise.allSettled(jobs);
    const failed = results.filter((item) => item.status === "rejected").length;
    if (failed) {
      toast.error(`Không đổi được giờ của ${failed} tiết đã xếp`);
    } else {
      toast.success(`Đã đổi giờ ${jobs.length} tiết đã xếp theo khung mới`);
    }
    await loadExisting();
  };

  const setRowTime = (
    rowKey: string,
    patch: Partial<Pick<TimetableRow, "startTime" | "endTime">>,
  ) => {
    const nextRows = updateTimetableRowTime(rows, rowKey, patch);
    if (nextRows === rows) return;
    // Trùng giờ với tiết khác thì vẫn nhận giá trị đang gõ (chặn là mất luôn
    // chữ số vừa nhập), chỉ nhắc và hoãn lưu cho tới khi giờ hết trùng.
    const duplicate = nextRows.find((row, index) =>
      row.isPeriod && row.startTime && row.endTime &&
      nextRows.some((other, otherIndex) =>
        otherIndex !== index && other.isPeriod &&
        timetableSlotKey(row.startTime, row.endTime) ===
          timetableSlotKey(other.startTime, other.endTime),
      ),
    );
    if (duplicate) {
      toast.error(
        `Khung giờ này đã có ở tiết ${duplicate.label} (${SESSION_LABELS[duplicate.session]})`,
        { id: "timetable-duplicate-slot" },
      );
    }
    rowsEditedRef.current = true;
    setRows(nextRows);
  };

  const addPeriodRow = (session: TimetableRow["session"]) => {
    rowsEditedRef.current = true;
    setRows((prev) => {
      const inSession = prev.filter(
        (row) => row.session === session && row.isPeriod,
      );
      const last = inSession[inSession.length - 1];

      return normalizeRows([
        ...prev,
        {
          key: `${session}-${Date.now()}`,
          session,
          isPeriod: true,
          label: String(inSession.length + 1),
          startTime: last?.endTime || (session === "SANG" ? "07:30" : "13:30"),
          endTime: last?.endTime || (session === "SANG" ? "08:00" : "14:00"),
        },
      ]);
    });
  };

  const removeRow = (row: TimetableRow) => {
    // Dòng đang có lịch thật thì xoá đi là giấu mất lịch, không phải xoá lịch.
    const used = days.some(
      (day) => (existingByCell.get(`${day}|${timetableSlotKey(row.startTime, row.endTime)}`) || []).length > 0,
    );
    if (used) {
      toast.error("Tiết này đang có lịch đã xếp — xoá từng ô trước");
      return;
    }

    rowsEditedRef.current = true;
    setRows((prev) => normalizeRows(prev.filter((item) => item.key !== row.key)));
    setCells((prev) => {
      const next = { ...prev };
      days.forEach((day) => delete next[cellKey(row.key, day)]);
      return next;
    });
  };

  /** Dòng tiết chỉ đổi chỗ với tiết khác (bỏ qua dòng ra chơi), còn dòng ra
   * chơi đổi chỗ với dòng liền kề nên có thể trượt lên/xuống giữa các tiết. */
  const moveSiblings = (list: TimetableRow[], row: TimetableRow) =>
    list.filter((item) => item.session === row.session && (!row.isPeriod || item.isPeriod));

  /** Đổi vị trí hai dòng trong cùng buổi. Giờ, lớp và giáo viên đi theo dòng
   * nên chỉ thay đổi thứ tự/periodNo, không làm mất dữ liệu đã xếp. */
  const moveRow = (rowKey: string, direction: -1 | 1) => {
    rowsEditedRef.current = true;
    setRows((prev) => {
      const current = prev.find((row) => row.key === rowKey);
      if (!current) return prev;

      const siblings = moveSiblings(prev, current);
      const position = siblings.findIndex((row) => row.key === rowKey);
      const swapWith = siblings[position + direction];
      if (!swapWith) return prev;

      const currentIndex = prev.findIndex((row) => row.key === rowKey);
      const swapIndex = prev.findIndex((row) => row.key === swapWith.key);
      const next = [...prev];
      [next[currentIndex], next[swapIndex]] = [next[swapIndex], next[currentIndex]];
      return normalizeRows(next);
    });
  };

  const canMoveRow = (row: TimetableRow, direction: -1 | 1) => {
    const siblings = moveSiblings(rows, row);
    const position = siblings.findIndex((item) => item.key === row.key);
    return position + direction >= 0 && position + direction < siblings.length;
  };

  const removeSchedule = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await teachingScheduleApi.remove(deleteTarget.id);
      toast.success("Đã xoá mẫu lịch");
      setDeleteTarget(null);
      loadExisting();
      loadRejected();
      onCreated();
    } catch (error: any) {
      // 409 = đã có buổi được chấm công; giữ modal để đọc lý do.
      if (error?.response?.status === 409) {
        setDeleteError(
          getApiErrorMessage(error, "Mẫu lịch đã có buổi chấm công, không xoá được"),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá mẫu lịch thất bại"));
      }
    } finally {
      setDeleting(false);
    }
  };

  const removeTeacherTimetable = async () => {
    if (!defaultTeacherId || existing.length === 0 || deletingTeacher) return;

    setDeletingTeacher(true);
    let removed = 0;
    const failures: string[] = [];
    try {
      // API hiện chỉ xoá từng mẫu. Chạy tuần tự để backend xử lý trọn vẹn từng
      // mẫu và giữ lại mẫu có buổi đã chấm công thay vì làm hỏng cả thao tác.
      for (const schedule of existing) {
        try {
          await teachingScheduleApi.remove(schedule.id);
          removed += 1;
        } catch (error: any) {
          failures.push(
            `${schedule.className || "—"} · ${schedule.dayOfWeekLabel} ${formatTime(schedule.startTime)}: ${getApiErrorMessage(error, "Không xoá được")}`,
          );
        }
      }

      if (removed > 0) toast.success(`Đã xoá ${removed} mẫu lịch của giáo viên`);
      if (failures.length > 0) {
        failures.slice(0, 3).forEach((message) => toast.error(message));
        if (failures.length > 3) toast.error(`Còn ${failures.length - 3} mẫu không xoá được`);
      }
      setDeleteTeacherOpen(false);
      await loadExisting();
      await loadRejected();
      onCreated();
    } finally {
      setDeletingTeacher(false);
    }
  };

  const removeSchoolTimetable = async () => {
    if (!schoolId || deletingSchool) return;

    setDeletingSchool(true);
    try {
      // Xoá toàn bộ trường (mọi GV), không lệ thuộc bộ lọc GV đang chọn trên
      // màn hình — khác `removeTeacherTimetable` chỉ xoá phần đang lọc.
      const result = await teachingScheduleApi.removeBySchool({
        schoolId: Number(schoolId),
      });
      toast.success(
        `Đã xoá ${result.deletedSchedules} mẫu lịch` +
          (result.sessions?.kept
            ? ` · giữ lại ${result.sessions.kept} buổi đã chấm công`
            : ""),
      );
      setDeleteSchoolOpen(false);
      await loadExisting();
      await loadRejected();
      onCreated();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá TKB của trường thất bại"));
      }
    } finally {
      setDeletingSchool(false);
    }
  };

  /** Chuyển các mẫu lịch đang lọc của một giáo viên sang người khác, giữ nguyên
   * trường/lớp/môn/giờ. Backend vẫn kiểm tra trùng lịch cho từng mẫu. */
  const replaceTeacherTimetable = async () => {
    if (!bulkReplaceTeacherId || existing.length === 0 || bulkReplacing) return;
    setBulkReplacing(true);
    let replaced = 0;
    const failures: string[] = [];
    try {
      for (const schedule of existing) {
        try {
          await teachingScheduleApi.update(schedule.id, {
            teacherId: Number(bulkReplaceTeacherId),
          });
          replaced += 1;
        } catch (error) {
          failures.push(
            `${schedule.className || "—"} · ${schedule.dayOfWeekLabel} ${formatTime(schedule.startTime)}: ${getApiErrorMessage(error, "Không đổi được giáo viên")}`,
          );
        }
      }
      if (replaced) toast.success(`Đã chuyển ${replaced} lịch sang giáo viên mới`);
      failures.slice(0, 3).forEach((message) => toast.error(message));
      if (failures.length > 3) toast.error(`Còn ${failures.length - 3} lịch không chuyển được`);
      setBulkReplaceOpen(false);
      await loadExisting();
      await loadRejected();
      onCreated();
    } finally {
      setBulkReplacing(false);
    }
  };

  /** Đổi chéo 2 chiều: lịch của GV đang lọc và GV đích tráo đổi cho nhau,
   * trong đúng trường/cơ sở đang xem — khác `replaceTeacherTimetable` vốn chỉ
   * chuyển một chiều và làm mất lịch cũ của GV đích. */
  const swapTeacherTimetable = async () => {
    if (!defaultTeacherId || !bulkReplaceTeacherId || swapping) return;
    setSwapping(true);
    try {
      const result = await teachingScheduleApi.swapTeachers({
        teacherAId: Number(defaultTeacherId),
        teacherBId: Number(bulkReplaceTeacherId),
        schoolId: schoolId ? Number(schoolId) : undefined,
        schoolLocationId: schoolLocationId ? Number(schoolLocationId) : undefined,
      });
      toast.success(
        `Đã đổi chéo: ${result.swapped.fromA} lịch sang ${result.teacherB.name}, ` +
          `${result.swapped.fromB} lịch sang ${result.teacherA.name}`,
      );
      setSwapOpen(false);
      await loadExisting();
      await loadRejected();
      onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Đổi chéo lịch thất bại"));
    } finally {
      setSwapping(false);
    }
  };

  const toggleDay = (day: number) =>
    setDays((prev) =>
      prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  /** Môn thực tế của một ô nháp: ô tự chọn, không thì theo tiêu đề TKB. */
  const cellCatalogId = (cell: Cell) => cell.catalogId || catalogId;

  /** Các ô đã điền lớp, theo đúng thứ tự đọc của lưới. */
  const filled = useMemo(() => {
    const out: {
      key: string;
      row: TimetableRow;
      day: number;
      cell: Cell;
    }[] = [];

    periodRows.forEach((row) => {
      days.forEach((day) => {
        const key = cellKey(row.key, day);
        (cells[key] ?? []).forEach((cell, index) => {
          if (cell.classId) out.push({ key: `${key}#${index}`, row, day, cell });
        });
      });
    });

    return out;
  }, [periodRows, days, cells]);

  /**
   * Khoảng sinh buổi khi lưu. TKB không thời hạn thì không sinh vô hạn được —
   * lấy đến hết tháng của ngày bắt đầu, phần còn lại dùng nút "Sinh buổi dạy".
   */
  const generateRange = () => ({
    fromDate: effectiveFrom,
    toDate: effectiveTo || endOfMonth(effectiveFrom),
  });

  const validate = () => {
    const next: Record<string, string> = {};

    if (!schoolId) next.schoolId = "Vui lòng chọn trường";
    // Môn lấy theo từng ô; ô nào để trống thì rơi về môn ở tiêu đề. Chỉ báo
    // lỗi khi thật sự có ô không biết xếp cho môn nào.
    if (filled.some(({ cell }) => !cellCatalogId(cell))) {
      // Không có môn nào để chọn thì bảo "chọn môn" là bắt làm việc không thể.
      next.catalogId =
        schoolId && catalogOptions.length === 0
          ? "Trường chưa khai môn nào cho năm học này"
          : "Vui lòng chọn môn (ở tiêu đề hoặc trong từng ô)";
    }
    if (!effectiveFrom) next.effectiveFrom = "Vui lòng chọn ngày bắt đầu";
    if (!isDateOrderValid(effectiveFrom, effectiveTo || null)) {
      next.effectiveTo = "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc";
    }
    if (!isValidPeriods(periods)) {
      next.periods = `Số tiết phải là số nguyên 1–${MAX_PERIODS}`;
    }
    // BE ghi mẫu lịch xong mới sinh buổi: vượt trần là lưu được nửa vời.
    if (generate && effectiveFrom) {
      const { fromDate, toDate } = generateRange();
      if (
        isDateOrderValid(fromDate, toDate) &&
        daysBetween(fromDate, toDate) > MAX_GENERATE_DAYS
      ) {
        next.effectiveTo =
          `Sinh buổi tối đa ${MAX_GENERATE_DAYS} ngày mỗi lần — thu hẹp ` +
          `khoảng hiệu lực hoặc bỏ tick sinh buổi`;
      }
    }
    if (filled.length === 0) next.grid = "Chưa xếp ô nào trong lưới";
    if (filled.length > MAX_BULK_ITEMS) {
      next.grid = `Mỗi lần tối đa ${MAX_BULK_ITEMS} ô (đang là ${filled.length})`;
    }

    // Giờ ngược ở một dòng làm hỏng cả hàng ngang — chỉ rõ dòng nào.
    const badRow = periodRows.find(
      (row) => !isTimeOrderValid(row.startTime, row.endTime),
    );
    if (badRow) {
      next.grid = `Tiết ${badRow.label} (${
        SESSION_LABELS[badRow.session]
      }) có giờ bắt đầu ≥ giờ kết thúc`;
    }

    const noTeacher = filled.find((item) => !item.cell.teacherId);
    if (noTeacher) {
      next.grid = `Ô ${dayLabel(noTeacher.day)} · tiết ${
        noTeacher.row.label
      } chưa chọn giáo viên`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Backend chặn `classId` lặp trong một lô (coi là gõ nhầm), mà TKB thì một
   * lớp học nhiều tiết trong tuần là chuyện bình thường. Nên chia lô theo **lần
   * xuất hiện**: lô 1 chứa tiết đầu của mỗi lớp, lô 2 chứa tiết thứ hai…
   * Mỗi lô vẫn đi qua đúng service tạo đơn lẻ nên không bỏ qua kiểm tra nào.
   */
  const buildBatches = () => {
    type Batch = {
      catalogId: number;
      items: BulkScheduleItem[];
      keys: Map<number, string>;
    };
    // API nhận một môn cho cả lô, mà mỗi ô giờ tự chọn môn → tách lô theo
    // môn trước, rồi mới theo lần xuất hiện của lớp trong môn đó.
    const byCatalog = new Map<number, Batch[]>();

    filled.forEach(({ key, row, day, cell }) => {
      const catalog = Number(cellCatalogId(cell));
      const classId = Number(cell.classId);
      const batches = byCatalog.get(catalog) ?? [];
      byCatalog.set(catalog, batches);

      const index = batches.findIndex((batch) => !batch.keys.has(classId));
      const batch =
        index >= 0
          ? batches[index]
          : (batches.push({ catalogId: catalog, items: [], keys: new Map() }),
            batches[batches.length - 1]);

      batch.items.push({
        classId,
        teacherId: Number(cell.teacherId),
        dayOfWeek: day,
        startTime: row.startTime,
        endTime: row.endTime,
      });
      batch.keys.set(classId, key);
    });

    return [...byCatalog.values()].flat();
  };

  const save = async () => {
    if (!validate()) return;

    const batches = buildBatches();
    // Giữ ảnh chụp ban đầu vì các batch đều dùng index dòng nháp tại thời điểm
    // bấm Lưu. Sau mỗi batch sẽ dựng lại cells từ ảnh này, tránh index bị lệch
    // khi một dòng trước đó đã tạo thành công và bị loại khỏi ô.
    const originalCells = cells;
    setSaving(true);
    setCellResults({});

    let created = 0;
    let skipped = 0;
    let sessions = 0;
    const results: Record<string, CellResult> = {};

    const applyResultsImmediately = () => {
      const nextCells: CellDrafts = {};
      const visibleResults: Record<string, CellResult> = {};

      Object.entries(originalCells).forEach(([key, drafts]) => {
        const remaining: Cell[] = [];
        drafts.forEach((draft, originalIndex) => {
          const result = results[`${key}#${originalIndex}`];
          if (result?.status === "CREATED") return;

          const visibleIndex = remaining.length;
          remaining.push(draft);
          if (result) visibleResults[`${key}#${visibleIndex}`] = result;
        });
        if (remaining.length > 0) nextCells[key] = remaining;
      });

      setCells(nextCells);
      setCellResults(visibleResults);
    };

    try {
      // Tuần tự: hai lô chạy song song có thể tự đá nhau vì trùng giờ giáo viên.
      for (const batch of batches) {
        const res = await teachingBulkApi.createSchedules({
          catalogId: batch.catalogId,
          schoolYear: schoolYear || undefined,
          periods: Number(periods),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          items: batch.items,
          ...(generate ? { generateSessions: generateRange() } : {}),
        });

        created += res.created;
        skipped += res.skipped;
        sessions += res.sessionsCreated || 0;

        res.results.forEach((row: BulkResultRow) => {
          const key = batch.keys.get(row.classId);
          if (key) results[key] = { status: row.status, reason: row.reason };
        });

        // Cập nhật ngay sau từng batch: dòng thành công biến khỏi nháp trước
        // khi có thể lưu lần nữa; dòng lỗi vẫn ở lại đúng vị trí để sửa.
        applyResultsImmediately();
        await loadExisting();
      }

      toast.success(
        `Đã tạo ${created} mẫu lịch${skipped ? `, bỏ qua ${skipped}` : ""}${
          sessions ? `, sinh ${sessions} buổi` : ""
        }`,
      );
      // loadExisting đã chạy sau từng batch; tải lại danh sách từ chối để mọi
      // trạng thái trên cùng lưới cũng đồng bộ.
      await loadRejected();
      onCreated();
    } catch (error: any) {
      // Nếu batch trước đã thành công thì vẫn giữ nguyên kết quả và payload đã
      // được dọn; không đưa các dòng đó trở lại chỉ vì batch sau gặp lỗi.
      applyResultsImmediately();
      if (created > 0) {
        toast.success(`Đã tạo ${created} mẫu lịch trước khi gặp lỗi`);
        await loadExisting();
        onCreated();
      }
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status !== 403) {
        // 400 = sai từ phía client, backend chưa ghi gì cả.
        toast.error(getApiErrorMessage(error, "Lưu thời khoá biểu thất bại"));
      }
    } finally {
      setSaving(false);
    }
  };

  const skippedCells = Object.values(cellResults).filter(
    (item) => item.status === "SKIPPED",
  );

  // Nói rõ lưu xong sẽ sinh buổi cho những ngày nào — không để đoán.
  const generateHint = !generate
    ? "Chỉ lưu mẫu lịch — buổi dạy sinh sau bằng nút “Sinh buổi dạy”."
    : !effectiveFrom
    ? "Chọn ngày bắt đầu ở tiêu đề TKB để biết khoảng sinh buổi."
    : effectiveTo
    ? `Sinh buổi từ ${formatDate(effectiveFrom)} đến ${formatDate(
        effectiveTo,
      )} theo khoảng hiệu lực.`
    : `TKB không thời hạn nên chỉ sinh đến ${formatDate(
        endOfMonth(effectiveFrom),
      )}; sinh tiếp bằng nút “Sinh buổi dạy”.`;

  const [applyingRange, setApplyingRange] = useState(false);

  /**
   * Áp khoảng hiệu lực trên tiêu đề cho TOÀN BỘ tiết đang có của trường —
   * thay vì sửa từng tiết. BE đồng bộ buổi dạy theo khoảng mới (cắt buổi
   * văng ngoài, sinh thêm tới mốc mới, giữ buổi đã chấm công).
   */
  const applyRangeToAll = async () => {
    if (!schoolId || !effectiveFrom) return;
    if (!isDateOrderValid(effectiveFrom, effectiveTo || null)) {
      toast.error("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
      return;
    }
    const rangeText = `${formatDate(effectiveFrom)} – ${effectiveTo ? formatDate(effectiveTo) : "không thời hạn"}`;
    const scopeText = schoolLocationId ? " (điểm trường đang chọn)" : "";
    if (
      !window.confirm(
        `Áp hiệu lực ${rangeText} cho TOÀN BỘ tiết đang áp dụng của trường${scopeText}?\n\n` +
          "Buổi dạy nằm ngoài khoảng mới sẽ bị xoá (trừ buổi đã chấm công); " +
          "kéo dài hiệu lực sẽ sinh thêm buổi tới mốc mới.",
      )
    ) {
      return;
    }

    setApplyingRange(true);
    try {
      const result = await teachingScheduleApi.applyEffectiveRange({
        schoolId: Number(schoolId),
        ...(schoolLocationId ? { schoolLocationId: Number(schoolLocationId) } : {}),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });
      const { sessions } = result;
      toast.success(
        `Đã áp hiệu lực cho ${result.applied}/${result.total} tiết` +
          (result.unchanged ? ` (${result.unchanged} tiết đã đúng)` : "") +
          ` · buổi dạy: +${sessions.created} sinh thêm, −${sessions.removed} cắt bớt` +
          (sessions.skipped ? `, ${sessions.skipped} đã chấm công giữ nguyên` : ""),
        { duration: 6000 },
      );
      if (result.failed > 0) {
        result.results
          .filter((r) => r.status === "FAILED")
          .slice(0, 3)
          .forEach((r) => toast.error(`Tiết #${r.scheduleId}: ${r.message}`));
        if (result.failed > 3) toast.error(`Còn ${result.failed - 3} tiết không áp được`);
      }
      await loadExisting();
      await loadRejected();
      onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không áp được hiệu lực cho các tiết"));
    } finally {
      setApplyingRange(false);
    }
  };

  const stopEditing = useCallback(() => setEditing(null), []);

  // Bốn field này nằm trên tiêu đề nên lỗi của chúng phải báo ngay ở đó.
  const headerError = [
    errors.schoolId,
    errors.catalogId,
    errors.effectiveFrom,
    errors.effectiveTo,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      {/* Thiết lập chung của cả TKB — phần trường / môn / năm / hiệu lực nằm
          ngay trên tiêu đề TKB, bấm thẳng vào chữ để đổi. */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 grid gap-3 md:grid-cols-3">
        {/* Danh sách giáo viên lấy từ /teachers — role chỉ-xem phạm vi hẹp
            (kinh doanh) không gọi được nên không có gì để lọc. */}
        {teachers.length > 0 && (
          <Field
            label="Giáo viên"
            hint={teacherHint}
          >
            <SearchableSelect
              value={defaultTeacherId}
              onChange={setDefaultTeacherId}
              options={teachers.map((item) => ({
                id: item.id,
                name: `${item.name}${item.isActive ? "" : " (ngừng)"}`,
              }))}
              placeholder="— Tất cả giáo viên —"
              searchPlaceholder="Tìm giáo viên…"
              portal
            />
          </Field>
        )}

        {canManage && defaultTeacherId && (
          <Field
            label="Giáo viên B (để chuyển / đổi chéo lịch)"
            hint="Dùng cho cả hai nút bên dưới: chuyển một chiều sang GV này, hoặc đổi chéo lịch 2 chiều với GV này."
          >
            <SearchableSelect
              value={bulkReplaceTeacherId}
              onChange={setBulkReplaceTeacherId}
              options={teachers
                .filter((item) => String(item.id) !== defaultTeacherId && item.isActive)
                .map((item) => ({ id: item.id, name: item.name }))}
              placeholder="— Chọn giáo viên thay thế —"
              searchPlaceholder="Tìm giáo viên…"
              portal
            />
          </Field>
        )}

        {/* Số tiết mỗi ô chỉ dùng khi xếp lịch — người chỉ xem không cần. */}
        {canManage && (
          <Field
            label="Số tiết mỗi ô"
            required
            error={errors.periods}
            hint="Căn cứ tính công — mỗi ô trên lưới là một buổi dạy."
          >
            <input
              type="number"
              min={1}
              max={MAX_PERIODS}
              value={periods}
              onChange={(e) => setPeriods(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        <div className="md:col-span-3">
          <p className="text-sm text-gray-600">Các thứ hiển thị</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAY_OF_WEEK_OPTIONS.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  days.includes(day.value)
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {canManage && !!schoolId && !loadingClasses && classOptions.length === 0 && (
        <NoClassNotice schoolName={school?.name} />
      )}

      {/* Không khai môn thì có xếp lưới cũng bị bỏ qua hết ở bước lưu. */}
      {!!schoolId && !loadingSubjects && catalogOptions.length === 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          {school?.name ? <b>{school.name}</b> : "Trường này"} chưa khai môn nào
          {schoolYear ? ` cho năm học ${schoolYear}` : ""}.{" "}
          {hasOtherYearSubjects
            ? "Trường có môn ở năm học khác — kiểm tra lại năm học trên tiêu đề TKB."
            : canManage
            ? "Nhờ bộ phận kinh doanh khai môn cho trường rồi quay lại xếp lịch."
            : "Khai môn cho trường ở màn Chính sách → Quản lý môn học trước, rồi Nhân sự mới xếp được lịch."}
        </div>
      )}

      {/* Đầu trang TKB — đúng dạng bản in nhà trường đang dùng.
          Không đặt `overflow-hidden` ở đây: dropdown của ô sửa tại chỗ nằm
          trong khối này, bị cắt là không chọn được. */}
      <div className="timetable-panel rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-1.5 rounded-t-2xl border-b border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
          {/* Trường đứng trước môn: môn chọn được là môn của trường này, đổi
              trường là đổi luôn danh sách môn. */}
          <div className="flex justify-center text-base font-semibold text-slate-800">
            {editing === "school" ? (
              <InlineEditor onClose={stopEditing}>
                <div className="w-72 max-w-[80vw] normal-case">
                  <SearchableSelect
                    defaultOpen
                    portal
                    value={schoolId}
                    onChange={(value) => {
                      changeSchool(value);
                      stopEditing();
                    }}
                    options={schoolOptions}
                    placeholder="— Chọn trường —"
                    searchPlaceholder="Tìm trường…"
                    emptyLabel={
                      teacherHasNoSchool
                        ? "Giáo viên này chưa có TKB ở trường nào — bỏ chọn giáo viên để xếp lịch mới"
                        : "Không tìm thấy kết quả"
                    }
                  />
                </div>
              </InlineEditor>
            ) : (
              <EditableText
                onClick={() => setEditing("school")}
                empty={!school}
              >
                {school ? schoolLabel(school) : "Chọn trường"}
              </EditableText>
            )}
          </div>

          {/* Chỉ trường nhiều cơ sở mới có dòng này — trường một cơ sở giữ
              nguyên đầu trang như cũ. */}
          {locations.length > 0 && (
            <div className="flex justify-center text-xs font-semibold uppercase text-gray-600">
              {editing === "location" ? (
                <InlineEditor onClose={stopEditing}>
                  <div className="w-64 max-w-[80vw] normal-case">
                    <SearchableSelect
                      defaultOpen
                      portal
                      value={schoolLocationId}
                      onChange={(value) => {
                        changeSchoolLocation(value);
                        stopEditing();
                      }}
                      options={locationScopeOptions(locations)}
                      placeholder="— Trường chính + mọi điểm trường —"
                      searchPlaceholder="Tìm điểm trường…"
                    />
                  </div>
                </InlineEditor>
              ) : (
                <EditableText
                  onClick={() => setEditing("location")}
                  empty={!schoolLocationId}
                >
                  {locationScopeOptions(locations).find(
                    (item) => String(item.id) === schoolLocationId,
                  )?.name || "Trường chính + mọi điểm trường"}
                </EditableText>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm font-bold uppercase text-gray-800">
            <span>Thời khóa biểu</span>

            {editing === "catalog" ? (
              <InlineEditor onClose={stopEditing}>
                <div className="w-56 normal-case">
                  <SearchableSelect
                    defaultOpen
                    // Tiêu đề TKB nằm sát lưới có header sticky; render menu
                    // ra body để danh sách môn không bị hàng tiêu đề che/cắt.
                    portal
                    value={catalogId}
                    onChange={(value) => {
                      setCatalogId(value);
                      stopEditing();
                    }}
                    options={catalogOptions}
                    placeholder={
                      loadingSubjects
                        ? "Đang tải môn…"
                        : catalogOptions.length === 0
                        ? "Trường chưa khai môn"
                        : "— Tất cả môn —"
                    }
                    searchPlaceholder="Tìm môn…"
                  />
                </div>
              </InlineEditor>
            ) : (
              <EditableText
                // Chưa có trường thì chưa biết có môn nào — mở luôn ô chọn trường.
                onClick={() => setEditing(schoolId ? "catalog" : "school")}
                className="text-blue-700"
                empty={!catalog}
              >
                {catalog?.plainName ||
                  (schoolId ? "tất cả môn" : "chọn trường trước")}
              </EditableText>
            )}

            <span>· NĂM HỌC</span>

            {editing === "year" ? (
              <InlineEditor onClose={stopEditing}>
                <select
                  autoFocus
                  value={schoolYear}
                  onChange={(e) => {
                    setSchoolYear(e.target.value);
                    stopEditing();
                  }}
                  className="rounded-lg border px-2 py-1 text-sm normal-case"
                >
                  {years.length === 0 && (
                    <option value={currentSchoolYear()}>
                      {currentSchoolYear()}
                    </option>
                  )}
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </InlineEditor>
            ) : (
              <EditableText onClick={() => setEditing("year")}>
                {schoolYear || currentSchoolYear()}
              </EditableText>
            )}
          </div>

          <div className={`flex justify-center text-xs text-gray-600 ${canManage ? "" : "hidden"}`}>
            {editing === "range" ? (
              <InlineEditor onClose={stopEditing}>
                <span className="inline-flex flex-wrap items-center justify-center gap-1">
                  <input
                    autoFocus
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  {/* Hai ô ngày không tự đóng được như select nên cần nút thoát. */}
                  <button
                    onClick={stopEditing}
                    className="px-1.5 text-xs font-semibold text-blue-600"
                  >
                    Xong
                  </button>
                </span>
              </InlineEditor>
            ) : (
              <EditableText onClick={() => setEditing("range")}>
                {formatDate(effectiveFrom)} –{" "}
                {effectiveTo ? formatDate(effectiveTo) : "không thời hạn"}
              </EditableText>
            )}
          </div>
        </div>

        {headerError && (
          <p className="border-b border-gray-200 bg-red-50 px-4 py-1.5 text-center text-xs font-medium text-red-600">
            {headerError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span><b className="font-semibold text-slate-700">{periodRows.length} tiết</b> · {days.length} ngày hiển thị</span>
            {canManage && schoolId && (
              <button
                type="button"
                onClick={() => void applyRangeToAll()}
                disabled={applyingRange || !effectiveFrom}
                title="Áp khoảng hiệu lực trên tiêu đề cho toàn bộ tiết đang có của trường"
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarRange size={12} />
                {applyingRange ? "Đang áp hiệu lực…" : "Áp hiệu lực cho toàn bộ tiết"}
              </button>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5"><ArrowRightLeft size={13} /> Cuộn ngang để xem các ngày</span>
        </div>
        <DragScrollContainer className="timetable-scroll max-h-[70vh] overflow-auto overscroll-contain rounded-b-2xl">
          <table
            className={`timetable-grid ${isMobile ? "timetable-grid-stacked" : ""}`}
            aria-label="Bảng thời khóa biểu theo tiết và ngày"
            style={{
              width: gridFixedWidth + days.length * dayColumnWidth,
              ["--class-width" as string]: `${columns.class}px`,
              ["--subject-width" as string]: `${columns.subject}px`,
              ["--session-width" as string]: `${columns.session}px`,
              ["--period-width" as string]: `${columns.period}px`,
            }}
          >
            <colgroup>
              <col style={{ width: columns.session }} />
              <col style={{ width: columns.period }} />
              <col style={{ width: columns.time }} />
              {days.map((day) => (
                <Fragment key={day}>
                  <col style={{ width: columns.class }} />
                  <col style={{ width: columns.subject }} />
                  <col style={{ width: columns.teacher }} />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={headerRows} scope="col" className="timetable-fixed timetable-session">Buổi</th>
                <th rowSpan={headerRows} scope="col" className="timetable-fixed timetable-period">Tiết</th>
                <th rowSpan={headerRows} scope="col" className="timetable-fixed timetable-time">Khung giờ</th>
                {days.map((day) => (
                  <th key={day} colSpan={3} scope="colgroup" className={`timetable-day ${day >= 7 ? "timetable-weekend" : ""}`}>
                    {dayLabel(day)}
                  </th>
                ))}
              </tr>
              {!isMobile && <tr>
                {days.map((day) => (
                  <Fragment key={day}>
                    <th scope="col" className="timetable-subhead">Lớp học</th>
                    <th scope="col" className="timetable-subhead">Môn học</th>
                    <th scope="col" className="timetable-subhead timetable-day-end">Giáo viên</th>
                  </Fragment>
                ))}
              </tr>}
            </thead>
            <tbody>
              {(["SANG", "CHIEU"] as const).map((session) => {
                const sessionRows = rows.filter((row) => row.session === session);
                return sessionRows.map((row, index) => (
                  <tr key={row.key} className={`${!row.isPeriod ? "timetable-break" : ""} ${index === 0 ? "timetable-session-start" : ""}`}>
                    {index === 0 && (
                      <th rowSpan={sessionRows.length} scope="rowgroup" className="timetable-fixed timetable-session">
                        <span className="timetable-session-label">{SESSION_LABELS[session]}</span>
                      </th>
                    )}
                    <th scope="row" className="timetable-fixed timetable-period">
                      <div className="timetable-period-content">
                        {row.isPeriod ? <span className="timetable-period-number">{row.label}</span> : <span className="timetable-break-label">Ra chơi</span>}
                        {canManage && (() => {
                          const name = row.isPeriod ? `tiết ${row.label}` : "giờ ra chơi";
                          return (
                            <div className="timetable-period-actions">
                              <button type="button" onClick={() => moveRow(row.key, -1)} disabled={!canMoveRow(row, -1)} title={`Đưa ${name} lên`} aria-label={`Đưa ${name} lên`}><ChevronUp size={14} /></button>
                              <button type="button" onClick={() => moveRow(row.key, 1)} disabled={!canMoveRow(row, 1)} title={`Đưa ${name} xuống`} aria-label={`Đưa ${name} xuống`}><ChevronDown size={14} /></button>
                              {row.isPeriod && (
                                <button type="button" onClick={() => removeRow(row)} className="timetable-delete" title="Xoá tiết" aria-label={`Xoá tiết ${row.label}`}><X size={13} /></button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </th>
                    <td className="timetable-fixed timetable-time">
                      <div className="timetable-time-range">
                        {canManage ? (
                          <>
                            <input type="time" step={300} value={row.startTime} aria-label={`Giờ bắt đầu ${row.isPeriod ? `tiết ${row.label}` : "ra chơi"} ${SESSION_LABELS[session]}`} onChange={(e) => setRowTime(row.key, { startTime: e.target.value })} />
                            <span aria-hidden="true">–</span>
                            <input type="time" step={300} value={row.endTime} aria-label={`Giờ kết thúc ${row.isPeriod ? `tiết ${row.label}` : "ra chơi"} ${SESSION_LABELS[session]}`} onChange={(e) => setRowTime(row.key, { endTime: e.target.value })} />
                          </>
                        ) : (
                          <><time>{row.startTime}</time><span>–</span><time>{row.endTime}</time></>
                        )}
                      </div>
                    </td>
                    {days.map((day) => {
                      if (!row.isPeriod) return <td key={day} colSpan={3} className="timetable-break-cell"><span>Ra chơi</span></td>;
                      const key = cellKey(row.key, day);
                      return (
                        <TimetableCell
                          key={key}
                          cellKeyValue={key}
                          drafts={cells[key] ?? []}
                          results={cellResults}
                          teachers={teachers}
                          classes={classOptions}
                          catalogs={catalogOptions}
                          defaultCatalogId={catalogId}
                          schoolPicked={!!schoolId}
                          canManage={canManage}
                          saved={[
                            ...(existingByCell.get(`${day}|${timetableSlotKey(row.startTime, row.endTime)}`) || []),
                            ...(rejectedByCell.get(`${day}|${timetableSlotKey(row.startTime, row.endTime)}`) || []),
                          ]}
                          onPickClass={pickClass}
                          onPickTeacher={setCell}
                          onAdd={() => addCellDraft(key)}
                          onDelete={(schedule) => { setDeleteError(""); setDeleteTarget(schedule); }}
                          onViewRejected={(schedule) => { setRejectedDetail(schedule); setReplaceTeacherId(""); }}
                          onEdit={setEditTarget}
                        />
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </DragScrollContainer>
        {canManage && (
          <div className="flex flex-wrap gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50/70 px-4 py-3">
            {(["SANG", "CHIEU"] as const).map((session) => (
              <button key={session} type="button" onClick={() => addPeriodRow(session)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-blue-500">
                <Plus size={14} /> Thêm tiết {session === "SANG" ? "sáng" : "chiều"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chú thích màu giáo viên — TKB giấy cũng tô màu theo người dạy */}
      {teachers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          {teachers.slice(0, 8).map((item) => (
            <span
              key={item.id}
              className={`text-xs font-semibold ${teacherColor(item.id)}`}
            >
              {item.name}
            </span>
          ))}
        </div>
      )}

      {errors.grid && (
        <p className="px-1 text-xs text-red-500">{errors.grid}</p>
      )}

      {skippedCells.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
          <p className="text-sm font-semibold text-amber-800">
            {skippedCells.length} ô chưa tạo được — đã giữ lại trên lưới để sửa
          </p>
          {Array.from(new Set(skippedCells.map((item) => item.reason))).map(
            (reason) => (
              <p key={reason} className="text-xs text-amber-700">
                • {reason}
              </p>
            ),
          )}
        </div>
      )}

      {canManage && (
        <>
          <div className="px-1">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={generate}
                onChange={(e) => setGenerate(e.target.checked)}
              />
              Sinh luôn buổi dạy khi lưu
            </label>

            <p className="mt-0.5 pl-6 text-xs text-gray-400">{generateHint}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={suggestTimetable}
              disabled={suggesting || !schoolId || !schoolYear || !catalogId || loadingClasses}
              title="Tự điền lớp và giáo viên phù hợp vào các ô trống; bạn vẫn có thể sửa trước khi lưu"
              className="flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 active:scale-95 disabled:opacity-40"
            >
              <Sparkles size={16} /> {suggesting ? "Đang gợi ý…" : "Gợi ý xếp TKB"}
            </button>

            <button
              onClick={() => {
                setCells({});
                setCellResults({});
              }}
              disabled={Object.keys(cells).length === 0}
              className="flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 active:scale-95 disabled:opacity-40"
            >
              <Eraser size={16} /> Xoá ô chưa lưu
            </button>

            {/* Sinh buổi cho lịch đã xếp — trước đây nằm ở tab "Mẫu lịch tuần". */}
            <button
              onClick={() => setGenerateOpen(true)}
              disabled={existing.length === 0}
              className="flex items-center gap-1 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-600 active:scale-95 disabled:opacity-40"
            >
              <CalendarPlus size={16} /> Sinh buổi {defaultTeacherId ? "của GV" : "dạy"} ({existing.length})
            </button>

            <button
              onClick={() => setDeleteTeacherOpen(true)}
              disabled={!defaultTeacherId || existing.length === 0 || deletingTeacher}
              title={!defaultTeacherId ? "Chọn một giáo viên trước khi xoá toàn bộ TKB" : undefined}
              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 active:scale-95 disabled:opacity-40"
            >
              <Trash2 size={16} /> Xoá TKB của GV ({existing.length})
            </button>

            <button
              onClick={() => setDeleteSchoolOpen(true)}
              disabled={!schoolId || deletingSchool}
              title={!schoolId ? "Chọn một trường trước khi xoá toàn bộ TKB" : undefined}
              className="flex items-center gap-1 rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-medium text-red-700 active:scale-95 disabled:opacity-40"
            >
              <Trash2 size={16} /> Xoá toàn bộ TKB trường
            </button>

            <button
              onClick={() => setBulkReplaceOpen(true)}
              disabled={!defaultTeacherId || !bulkReplaceTeacherId || existing.length === 0 || bulkReplacing}
              title={!defaultTeacherId ? "Chọn giáo viên cần thay trước" : !bulkReplaceTeacherId ? "Chọn giáo viên thay thế trước" : undefined}
              className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 active:scale-95 disabled:opacity-40"
            >
              <ArrowRightLeft size={16} /> Chuyển TKB sang GV khác ({existing.length})
            </button>

            <button
              onClick={() => setSwapOpen(true)}
              disabled={!defaultTeacherId || !bulkReplaceTeacherId || swapping}
              title={!defaultTeacherId ? "Chọn giáo viên A trước" : !bulkReplaceTeacherId ? "Chọn giáo viên B trước" : undefined}
              className="flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700 active:scale-95 disabled:opacity-40"
            >
              <ArrowRightLeft size={16} /> Đổi chéo lịch 2 GV
            </button>

            <button
              onClick={save}
              disabled={saving || filled.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              <CalendarRange size={16} />
              {saving ? "Đang lưu…" : `Lưu ${filled.length} ô mới`}
            </button>
          </div>
        </>
      )}

      {editTarget && (
        <ScheduleFormModal
          schedule={editTarget}
          teachers={teachers}
          schools={schools}
          existing={existing}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadExisting();
            loadRejected();
          }}
        />
      )}

      {generateOpen && (
        <GenerateSessionsModal
          schedules={existing}
          onClose={() => setGenerateOpen(false)}
          onGenerated={onCreated}
        />
      )}

      {deleteTeacherOpen && defaultTeacherId && (
        <ConfirmModal
          title="Xoá thời khoá biểu của giáo viên"
          message={
            <>
              Xoá toàn bộ <b>{existing.length} mẫu lịch</b> đang hiển thị của
              giáo viên <b>{teachers.find((item) => String(item.id) === defaultTeacherId)?.name}</b>?
            </>
          }
          hint="Các buổi chưa chấm được sinh từ mẫu cũng sẽ bị xoá. Mẫu đã có buổi chấm công sẽ được giữ lại và báo lỗi riêng. Thao tác có thể hoàn tất một phần."
          submitLabel={`Xoá ${existing.length} mẫu lịch`}
          loading={deletingTeacher}
          onClose={() => setDeleteTeacherOpen(false)}
          onSubmit={removeTeacherTimetable}
        />
      )}

      {deleteSchoolOpen && schoolId && (
        <ConfirmModal
          title="Xoá toàn bộ thời khoá biểu của trường"
          message={
            <>
              Xoá <b>toàn bộ mẫu lịch của mọi giáo viên</b> tại trường{" "}
              <b>{schools.find((item) => String(item.id) === schoolId)?.name}</b>?
            </>
          }
          hint="Áp dụng cho cả trường, không chỉ giáo viên đang lọc. Các buổi chưa chấm được sinh từ mẫu cũng sẽ bị xoá. Mẫu đã có buổi chấm công sẽ được giữ lại. Thao tác có thể hoàn tất một phần."
          submitLabel="Xoá toàn bộ TKB trường"
          loading={deletingSchool}
          onClose={() => setDeleteSchoolOpen(false)}
          onSubmit={removeSchoolTimetable}
        />
      )}

      {bulkReplaceOpen && defaultTeacherId && bulkReplaceTeacherId && (
        <ConfirmModal
          title="Chuyển toàn bộ lịch sang giáo viên khác"
          message={
            <>
              Chuyển <b>{existing.length} mẫu lịch</b> đang hiển thị của giáo viên{" "}
              <b>{teachers.find((item) => String(item.id) === defaultTeacherId)?.name}</b> sang{" "}
              <b>{teachers.find((item) => String(item.id) === bulkReplaceTeacherId)?.name}</b>?
            </>
          }
          hint="Giữ nguyên trường, lớp, môn, thứ và giờ. Lịch nào trùng với giáo viên mới sẽ được giữ lại và báo lỗi riêng; thao tác có thể hoàn tất một phần."
          submitLabel={`Chuyển ${existing.length} mẫu lịch`}
          submitColor="bg-blue-600"
          loading={bulkReplacing}
          onClose={() => setBulkReplaceOpen(false)}
          onSubmit={replaceTeacherTimetable}
        />
      )}

      {swapOpen && defaultTeacherId && bulkReplaceTeacherId && (
        <ConfirmModal
          title="Đổi chéo lịch dạy giữa 2 giáo viên"
          message={
            <>
              Đổi chéo toàn bộ lịch (đang áp dụng, trong phạm vi trường/cơ sở đang
              xem) giữa{" "}
              <b>{teachers.find((item) => String(item.id) === defaultTeacherId)?.name}</b> và{" "}
              <b>{teachers.find((item) => String(item.id) === bulkReplaceTeacherId)?.name}</b>?
            </>
          }
          hint="Hai chiều cùng lúc: lịch của người này chuyển cho người kia và ngược lại. Lịch nào trùng khung giờ với phần còn lại của người nhận sẽ chặn cả thao tác và báo lỗi."
          submitLabel="Đổi chéo lịch"
          submitColor="bg-purple-600"
          loading={swapping}
          onClose={() => setSwapOpen(false)}
          onSubmit={swapTeacherTimetable}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Xoá mẫu lịch"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá lịch <b>{deleteTarget.className || "—"}</b> ·{" "}
                <b>{deleteTarget.teacherName}</b> ({deleteTarget.dayOfWeekLabel}{" "}
                {formatTime(deleteTarget.startTime)}–
                {formatTime(deleteTarget.endTime)})? Các buổi dạy đã sinh từ mẫu
                này cũng bị xoá.
              </>
            )
          }
          hint={
            deleteError
              ? "Mẫu lịch đã có buổi được chấm công nên không xoá được."
              : undefined
          }
          submitLabel={deleteError ? "Đóng" : "Xoá"}
          submitColor={deleteError ? "bg-gray-400" : "bg-red-500"}
          loading={deleting}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onSubmit={() =>
            deleteError ? setDeleteTarget(null) : removeSchedule()
          }
        />
      )}

      {rejectedDetail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRejectedDetail(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle size={19} />
                <h3 className="font-bold">Chi tiết tiết giáo viên từ chối</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectedDetail(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4 text-sm">
              <DetailRow label="Giáo viên" value={rejectedDetail.teacherName} danger />
              <DetailRow label="Trường" value={rejectedDetail.schoolName} />
              <DetailRow label="Lớp" value={rejectedDetail.className || "Chưa gắn lớp"} />
              <DetailRow label="Môn" value={rejectedDetail.subjectName} />
              <DetailRow
                label="Thời gian"
                value={`${rejectedDetail.dayOfWeekLabel || dayLabel(rejectedDetail.dayOfWeek)} · ${formatTime(rejectedDetail.startTime)}–${formatTime(rejectedDetail.endTime)}${rejectedDetail.periods ? ` · ${rejectedDetail.periods} tiết` : ""}`}
              />
              <DetailRow
                label="Hiệu lực"
                value={`${formatDate(rejectedDetail.effectiveFrom)}–${rejectedDetail.effectiveTo ? formatDate(rejectedDetail.effectiveTo) : "không thời hạn"}`}
              />
              {rejectedDetail.confirmedAt && (
                <DetailRow
                  label="Phản hồi lúc"
                  value={new Date(rejectedDetail.confirmedAt).toLocaleString("vi-VN")}
                />
              )}
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
                <p className="text-xs font-semibold uppercase">Lý do từ chối</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {rejectedDetail.rejectionReason || "Không có lý do"}
                </p>
              </div>

              {canManage && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    Xếp giáo viên khác
                  </p>
                  <SearchableSelect
                    value={replaceTeacherId}
                    onChange={setReplaceTeacherId}
                    options={replacementOptions}
                    disabled={loadingReplacements}
                    placeholder={loadingReplacements ? "Đang tìm giáo viên trống lịch…" : "— Chọn giáo viên phù hợp —"}
                    searchPlaceholder="Tìm giáo viên…"
                    emptyLabel="Không có giáo viên phù hợp và trống lịch"
                  />
                  <button
                    type="button"
                    onClick={replaceRejectedTeacher}
                    disabled={!replaceTeacherId || replacing}
                    className="mt-2 w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
                  >
                    {replacing ? "Đang lưu…" : "Xếp giáo viên này"}
                  </button>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                    Giữ nguyên giờ dạy, lớp, môn — chỉ đổi giáo viên. Người mới
                    sẽ nhận thông báo cần xác nhận lại.
                  </p>

                  {/* Không xếp được người khác thì bỏ hẳn tiết này khỏi TKB. */}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(rejectedDetail);
                      setRejectedDetail(null);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 active:scale-95"
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
    </div>
  );
}

function DetailRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${danger ? "text-rose-700" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

const dayLabel = (day: number) =>
  DAY_OF_WEEK_OPTIONS.find((item) => item.value === day)?.label || `Thứ ${day}`;

/**
 * Chữ trên tiêu đề TKB, bấm vào là sửa được. Gạch chân nét đứt để phân biệt
 * với chữ thường — không có dấu hiệu thì không ai đoán ra là bấm được.
 */
function EditableText({
  onClick,
  className = "",
  empty = false,
  children,
}: {
  onClick: () => void;
  className?: string;
  /** Chưa có giá trị → hiện mờ như placeholder. */
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Bấm để đổi"
      className={`rounded px-1 underline decoration-dotted decoration-1 underline-offset-4 hover:bg-black/5 ${
        empty ? "font-normal normal-case text-gray-400" : className
      }`}
    >
      {children}
    </button>
  );
}

/** Bọc ô đang sửa: bấm ra ngoài hoặc Esc thì đóng, giống hành vi của select. */
function InlineEditor({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <span ref={ref} className="inline-block align-middle">
      {children}
    </span>
  );
}

/**
 * Mỗi cặp lớp / giáo viên nằm chung một hàng grid trong ô của ngày.
 * Tên dài, trạng thái từ chối và nhiều lớp cùng tiết vẫn luôn thẳng hàng.
 */
function TimetableCell({
  cellKeyValue,
  drafts,
  results,
  teachers,
  classes,
  catalogs,
  defaultCatalogId,
  schoolPicked,
  canManage,
  saved,
  onPickClass,
  onPickTeacher,
  onAdd,
  onDelete,
  onViewRejected,
  onEdit,
}: {
  cellKeyValue: string;
  drafts: Cell[];
  results: Record<string, CellResult>;
  teachers: Teacher[];
  classes: SchoolClass[];
  /** Môn trường đã khai trong năm học đang xếp. */
  catalogs: SchoolCatalogOption[];
  /** Môn đang chọn ở tiêu đề — ô nháp mới mặc định theo đây, vẫn đổi được. */
  defaultCatalogId: string;
  schoolPicked: boolean;
  canManage: boolean;
  saved: TeachingSchedule[];
  onPickClass: (key: string, index: number, value: string) => void;
  onPickTeacher: (key: string, index: number, patch: Partial<Cell>) => void;
  onAdd: () => void;
  onDelete: (schedule: TeachingSchedule) => void;
  onViewRejected: (schedule: TeachingSchedule) => void;
  onEdit: (schedule: TeachingSchedule) => void;
}) {
  const pendingRows = drafts.length > 0
    ? drafts
    : canManage && saved.length === 0
      ? [{ classId: "", teacherId: "", catalogId: "" }]
      : [];
  const skippedResults = pendingRows
    .map((_, index) => results[`${cellKeyValue}#${index}`])
    .filter((item) => item?.status === "SKIPPED");
  const skipped = skippedResults.length > 0;
  const skippedReason = skippedResults.map((item) => item.reason).filter(Boolean).join(" · ");

  return (
    <td colSpan={3} className={`timetable-cell ${skipped ? "timetable-cell-error" : ""}`} title={skipped ? skippedReason : undefined}>
      <div className="timetable-cell-content">
        {saved.map((item) => {
          const rejected = String(item.confirmationStatus).toUpperCase() === "REJECTED";
          const open = () => rejected ? onViewRejected(item) : onEdit(item);
          const title = rejected
            ? `Giáo viên từ chối: ${item.rejectionReason || "Không có lý do"}`
            : `${item.className || "Chưa gắn lớp"} · ${item.subjectName} · ${item.teacherName}${canManage ? " — bấm để chỉnh sửa" : ""}`;
          return (
            <div key={item.id} className={`timetable-entry ${rejected ? "timetable-entry-rejected" : ""}`}>
              <div className="timetable-class-slot">
                <button type="button" className="timetable-saved-class" onClick={open} disabled={!canManage && !rejected} title={title}>
                  {item.className || "—"}
                </button>
              </div>
              <div className="timetable-subject-slot">
                <button type="button" className="timetable-saved-subject" onClick={open} disabled={!canManage && !rejected} title={title}>
                  {item.subjectName || "—"}
                </button>
              </div>
              <div className="timetable-teacher-slot">
                <button type="button" className="timetable-saved-teacher" onClick={open} disabled={!canManage && !rejected} title={title}>
                  <span className={`timetable-teacher-dot ${teacherColor(item.teacherId)}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className={rejected ? "text-rose-700 line-through" : "text-slate-700"}>{item.teacherName}</span>
                    {rejected && <span className="timetable-rejected-label"><AlertTriangle size={10} /> Từ chối</span>}
                  </span>
                </button>
                {canManage && (
                  <button type="button" className="timetable-remove-schedule" onClick={() => onDelete(item)} title="Xoá mẫu lịch" aria-label={`Xoá lịch ${item.className || ""} · ${item.teacherName}`}><X size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
        {canManage && pendingRows.map((cell, index) => {
          // Giữ gợi ý người trống trước, người bận sau trong cùng khung giờ.
          const busyTeacherIds = new Set(saved.map((item) => item.teacherId));
          pendingRows.forEach((other, otherIndex) => {
            if (otherIndex !== index && other.teacherId) busyTeacherIds.add(Number(other.teacherId));
          });
          const teacherOptions = teachers
            .map((item) => ({ item, busy: busyTeacherIds.has(item.id) }))
            .sort((a, b) => Number(a.busy) - Number(b.busy) || a.item.name.localeCompare(b.item.name, "vi"))
            .map(({ item, busy }) => ({
              id: item.id,
              name: `${item.name}${item.isActive ? "" : " (ngừng)"}${busy ? " · đã có tiết giờ này" : ""}`,
            }));
          return (
            <div key={`draft-${index}`} className="timetable-entry timetable-draft">
              <div className="timetable-class-slot">
                <select value={cell.classId} onChange={(e) => onPickClass(cellKeyValue, index, e.target.value)} disabled={!schoolPicked} aria-label="Lớp học" title={classes.find((item) => String(item.id) === cell.classId)?.name || "Chọn lớp học"}>
                  <option value="">Chọn lớp</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="timetable-subject-slot">
                {/* Giá trị hiện ra là môn thực tế sẽ lưu: ô chưa tự chọn thì theo
                    tiêu đề, nên đổi môn ở tiêu đề là các ô đó đổi theo. */}
                <select
                  value={cell.catalogId || defaultCatalogId}
                  onChange={(e) => onPickTeacher(cellKeyValue, index, { catalogId: e.target.value })}
                  disabled={!schoolPicked || catalogs.length === 0}
                  aria-label="Môn học"
                  title={catalogs.find((item) => String(item.id) === (cell.catalogId || defaultCatalogId))?.name || "Chọn môn học"}
                >
                  <option value="">Chọn môn</option>
                  {catalogs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="timetable-teacher-slot" role="group" aria-label="Giáo viên">
                <SearchableSelect
                  value={cell.teacherId}
                  onChange={(value) => onPickTeacher(cellKeyValue, index, { teacherId: value })}
                  options={teacherOptions}
                  disabled={!cell.classId}
                  placeholder="Chọn giáo viên"
                  searchPlaceholder="Tìm giáo viên…"
                  portal
                  className="timetable-select"
                />
              </div>
            </div>
          );
        })}
        {!canManage && saved.length === 0 && <div className="timetable-empty" aria-label="Chưa xếp lịch">—</div>}
        {canManage && (
          <div className="timetable-cell-footer">
            {(saved.length > 0 || drafts.length > 0) && (
              <button type="button" onClick={onAdd} disabled={!schoolPicked} title="Xếp thêm lớp trong cùng khung giờ"><Plus size={12} /> Thêm lớp</button>
            )}
          </div>
        )}
        {skipped && skippedReason && <p className="timetable-cell-message">{skippedReason}</p>}
      </div>
    </td>
  );
}
