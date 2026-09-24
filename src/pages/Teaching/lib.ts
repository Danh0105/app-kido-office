import {
  DAY_OF_WEEK_OPTIONS,
  type CalendarSession,
  type SchoolClass,
  type TeachingSchedule,
  type TeachingSession,
} from "@/types/teaching";
import { hasRole } from "@/utils/auth";

// ================= PHÂN QUYỀN =================
// User nhiều role → lấy quyền rộng nhất (vừa giaovien vừa nhansu/giaovu → dùng giao diện quản lý).

export const canManageTeaching = () => hasRole("nhansu", "giaovu");

/**
 * Được đọc **danh bạ giáo viên** (`GET /teachers` — có SĐT, email, đơn giá).
 * Khớp `TEACHING_VIEW_ROLES` + giáo viên ở backend. Kinh doanh (`sales`)
 * chỉ xem được thời khoá biểu trường mình, không có quyền này — gọi là 403.
 */
export const canViewTeacherDirectory = () =>
  hasRole(
    "nhansu",
    "giaovu",
    "director",
    "director_la",
    "troly_gd",
    "ketoan_truong",
    "giaovien_congty",
    "giaovien_ctv",
  );

/**
 * Dải năm học mặc định cho các bộ lọc/chọn năm học không có sẵn dữ liệu để
 * suy ra (VD lọc trước khi tải gì cả) — cùng công thức với trang Chính sách
 * (`PolicySelector.tsx`) để năm học hiển thị nhất quán toàn app. Luôn có sẵn
 * đến năm hiện tại + 2 (tối thiểu 2028-2029) để tạo dữ liệu cho năm tới, kể cả
 * khi hệ thống chưa có bản ghi nào của năm đó.
 */
export const fallbackSchoolYears = () => {
  const start = Math.max(new Date().getFullYear() + 2, 2028);
  return Array.from({ length: 12 }, (_, index) => {
    const year = start - index;
    return `${year}-${year + 1}`;
  });
};

/** Khai tiền: đơn giá tiết theo giáo viên/môn học, phụ cấp. Giáo vụ không được. */
export const canSetTeachingRates = () => hasRole("nhansu");

/**
 * Duyệt đề nghị mở tài khoản giáo viên — chỉ Nhân sự
 * (`TEACHER_ACCOUNT_APPROVE_ROLES` của backend). Giáo vụ gửi đề nghị và xem lại
 * được đề nghị của chính mình, nhưng không tự duyệt.
 */
export const canApproveTeacherAccount = () => hasRole("nhansu");

/**
 * Xem nhật ký thao tác của Giáo vụ / Nhân sự (`ACTIVITY_LOG_VIEW_ROLES` của
 * backend). Cố ý **không** có `giaovu`: nhật ký tồn tại để giám sát chính họ,
 * hiện mục menu ra rồi bấm vào nhận 403 còn khó hiểu hơn là không thấy.
 */
export const canViewActivityLog = () =>
  hasRole("nhansu", "director", "director_la", "troly_gd");

const RATE_FIELDS = ["defaultRatePerPeriod", "ratePerPeriod", "otherCosts"] as const;

/** Bỏ field tiền khỏi payload khi user không có quyền khai. */
export function stripRateFields<T extends object>(payload: T): T {
  if (canSetTeachingRates()) return payload;

  const out = { ...payload } as T & Record<string, unknown>;
  for (const field of RATE_FIELDS) delete out[field];
  return out;
}

export const canViewTeaching = () =>
  hasRole(
    "nhansu",
    "giaovu",
    "director",
    "director_la",
    "troly_gd",
    "ketoan_truong",
  );

export const isTeacher = () => hasRole(TEACHER_STAFF_ROLE, TEACHER_COLLABORATOR_ROLE);

// Màn đầu tiên user được phép vào — dùng khi chặn route.
export const teachingHomePath = () => {
  if (canViewTeaching()) return "/nhan-su/giao-vien";
  if (isTeacher()) return "/giao-vien/lich-day";
  // Không có quyền vào module Giảng dạy → về đúng trang chủ của role đó.
  if (hasRole("employee", "probation", "employee_la", "sales")) {
    return "/employee/home";
  }
  return "/director";
};

/**
 * Tạm ẩn toàn bộ tính năng liên quan tới giá tiền (quản lý môn học kèm đơn
 * giá, tiền công, bảng công tổng hợp...) — chưa sẵn sàng ra mắt. Đặt lại
 * `true` để bật lại nguyên trạng, không cần gỡ code ở từng nơi.
 */
export const TEACHING_MONEY_FEATURES_ENABLED = false;

export const TEACHING_MENUS: {
  title: string;
  path: string;
  /** Chỉ nhansu/giaovu thấy — các role chỉ-xem gọi vào sẽ nhận 403. */
  manageOnly?: boolean;
  /** Chỉ Nhân sự được vào (cùng quyền khai đơn giá). */
  rateManageOnly?: boolean;
  /** Tính năng liên quan giá tiền — ẩn theo `TEACHING_MONEY_FEATURES_ENABLED`. */
  moneyFeature?: boolean;
  /** Chỉ người được xem nhật ký thao tác (Nhân sự + Ban giám đốc). */
  logViewOnly?: boolean;
}[] = [
  { title: "Giáo viên", path: "/nhan-su/giao-vien" },
  // Đứng trước "Lớp học": trường nhiều cơ sở phải khai điểm trường trước rồi
  // mới gắn được lớp vào đúng điểm.
  { title: "Điểm trường", path: "/nhan-su/diem-truong", manageOnly: true },
  // Đứng trước "Thời khóa biểu": phải có lớp rồi mới xếp được lịch cho lớp.
  { title: "Lớp học", path: "/nhan-su/lop-hoc" },
  // Môn học của trường — Nhân sự và Giáo vụ tự khai như bên Kinh doanh, không
  // phải nhờ Kinh doanh tạo hộ mới xếp được lịch. Cột đơn giá vẫn chỉ Nhân sự
  // thấy (`canSetTeachingRates`), nên không cần tách thành mục riêng.
  { title: "Môn học", path: "/nhan-su/mon-hoc", manageOnly: true },
  {
    title: "Phụ cấp xăng",
    path: "/nhan-su/phu-cap-xang",
    moneyFeature: true,
    rateManageOnly: true,
  },
  { title: "Thời khóa biểu", path: "/nhan-su/lich-day" },
  { title: "Chấm công", path: "/nhan-su/cham-cong" },
  { title: "Hình ảnh", path: "/nhan-su/hinh-anh", manageOnly: true },
  { title: "Vị trí trường", path: "/nhan-su/vi-tri-truong" },
  // Cuối menu: tra cứu khi có tranh cãi, không phải việc hằng ngày.
  { title: "Nhật ký", path: "/nhan-su/nhat-ky", logViewOnly: true },
];

/** Menu đã lọc theo quyền — đừng hiện mục quản lý cho role chỉ-xem. */
export const teachingMenusForUser = () =>
  TEACHING_MENUS.filter(
    (item) =>
      (!item.manageOnly || canManageTeaching()) &&
      (!item.rateManageOnly || canSetTeachingRates()) &&
      (!item.logViewOnly || canViewActivityLog()) &&
      // Tính năng giá tiền vẫn ẩn chung, nhưng Nhân sự luôn thấy "Môn học" —
      // đây là nơi họ khai đơn giá, ẩn nốt thì không ai khai được giá cả.
      (!item.moneyFeature || TEACHING_MONEY_FEATURES_ENABLED || canSetTeachingRates()),
  );

export const TEACHER_MENUS = [
  { title: "Lịch của tôi", path: "/giao-vien/lich-day" },
  { title: "Chấm công", path: "/giao-vien/cham-cong" },
  { title: "Tiết đang mở", path: "/giao-vien/dang-ky-tiet-day" },
];

// ================= TÀI KHOẢN GIÁO VIÊN =================

/** Mật khẩu cấp sẵn khi tạo tài khoản cho giáo viên. */
export const DEFAULT_TEACHER_PASSWORD = "123456";

/**
 * Giáo viên chia làm 2 loại: công ty và cộng tác viên — quyền hiện tại giống
 * hệt nhau, tách sẵn để sau này giáo viên công ty được bổ sung quyền riêng.
 */
export const TEACHER_STAFF_ROLE = "giaovien_congty";
export const TEACHER_COLLABORATOR_ROLE = "giaovien_ctv";

/** Đăng nhập bằng SĐT nên số phải đúng định dạng, không chỉ "có nhập". */
export const isValidPhone = (value: string) =>
  /^(0|\+84)(\d{9}|2\d{8,9})$/.test(value.trim());

export const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

/**
 * Link vị trí giáo viên. Chép đúng regex của backend (`TeacherDto.googleMapsUrl`)
 * để người dùng biết sai ngay khi gõ, không phải bấm Lưu mới nhận 400.
 * Chỉ nhận link Google Maps, kể cả dạng rút gọn `maps.app.goo.gl`.
 */
const GOOGLE_MAPS_URL =
  /^https:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps(?:\/|\?|$)|maps\.google\.[a-z.]+(?:\/|\?|$)|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i;

/** Để trống cũng hợp lệ — vị trí không bắt buộc. */
export const isValidGoogleMapsUrl = (value: string) => {
  const raw = value.trim();
  return !raw || (raw.length <= 500 && GOOGLE_MAPS_URL.test(raw));
};

/** "[STEM] STEM" / "Kỹ năng sống" — mã môn giúp phân biệt các tên gần giống nhau. */
export const catalogLabel = (item: { name: string; code?: string | null }) =>
  item.code ? `[${item.code}] ${item.name}` : item.name;

export type SchoolCatalogOption = {
  id: number;
  /** Nhãn của dropdown — kèm mã môn để phân biệt các tên gần giống nhau. */
  name: string;
  /** Tên trần, dùng cho tiêu đề TKB: mã môn trên tiêu đề chỉ làm rối. */
  plainName: string;
};

/**
 * Môn **của một trường** gộp về danh mục dùng chung: API xếp lịch chỉ nhận
 * `catalogId`, còn mỗi trường có bản ghi môn riêng (lặp lại ở từng năm học) nên
 * phải gộp lại theo danh mục.
 *
 * Lọc theo năm học vì backend tra môn theo đúng bộ (trường, danh mục, năm học):
 * chọn môn của năm khác thì mọi ô đều bị bỏ qua với lý do "chưa khai môn".
 *
 * Môn cũ chưa gắn danh mục bị loại — không có `catalogId` thì không xếp lịch được.
 */
export const catalogsOfSubjects = (
  subjects: {
    name: string;
    catalogId?: number | null;
    catalog?: { name: string; code?: string | null } | null;
    schoolYear?: string | null;
  }[],
  schoolYear?: string,
): SchoolCatalogOption[] => {
  const byId = new Map<number, SchoolCatalogOption>();

  subjects.forEach((subject) => {
    if (schoolYear && (subject.schoolYear || "") !== schoolYear) return;
    if (!subject.catalogId || byId.has(subject.catalogId)) return;

    byId.set(subject.catalogId, {
      id: subject.catalogId,
      name: subject.catalog ? catalogLabel(subject.catalog) : subject.name,
      plainName: subject.catalog?.name || subject.name,
    });
  });

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

/**
 * "Trường A, Trường B +3" — tóm tắt danh mục dài trong một dòng của bảng.
 * Hiện hết tên thì mỗi dòng cao gấp mấy lần dòng thường.
 */
export const summarizeNames = (
  items: { name: string }[],
  max = 2,
): { names: string[]; extra: number } => ({
  names: items.slice(0, max).map((item) => item.name),
  extra: Math.max(0, items.length - max),
});

// ================= LỚP HỌC =================

/** Đường dẫn màn quản lý lớp — dùng trong empty state của các form xếp lịch. */
export const CLASS_PAGE_PATH = "/nhan-su/lop-hoc";

/** Khối lớp cho phép khai báo; để trống với mầm non. */
export const GRADE_LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);

export const MAX_STUDENT_COUNT = 1000;

/**
 * Năm học hiện tại theo mốc chuyển năm tháng 8 — cùng quy ước với màn Môn học.
 * Chỉ dùng làm phương án dự phòng khi trường chưa có năm học nào trong dữ liệu.
 */
export const currentSchoolYear = () => {
  const now = new Date();
  const year =
    now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
};

/** Năm học mới nhất lên đầu; "Hè 2026-2027" xếp cạnh năm tương ứng. */
export const sortSchoolYears = (years: string[]) =>
  [...years].sort((a, b) => b.localeCompare(a, "vi"));

/** Sĩ số hợp lệ: số nguyên 0…MAX_STUDENT_COUNT (để trống = 0). */
export const isValidStudentCount = (value: string) => {
  if (!value.trim()) return true;
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 && num <= MAX_STUDENT_COUNT;
};

/**
 * Nhãn lớp trong dropdown. Cùng tên lớp lặp lại ở năm học sau nên phải kèm
 * năm học, nếu không Nhân sự không phân biệt được hai lớp trùng tên.
 */
export const classLabel = (item: {
  name: string;
  schoolYear?: string | null;
}) => (item.schoolYear ? `${item.name} · ${item.schoolYear}` : item.name);

/** Tên lớp của mẫu lịch / buổi dạy; "—" với dữ liệu cũ chưa gắn lớp. */
export const classNameOf = (item: { className?: string | null }) =>
  item.className || "—";

/** "TIỂU HỌC THẮNG NHÌ · 1A" — lớp luôn đứng cạnh tên trường. */
export const schoolWithClass = (item: {
  schoolName: string;
  className?: string | null;
}) => (item.className ? `${item.schoolName} · ${item.className}` : item.schoolName);

/** "Khối 1" / "—" khi lớp không khai báo khối (mầm non). */
export const gradeLabel = (grade?: number | null) =>
  typeof grade === "number" ? `Khối ${grade}` : "—";

// ================= THỜI KHOÁ BIỂU (TKB) =================

/** Một dòng của lưới TKB: tiết dạy hoặc giờ ra chơi. */
export type TimetableRow = {
  key: string;
  session: "SANG" | "CHIEU";
  /** `false` = giờ ra chơi: chỉ hiển thị, không xếp lịch được. */
  isPeriod: boolean;
  label: string;
  startTime: string;
  endTime: string;
};

export const SESSION_LABELS: Record<TimetableRow["session"], string> = {
  SANG: "SÁNG",
  CHIEU: "CHIỀU",
};

/**
 * Khung tiết mặc định theo TKB tiểu học đang dùng. Trường nào lệch giờ thì sửa
 * ngay trên lưới — giờ của từng dòng là giờ được chốt vào mẫu lịch.
 */
export const DEFAULT_TIMETABLE_ROWS: TimetableRow[] = [
  { key: "S1", session: "SANG", isPeriod: true, label: "1", startTime: "07:30", endTime: "08:10" },
  { key: "S2", session: "SANG", isPeriod: true, label: "2", startTime: "08:10", endTime: "08:50" },
  { key: "SB", session: "SANG", isPeriod: false, label: "RA CHƠI", startTime: "08:50", endTime: "09:20" },
  { key: "S3", session: "SANG", isPeriod: true, label: "3", startTime: "09:20", endTime: "10:00" },
  { key: "S4", session: "SANG", isPeriod: true, label: "4", startTime: "10:00", endTime: "10:40" },
  { key: "C1", session: "CHIEU", isPeriod: true, label: "1", startTime: "13:30", endTime: "14:05" },
  { key: "C2", session: "CHIEU", isPeriod: true, label: "2", startTime: "14:10", endTime: "14:45" },
  { key: "CB", session: "CHIEU", isPeriod: false, label: "RA CHƠI", startTime: "14:50", endTime: "15:20" },
  { key: "C3", session: "CHIEU", isPeriod: true, label: "3", startTime: "15:20", endTime: "16:00" },
];

/** Thứ mặc định của TKB: Thứ 2 → Thứ 6. */
/** Mặc định hiện trọn tuần để có thể xếp lịch cả Thứ Bảy và Chủ Nhật. */
export const DEFAULT_TIMETABLE_DAYS = [2, 3, 4, 5, 6, 7, 8];

/** Khoá ô trong lưới: một dòng tiết × một thứ. */
export const cellKey = (rowKey: string, dayOfWeek: number) =>
  `${rowKey}|${dayOfWeek}`;

/**
 * Màu tên giáo viên trên lưới — TKB giấy tô màu theo người dạy để quét mắt
 * thấy ngay ai dạy buổi nào. Lấy theo id nên cùng một giáo viên luôn một màu.
 */
const TEACHER_COLORS = [
  "text-red-600",
  "text-gray-800",
  "text-blue-700",
  "text-emerald-700",
  "text-purple-700",
  "text-amber-700",
  "text-pink-600",
  "text-cyan-700",
];

export const teacherColor = (teacherId: number) =>
  TEACHER_COLORS[teacherId % TEACHER_COLORS.length];

/**
 * Số mẫu lịch tối đa mỗi lần gọi `POST /teaching-schedules/bulk` — trần do BE
 * đặt, chặn ở FE để không phải chờ 400 mới biết. Cũng là số ô tối đa của một
 * lần lưu TKB.
 */
export const MAX_BULK_ITEMS = 200;

/**
 * Khoảng ngày tối đa mỗi lần sinh buổi (`MAX_GENERATE_DAYS` của BE).
 * Vượt trần khi lưu TKB là hỏng nửa chừng: mẫu lịch đã ghi xong rồi mới 400 ở
 * bước sinh buổi — nên phải chặn từ FE.
 */
export const MAX_GENERATE_DAYS = 400;

/** Lớp đang được dùng ở mẫu lịch hoặc buổi dạy → BE chặn xoá bằng 409. */
export const isClassInUse = (item: Pick<SchoolClass, "scheduleCount" | "sessionCount">) =>
  item.scheduleCount > 0 || item.sessionCount > 0;

// ================= NGÀY / GIỜ =================
// Hiển thị DD/MM/YYYY, gửi API YYYY-MM-DD. Không dùng thư viện ngày ngoài.

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "YYYY-MM-DD" theo giờ địa phương (không lệch múi giờ như toISOString). */
export const toISODate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "YYYY-MM-DD" -> Date (00:00 giờ địa phương). */
export const fromISODate = (value: string) => {
  const [y, m, d] = (value || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

/** "YYYY-MM-DD" -> "DD/MM/YYYY" */
export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
};

/** "YYYY-MM-DD" -> "04/08" (dùng trong thanh điều hướng tuần) */
export const formatDayMonth = (value: string) => {
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
};

/** ISO datetime -> "04/08 15:32" */
export const formatCheckedAt = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};

/** "07:30:00" -> "07:30" (BE có thể trả kèm giây) */
export const formatTime = (value?: string | null) =>
  (value || "").slice(0, 5);

/** "07:30:00" -> 450 (số phút từ 00:00). `null` khi giờ không hợp lệ. */
export const minutesOfTime = (value?: string | null) => {
  const [h, m] = (value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** 450 -> "07:30" (ngược với minutesOfTime), tự kẹp trong 00:00–23:59. */
export const timeFromMinutes = (minutes: number) => {
  const clamped = Math.max(0, Math.min(Math.round(minutes), 24 * 60 - 1));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
};

/** Phút hiện tại trong ngày — dùng cho vạch "bây giờ" trên lưới lịch. */
export const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const todayISO = () => toISODate(new Date());

export const isToday = (value: string) => value === todayISO();

export const addDays = (value: string, days: number) => {
  const d = fromISODate(value);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** dayOfWeek theo quy ước module: Thứ Hai = 2 … Chủ Nhật = 8 (không có 1). */
export const dayOfWeekOf = (value: string) => {
  const js = fromISODate(value).getDay(); // 0 = CN
  return js === 0 ? 8 : js + 1;
};

/** Thứ Hai của tuần chứa `value`. */
export const startOfWeek = (value: string) =>
  addDays(value, -(dayOfWeekOf(value) - 2));

export const endOfWeek = (value: string) => addDays(startOfWeek(value), 6);

export const startOfMonth = (value: string) => {
  const d = fromISODate(value);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
};

export const endOfMonth = (value: string) => {
  const d = fromISODate(value);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

export const addMonths = (value: string, months: number) => {
  const d = fromISODate(value);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + months, 1));
};

/** Số ngày trong khoảng [from, to] tính cả 2 đầu. */
export const daysBetween = (from: string, to: string) =>
  Math.round(
    (fromISODate(to).getTime() - fromISODate(from).getTime()) / 86400000,
  ) + 1;

/** Danh sách ngày của tuần chứa `value` (T2 → CN). */
export const weekDates = (value: string) => {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Mọi ngày trong khoảng [from, to], tính cả 2 đầu. */
export const datesInRange = (from: string, to: string) =>
  Array.from({ length: Math.max(0, daysBetween(from, to)) }, (_, i) =>
    addDays(from, i),
  );

/** Các ô của lưới tháng: bắt đầu từ Thứ Hai của tuần chứa ngày 1. */
export const monthGridDates = (value: string) => {
  const start = startOfWeek(startOfMonth(value));
  const last = endOfMonth(value);
  const total = Math.ceil(daysBetween(start, endOfWeek(last)) / 7) * 7;
  return Array.from({ length: total }, (_, i) => addDays(start, i));
};

// ================= TIÊU ĐỀ THANH ĐIỀU HƯỚNG =================
// Đặt tên khoảng thời gian theo kiểu app lịch: "Tháng 8, 2026", "04/08 – 10/08/2026".

/** "Thứ Ba, 04/08/2026" */
export const dayTitle = (value: string) => {
  const label = DAY_OF_WEEK_OPTIONS.find(
    (d) => d.value === dayOfWeekOf(value),
  )?.label;
  return `${label ? `${label}, ` : ""}${formatDate(value)}`;
};

/** "04/08 – 10/08/2026" (tuần chứa `value`) */
export const weekTitle = (value: string) => {
  const from = startOfWeek(value);
  const to = endOfWeek(value);
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}/${fromISODate(
    to,
  ).getFullYear()}`;
};

/** "Tháng 8, 2026" */
export const monthTitle = (value: string) => {
  const d = fromISODate(value);
  return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
};

// ================= TIẾT DẠY =================

/** Quy đổi tạm khi buổi dạy chưa khai báo số tiết (dữ liệu cũ). */
export const MINUTES_PER_PERIOD = 45;

/** Thời lượng buổi dạy (phút); 0 nếu giờ không hợp lệ. */
export const sessionMinutes = (session: {
  startTime?: string | null;
  endTime?: string | null;
}) => {
  const start = minutesOfTime(session.startTime);
  const end = minutesOfTime(session.endTime);
  if (start == null || end == null || end <= start) return 0;
  return end - start;
};

/** Buổi đã qua giờ kết thúc nhưng giáo viên vẫn chưa check-out. */
export const isCheckoutOverdue = (
  session: Pick<
    TeachingSession,
    | "status"
    | "teacherId"
    | "checkoutRequired"
    | "checkoutAt"
    | "date"
    | "endTime"
  >,
  now = new Date(),
) => {
  if (
    session.status === "CANCELLED" ||
    !session.teacherId ||
    session.checkoutRequired === false ||
    session.checkoutAt
  ) {
    return false;
  }

  const dateParts = session.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = session.endTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dateParts || !timeParts) return false;

  const endAt = new Date(
    Number(dateParts[1]),
    Number(dateParts[2]) - 1,
    Number(dateParts[3]),
    Number(timeParts[1]),
    Number(timeParts[2]),
    Number(timeParts[3] || 0),
  );

  return now.getTime() > endAt.getTime();
};

/**
 * Số tiết của buổi dạy. Ưu tiên `periods` do Nhân sự khai báo;
 * buổi cũ chưa có thì quy đổi tạm theo thời lượng (45 phút/tiết).
 */
export const periodsOf = (session: {
  periods?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}) => {
  if (typeof session.periods === "number" && session.periods > 0) {
    return session.periods;
  }
  const minutes = sessionMinutes(session);
  return minutes > 0 ? Math.max(1, Math.round(minutes / MINUTES_PER_PERIOD)) : 0;
};

/** Định mức tiết mỗi tuần của giáo viên (để trống = không giới hạn). */
export const MAX_PERIODS_PER_WEEK = 100;

export const isValidWeeklyQuota = (value: string) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= MAX_PERIODS_PER_WEEK;
};

/** Số tiết tối đa cho phép nhập ở form — chặn gõ nhầm 100 tiết một buổi. */
export const MAX_PERIODS = 20;

/** Ô "số tiết" hợp lệ: số nguyên 1…MAX_PERIODS. */
export const isValidPeriods = (value: string | number) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= MAX_PERIODS;
};

/** Buổi dạy chưa được khai báo số tiết → số tiết đang là ước lượng. */
export const hasDeclaredPeriods = (session: { periods?: number | null }) =>
  typeof session.periods === "number" && session.periods > 0;

// ================= ĐƠN GIÁ & TIỀN CÔNG =================
// Đơn giá được **chốt vào từng buổi** lúc tạo (giáo viên → mẫu lịch → buổi), nên
// sửa đơn giá chỉ áp cho buổi tạo về sau; bảng công tháng cũ đứng yên.

/** Trần đơn giá backend nhận (0 – 100.000.000). */
export const MAX_RATE_PER_PERIOD = 100_000_000;

/** Nhãn cho `null` — chưa khai đơn giá, khác hẳn 0 đồng (dạy không công). */
export const RATE_MISSING_LABEL = "Chưa khai giá";

/**
 * Ô đơn giá hợp lệ: số 0…100tr, tối đa 2 chữ số thập phân.
 * Để trống cũng hợp lệ — nghĩa là không khai giá riêng.
 */
export const isValidRate = (value: string) => {
  const raw = value.trim();
  if (!raw) return true;

  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > MAX_RATE_PER_PERIOD) return false;

  // Đếm chữ số thập phân trên chuỗi: 0.1 * 100 trong JS ra 10.000000000000002.
  return (raw.split(".")[1]?.length ?? 0) <= 2;
};

/** Ô đơn giá -> giá trị gửi API. Rỗng = null; `0` giữ nguyên là 0. */
export const parseRate = (value: string) =>
  value.trim() === "" ? null : Number(value);

/** Đơn giá của form: null -> "" để ô nhập trống thay vì hiện "null". */
export const rateToInput = (value?: number | null) =>
  value == null ? "" : String(value);

/** 150000 -> "150.000 ₫". `null` = chưa khai giá. */
export const formatMoney = (value?: number | null) =>
  value == null ? RATE_MISSING_LABEL : `${value.toLocaleString("vi-VN")} ₫`;

/** Phụ cấp xăng có giá trị (kể cả 0đ) là cấu hình hợp lệ, không phải thiếu giá. */
export const hasGasAllowance = (session: Pick<TeachingSession, "gasAllowance">) =>
  session.gasAllowance != null;

export const formatFuelAllowance = (
  session: Pick<TeachingSession, "gasAllowance" | "distanceToSchoolKm">,
) => {
  const distance = session.distanceToSchoolKm;
  return `Phụ cấp xăng: ${formatMoney(session.gasAllowance)}${
    distance == null ? "" : ` (${distance.toLocaleString("vi-VN")}km)`
  }`;
};

/**
 * Tiền công của một buổi = đơn giá × số tiết (cùng công thức với backend).
 * Chỉ dùng để xem trước trong form — số hiển thị của buổi đã lưu lấy từ
 * `session.amount` do backend trả.
 */
export const amountOf = (rate?: number | null, periods?: number | null) =>
  rate == null ? null : Math.round(rate * (periods ?? 1) * 100) / 100;

/** 90 -> "1h30", 45 -> "45 phút" */
export const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} phút`;
  return m ? `${h}h${pad(m)}` : `${h}h`;
};

// ================= VALIDATE =================

export const isTimeOrderValid = (start: string, end: string) =>
  !!start && !!end && start < end;

export const isDateOrderValid = (from: string, to?: string | null) =>
  !from || !to || from <= to;

/** Chạm biên không tính là trùng: 07:30–09:00 và 09:00–10:30 hợp lệ. */
export const timeRangesOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => aStart < bEnd && bStart < aEnd;

/** Khoảng ngày giao nhau; `null` ở `to` nghĩa là không có ngày kết thúc. */
export const dateRangesOverlap = (
  aFrom: string,
  aTo: string | null | undefined,
  bFrom: string,
  bTo: string | null | undefined,
) => (!aTo || aTo >= bFrom) && (!bTo || bTo >= aFrom);

// ================= MẪU LỊCH TUẦN TRÊN LỊCH =================

/** Mẫu lịch có hiệu lực vào đúng ngày này không. */
const scheduleCoversDate = (schedule: TeachingSchedule, date: string) =>
  schedule.isActive &&
  schedule.dayOfWeek === dayOfWeekOf(date) &&
  schedule.effectiveFrom <= date &&
  (!schedule.effectiveTo || schedule.effectiveTo >= date);

/**
 * Dựng các ô "theo lịch cố định" từ mẫu lịch tuần cho khoảng ngày đang xem,
 * để lịch ngày/tuần/tháng thấy trước cả những buổi Nhân sự chưa sinh.
 *
 * Ngày nào đã có buổi dạy thật thì bỏ qua mẫu: buổi thật mới là nguồn đúng
 * (có thể đã đổi giờ, huỷ, hoặc chấm công rồi). Khớp theo `scheduleId`, và
 * khớp thêm theo môn + giờ để buổi Nhân sự tạo tay không bị vẽ trùng.
 *
 * Chỉ dựng cho hôm nay trở đi: ngày đã qua mà không có buổi thật nghĩa là
 * buổi đó không diễn ra, vẽ thêm ô "dự kiến" chỉ gây hiểu nhầm.
 */
export const plannedFromSchedules = (
  schedules: TeachingSchedule[],
  dates: string[],
  sessions: TeachingSession[],
  options: { includePast?: boolean } = {},
): CalendarSession[] => {
  const taken = new Set<string>();
  sessions.forEach((session) => {
    if (session.scheduleId) taken.add(`${session.scheduleId}|${session.date}`);
    taken.add(
      `${session.subjectId}|${session.date}|${formatTime(session.startTime)}`,
    );
  });

  const planned: CalendarSession[] = [];
  const today = todayISO();

  dates.forEach((date) => {
    if (!options.includePast && date < today) return;

    schedules.forEach((schedule) => {
      if (!scheduleCoversDate(schedule, date)) return;
      if (taken.has(`${schedule.id}|${date}`)) return;
      if (
        taken.has(
          `${schedule.subjectId}|${date}|${formatTime(schedule.startTime)}`,
        )
      ) {
        return;
      }

      planned.push({
        // Id âm: không đụng id buổi thật, đủ để React phân biệt các ô.
        id: -(planned.length + 1),
        fromTemplate: true,
        scheduleId: schedule.id,
        teacherId: schedule.teacherId,
        teacherName: schedule.teacherName,
        schoolId: schedule.schoolId,
        schoolName: schedule.schoolName,
        // Thiếu 3 field này thì ô "dự kiến" trên lịch mất tên lớp so với buổi thật.
        classId: schedule.classId,
        className: schedule.className,
        classGradeLevel: schedule.classGradeLevel,
        subjectId: schedule.subjectId,
        subjectName: schedule.subjectName,
        schoolYear: schedule.schoolYear,
        date,
        dayOfWeek: schedule.dayOfWeek,
        dayOfWeekLabel: schedule.dayOfWeekLabel,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        periods: schedule.periods,
        // Ô "dự kiến" chưa có buổi thật nên chưa chốt giá — hiện tạm giá môn học.
        ratePerPeriod: schedule.subjectRatePerPeriod,
        amount: amountOf(schedule.subjectRatePerPeriod, schedule.periods),
        distanceToSchoolKm: null,
        gasAllowance: null,
        assignmentStatus: "ASSIGNED",
        applicationCount: 0,
        status: "SCHEDULED",
        statusLabel: null,
        isMakeup: false,
        makeupForSessionId: null,
        attendanceNote: null,
        checkedById: null,
        checkedByName: null,
        checkedAt: null,
        note: schedule.note,
        schoolLatitude: null,
        schoolLongitude: null,
        schoolCheckinRadius: null,
        // Ô "dự kiến" không phải buổi thật nên không có ngữ cảnh block — coi
        // như buổi lẻ (cần cả check-in lẫn check-out), giống buổi thật mặc định.
        checkinRequired: true,
        checkoutRequired: true,
        checkinAt: null,
        checkinLatitude: null,
        checkinLongitude: null,
        checkinAccuracy: null,
        checkinDistance: null,
        checkinOutOfRange: null,
        checkoutAt: null,
        checkoutLatitude: null,
        checkoutLongitude: null,
        checkoutAccuracy: null,
        checkoutDistance: null,
        checkoutOutOfRange: null,
      });
    });
  });

  return planned;
};

/**
 * "Trường chính" là phạm vi lớp/lịch riêng, tách biệt với từng điểm trường:
 * lớp chưa gắn điểm trường (`schoolLocationId = null`) thuộc trường chính.
 * Gửi `schoolLocationId = 0` để BE lọc đúng phạm vi này (IS NULL) — 0 không
 * bị `clean()` loại như "" / undefined.
 */
export const MAIN_SCHOOL_LOCATION_ID = 0;
export const MAIN_SCHOOL_LABEL = "Trường chính";

/**
 * Danh sách chọn điểm trường luôn có "Trường chính" đứng đầu, để người dùng
 * chọn được phạm vi trường chính giống như chọn một cơ sở bất kỳ.
 */
export function locationScopeOptions(
  locations: { id: number; name: string }[],
): { id: number; name: string }[] {
  return [
    { id: MAIN_SCHOOL_LOCATION_ID, name: MAIN_SCHOOL_LABEL },
    ...locations.map((item) => ({ id: item.id, name: item.name })),
  ];
}

/** Lớp có thuộc phạm vi điểm trường đang chọn không ("" = mọi phạm vi). */
export function inLocationScope(
  schoolLocationId: number | null | undefined,
  scope: string,
): boolean {
  if (!scope) return true;
  if (Number(scope) === MAIN_SCHOOL_LOCATION_ID) return schoolLocationId == null;
  return String(schoolLocationId ?? "") === scope;
}
