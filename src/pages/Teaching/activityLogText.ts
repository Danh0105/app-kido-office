import type {
  ActivityContext,
  ActivityLog,
  FieldChange,
} from "@/service/activityLog.api";

/** Tên danh mục dùng để làm nhật ký cũ (chưa có `context`) dễ đọc hơn. */
export type ActivityReferenceNames = {
  schools: Record<number, string>;
  subjects: Record<number, string>;
  catalogs: Record<number, string>;
  teachers: Record<number, string>;
  classes: Record<number, { name: string; schoolName?: string }>;
  schedules: Record<number, { schoolName: string }>;
};

/**
 * Dịch một dòng nhật ký thô (method + path + body) thành câu tiếng Việt.
 *
 * Người đọc nhật ký là Nhân sự và Ban giám đốc, không phải dân kỹ thuật:
 * `PATCH /teaching-sessions/128/attendance` không nói lên điều gì, còn
 * "Chấm công tiết dạy #128" thì đọc phát hiểu ngay.
 */

/** Nhóm dữ liệu — dùng cho nhãn mặc định và bộ lọc. */
export const RESOURCE_LABELS: Record<string, string> = {
  teachers: "Giáo viên",
  employees: "Nhân viên",
  "school-classes": "Lớp học",
  "teaching-schedules": "Thời khoá biểu",
  "teaching-sessions": "Tiết dạy",
  subjects: "Môn học",
  "subject-catalogs": "Danh mục môn",
  "subject-merge": "Gộp môn học",
  "school-year-rollover": "Chuyển năm học",
  "fuel-allowance-tiers": "Phụ cấp xăng",
  schools: "Trường",
  "school-locations": "Vị trí trường",
  "school-branches": "Điểm trường",
  "timetable-import": "Nhập thời khoá biểu",
  departments: "Phòng ban",
};

export const resourceLabel = (resource: string) =>
  RESOURCE_LABELS[resource] ?? resource;

export const ROLE_LABELS: Record<string, string> = {
  nhansu: "Nhân sự",
  giaovu: "Giáo vụ",
  giaovien_congty: "Giáo viên công ty",
  giaovien_ctv: "Giáo viên CTV",
  director: "Giám đốc",
  director_la: "Giám đốc LA",
  troly_gd: "Trợ lý GĐ",
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

/**
 * Luật dịch, xét theo thứ tự — luật cụ thể đặt trước luật chung.
 * `pattern` khớp trên **path đã bỏ tên nhóm dữ liệu** ở đầu, với `:id` là số.
 */
type Rule = {
  method: string;
  /** Phần đuôi của path sau `/<resource>`, `#` đại diện cho một số. */
  tail: string;
  /** `#1`, `#2` = số thứ tự các `#` trong `tail`. */
  text: string;
};

const RULES: Record<string, Rule[]> = {
  teachers: [
    { method: "POST", tail: "", text: "Thêm giáo viên" },
    { method: "PATCH", tail: "/me", text: "Tự sửa hồ sơ giáo viên" },
    { method: "PATCH", tail: "/#", text: "Sửa hồ sơ giáo viên #1" },
    { method: "DELETE", tail: "/#", text: "Xoá giáo viên #1" },
    { method: "PATCH", tail: "/#/reset-password", text: "Đặt lại mật khẩu giáo viên #1" },
    { method: "POST", tail: "/me/location", text: "Gửi vị trí giáo viên" },
    { method: "PATCH", tail: "/location-change-requests/#/approve", text: "Duyệt đổi vị trí giáo viên (đề nghị #1)" },
    { method: "PATCH", tail: "/location-change-requests/#/reject", text: "Từ chối đổi vị trí giáo viên (đề nghị #1)" },
    { method: "PATCH", tail: "/account-requests/#/approve", text: "Duyệt mở tài khoản giáo viên (hồ sơ #1)" },
    { method: "PATCH", tail: "/account-requests/#/reject", text: "Từ chối mở tài khoản giáo viên (hồ sơ #1)" },
    { method: "POST", tail: "/candidates", text: "Tìm giáo viên phù hợp" },
  ],
  employees: [
    { method: "POST", tail: "", text: "Tạo tài khoản nhân viên" },
    { method: "PATCH", tail: "/#", text: "Sửa nhân viên #1" },
    { method: "DELETE", tail: "/#", text: "Xoá nhân viên #1" },
    { method: "PATCH", tail: "/#/change-password", text: "Đổi mật khẩu nhân viên #1" },
    { method: "POST", tail: "/assign-region", text: "Phân vùng phụ trách cho nhân viên" },
    { method: "POST", tail: "/register-face", text: "Đăng ký khuôn mặt" },
  ],
  "school-classes": [
    { method: "POST", tail: "", text: "Thêm lớp học" },
    { method: "PATCH", tail: "/#", text: "Sửa lớp học #1" },
    { method: "DELETE", tail: "/#", text: "Xoá lớp học #1" },
  ],
  "teaching-schedules": [
    { method: "POST", tail: "", text: "Thêm lịch dạy" },
    { method: "POST", tail: "/bulk", text: "Thêm nhiều lịch dạy" },
    { method: "PATCH", tail: "/#", text: "Sửa lịch dạy #1" },
    { method: "DELETE", tail: "/#", text: "Xoá lịch dạy #1" },
    { method: "PATCH", tail: "/#/confirmation", text: "Xác nhận lịch dạy #1" },
    { method: "POST", tail: "/#/generate-sessions", text: "Sinh tiết dạy từ lịch #1" },
  ],
  "teaching-sessions": [
    { method: "POST", tail: "", text: "Thêm tiết dạy" },
    { method: "POST", tail: "/bulk", text: "Thêm nhiều tiết dạy" },
    { method: "PATCH", tail: "/#", text: "Sửa tiết dạy #1" },
    { method: "DELETE", tail: "/#", text: "Xoá tiết dạy #1" },
    { method: "PATCH", tail: "/#/assign", text: "Phân giáo viên cho tiết dạy #1" },
    { method: "PATCH", tail: "/#/confirmation", text: "Xác nhận tiết dạy #1" },
    { method: "POST", tail: "/#/decline", text: "Từ chối tiết dạy #1" },
    { method: "POST", tail: "/#/checkin", text: "Check-in tiết dạy #1" },
    { method: "POST", tail: "/#/checkout", text: "Check-out tiết dạy #1" },
    { method: "POST", tail: "/#/lesson", text: "Nộp báo cáo tiết dạy #1" },
    { method: "POST", tail: "/#/applications", text: "Đăng ký nhận tiết dạy #1" },
    { method: "DELETE", tail: "/#/applications/me", text: "Huỷ đăng ký tiết dạy #1" },
    { method: "PATCH", tail: "/#/attendance", text: "Chấm công tiết dạy #1" },
    { method: "PATCH", tail: "/attendance/bulk", text: "Chấm công hàng loạt" },
    { method: "POST", tail: "/notify-schedule", text: "Gửi thông báo lịch dạy" },
    { method: "POST", tail: "/checkin-alerts/run", text: "Chạy cảnh báo chưa check-in" },
    { method: "POST", tail: "/confirmation-alerts/run", text: "Chạy cảnh báo chưa xác nhận" },
  ],
  subjects: [
    { method: "POST", tail: "", text: "Thêm môn học" },
    { method: "PATCH", tail: "/bulk-rate", text: "Sửa đơn giá hàng loạt" },
    { method: "PUT", tail: "/#", text: "Sửa môn học #1" },
    { method: "DELETE", tail: "/#", text: "Xoá môn học #1" },
  ],
  "fuel-allowance-tiers": [
    { method: "POST", tail: "", text: "Thêm bậc phụ cấp xăng" },
    { method: "PATCH", tail: "/#", text: "Sửa bậc phụ cấp xăng #1" },
    { method: "DELETE", tail: "/#", text: "Xoá bậc phụ cấp xăng #1" },
  ],
};

const GENERIC_VERB: Record<string, string> = {
  POST: "Thêm",
  PATCH: "Sửa",
  PUT: "Sửa",
  DELETE: "Xoá",
};

/** `/teachers/12/reset-password` → `/#/reset-password` (bỏ tên nhóm ở đầu). */
function tailOf(path: string, resource: string): string {
  const rest = path.replace(/\/+$/, "").slice(`/${resource}`.length);
  return rest.replace(/\/\d+/g, "/#");
}

function idsOf(path: string): string[] {
  return path.match(/\/(\d+)/g)?.map((s) => s.slice(1)) ?? [];
}

/**
 * Câu mô tả thao tác. Không khớp luật nào thì ghép "động từ + tên nhóm + id" —
 * vẫn đọc được, và endpoint mới thêm sau này không làm màn hình trống trơn.
 */
export function describeAction(log: ActivityLog): string {
  const tail = tailOf(log.path, log.resource);
  const rule = RULES[log.resource]?.find(
    (r) => r.method === log.method && r.tail === tail,
  );

  if (rule) {
    const ids = idsOf(log.path);
    return rule.text.replace(/#(\d)/g, (_, i) => `#${ids[Number(i) - 1] ?? "?"}`);
  }

  const verb = GENERIC_VERB[log.method] ?? log.method;
  const ids = idsOf(log.path);
  return `${verb} ${resourceLabel(log.resource).toLowerCase()}${
    ids.length ? ` #${ids[0]}` : ""
  }`;
}

/**
 * Tên đối tượng bị tác động, lấy từ body — "Sửa giáo viên #12" mà kèm được
 * "Nguyễn Văn A" thì người đọc khỏi phải mở từng dòng ra tra.
 */
export function subjectName(
  log: ActivityLog,
  references?: ActivityReferenceNames,
): string | null {
  // Tên chốt sẵn từ backend đáng tin hơn body: body chỉ có field vừa sửa,
  // sửa số điện thoại giáo viên thì trong đó không có tên nào cả.
  const ctx = log.context;
  if (ctx) {
    const byResource: Record<string, string | undefined> = {
      teachers: ctx.teacherName,
      employees: ctx.employeeName,
      "school-classes": ctx.className,
      subjects: ctx.subjectName,
      schools: ctx.schoolName,
    };
    const named = byResource[log.resource];
    if (named) return named;
  }

  // Các log cũ không có context. Lấy ID ở cuối path (vd. `/schools/365`) để
  // tiêu đề "Sửa trường #365" cũng có thể hiện tên trường như log mới.
  const id = Number(idsOf(log.path)[0]);
  const namedById =
    log.resource === "schools"
      ? references?.schools?.[id]
      : log.resource === "subjects"
        ? references?.subjects?.[id]
        : log.resource === "teachers"
          ? references?.teachers?.[id]
          : log.resource === "teaching-schedules"
            ? references?.schedules?.[id]?.schoolName
          : undefined;
  if (namedById) return namedById;

  const body = log.body;
  if (!body || typeof body !== "object") return null;

  for (const key of ["name", "fullName", "title", "className", "code"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Nhãn tiếng Việt cho các field hay gặp trong body. */
const FIELD_LABELS: Record<string, string> = {
  name: "Tên",
  fullName: "Họ tên",
  phone: "Số điện thoại",
  email: "Email",
  roles: "Vai trò",
  status: "Trạng thái",
  note: "Ghi chú",
  reason: "Lý do",
  date: "Ngày",
  startTime: "Giờ bắt đầu",
  endTime: "Giờ kết thúc",
  dayOfWeek: "Thứ",
  schoolId: "Trường",
  schoolName: "Trường",
  schoolYear: "Năm học",
  classId: "Lớp",
  className: "Lớp",
  subjectId: "Môn học",
  catalogId: "Môn học",
  subjectName: "Môn học",
  teacherId: "Giáo viên",
  teacherName: "Giáo viên",
  employeeId: "Nhân viên",
  periods: "Số tiết",
  ratePerPeriod: "Đơn giá / tiết",
  defaultRatePerPeriod: "Đơn giá riêng",
  otherCosts: "Phụ cấp khác",
  amount: "Số tiền",
  effectiveFrom: "Áp dụng từ",
  effectiveTo: "Áp dụng đến",
  exceptScheduleId: "Trừ lịch dạy",
  scheduleId: "Lịch dạy",
  schoolLocationId: "Điểm trường",
  isActive: "Đang hoạt động",
  gradeLevel: "Khối",
  studentCount: "Sĩ số",
  homeroomTeacher: "Giáo viên chủ nhiệm",
  maxPeriodsPerWeek: "Tối đa tiết / tuần",
  checkinRadius: "Bán kính check-in",
  address: "Địa chỉ",
  items: "Danh sách",
  sessions: "Các tiết",
  schedules: "Các lịch dạy",
  minDistanceKm: "Từ (km)",
  maxDistanceKm: "Đến (km)",
  googleMapsUrl: "Link bản đồ",
  _files: "Tệp đính kèm",
};

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Chủ nhật",
  "2": "Thứ Hai",
  "3": "Thứ Ba",
  "4": "Thứ Tư",
  "5": "Thứ Năm",
  "6": "Thứ Sáu",
  "7": "Thứ Bảy",
};

/**
 * Vài field cần dịch riêng mới đọc được: `dayOfWeek: 4` là "Thứ Tư", ngày ISO
 * thì đảo về dd/mm/yyyy như mọi màn hình khác trong app.
 */
function formatByField(key: string, value: any): string | null {
  if (key === "dayOfWeek") return WEEKDAY_LABELS[String(value)] ?? String(value);
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value) &&
    ["date", "effectiveFrom", "effectiveTo", "fromDate", "toDate"].includes(key)
  ) {
    return formatDate(value);
  }
  return null;
}

/**
 * Mô tả ngắn một dòng trong mảng: "Thứ Tư · 08:00–08:45 · 1 tiết". Trước đây
 * chỉ hiện "13 dòng" — người đọc biết có 13 dòng nhưng không biết dòng gì.
 */
function describeItem(item: any, references?: ActivityReferenceNames): string {
  if (item === null || item === undefined) return "—";
  if (typeof item !== "object") return String(item);

  const parts = [
    item.dayOfWeek != null ? WEEKDAY_LABELS[String(item.dayOfWeek)] : null,
    item.date ? formatDate(item.date) : null,
    item.schoolName ?? references?.schools?.[Number(item.schoolId)] ?? null,
    item.className ?? item.class?.name ?? null,
    item.subjectName ?? references?.subjects?.[Number(item.subjectId)] ??
      references?.catalogs?.[Number(item.catalogId)] ?? null,
    item.teacherName ?? references?.teachers?.[Number(item.teacherId)] ?? null,
    item.name ?? item.title ?? null,
    [item.startTime, item.endTime]
      .filter(Boolean)
      .map((t: string) => t.slice(0, 5))
      .join("–") || null,
    item.periods != null ? `${item.periods} tiết` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : JSON.stringify(item);
}

/** Mỗi phần tử của mảng thành một dòng đọc được (giới hạn để không tràn màn hình). */
export function itemLines(value: any, references?: ActivityReferenceNames): string[] {
  if (!Array.isArray(value) || !value.length) return [];
  const shown = value.slice(0, 20).map((item) => describeItem(item, references));
  return value.length > 20
    ? [...shown, `… và ${value.length - 20} dòng nữa`]
    : shown;
}

/** Giá trị hiển thị gọn: mảng/đối tượng dài không nhét vừa một dòng bảng. */
export function formatValue(value: any, key = ""): string {
  const special = formatByField(key, value);
  if (special !== null) return special;

  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.every((v) => typeof v !== "object")
      ? value.join(", ")
      : `${value.length} dòng`;
  }
  if (typeof value === "object") {
    if (value._truncated) return "(dữ liệu quá lớn, không lưu chi tiết)";
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Nhật ký mới được backend gửi kèm `context`; các nhật ký cũ chỉ còn ID trong
 * body. Khi đó dùng danh mục đang có để đổi các ID quan trọng thành tên.
 */
export function formatActivityValue(
  value: any,
  key: string,
  references?: ActivityReferenceNames,
): string {
  const collection =
    key === "schoolId"
      ? references?.schools
      : key === "subjectId"
        ? references?.subjects
        : key === "catalogId"
          ? references?.catalogs
        : key === "teacherId"
          ? references?.teachers
          : undefined;
  if (key === "classId") {
    const schoolClass = references?.classes?.[Number(value)];
    if (schoolClass) return schoolClass.name;
  }
  const id = Number(value);

  return collection?.[id] || formatValue(value, key);
}

/** id nào đã được backend dịch thành tên thì bỏ khỏi bảng "Nội dung đã gửi". */
const ID_FIELD_BY_CONTEXT: Record<string, keyof ActivityContext> = {
  schoolId: "schoolName",
  classId: "className",
  subjectId: "subjectName",
  teacherId: "teacherName",
  employeeId: "employeeName",
};

/**
 * Các cặp field/giá trị của body, đã bỏ field rỗng để bảng không loãng và bỏ
 * các id đã hiện thành tên ở phần "Thông tin liên quan" — cùng một thông tin
 * nói hai lần, mà lần thứ hai lại là con số không tra được.
 */
export function bodyEntries(
  body: any,
  ctx?: ActivityContext | null,
  references?: ActivityReferenceNames,
): { key: string; value: any }[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];

  const entries = Object.entries(body)
    .filter(([key, v]) => {
      if (v === null || v === undefined || v === "") return false;
      const named = ID_FIELD_BY_CONTEXT[key];
      return !(named && ctx?.[named]);
    })
    .map(([key, value]) => ({ key, value }));

  // Lịch dạy thường chỉ gửi classId; lớp đã có sẵn trường nên thêm một dòng
  // Trường để người xem không phải tự tra mã lớp.
  const schoolName = references?.classes?.[Number(body.classId)]?.schoolName;
  if (schoolName && !ctx?.schoolName && !body.schoolId) {
    entries.unshift({ key: "schoolName", value: schoolName });
  }
  return entries;
}

/**
 * ===== Bối cảnh: trường / lớp / giáo viên / tiết =====
 *
 * Backend đã chốt sẵn tên tại thời điểm thao tác (`extractContext`), FE chỉ lo
 * trình bày. Không tra lại tên theo id ở đây là cố ý: trường đổi tên hay lớp bị
 * xoá thì nhật ký vẫn phải kể đúng chuyện đã xảy ra lúc đó.
 */

const HHMM = (value?: string) => (value ? value.slice(0, 5) : "");

/** "09/09/2026" — ngày ISO trong log là `YYYY-MM-DD`. */
export function formatDate(value?: string): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/** "07:00–07:45 · 1 tiết" */
export function periodText(ctx?: ActivityContext | null): string {
  if (!ctx) return "";
  const range = [HHMM(ctx.startTime), HHMM(ctx.endTime)].filter(Boolean).join("–");
  const periods = ctx.periods ? `${ctx.periods} tiết` : "";
  return [range, periods].filter(Boolean).join(" · ");
}

/** Các dòng "nhãn: giá trị" của phần bối cảnh, đã bỏ mục trống. */
export function contextRows(
  ctx?: ActivityContext | null,
): { label: string; value: string }[] {
  if (!ctx) return [];

  const rows: { label: string; value: string }[] = [
    { label: "Trường", value: ctx.schoolName ?? "" },
    {
      label: "Lớp",
      value: [ctx.className, ctx.schoolYear].filter(Boolean).join(" · "),
    },
    { label: "Môn học", value: ctx.subjectName ?? "" },
    { label: "Giáo viên", value: ctx.teacherName ?? "" },
    { label: "Nhân viên", value: ctx.employeeName ?? "" },
    {
      label: "Tiết",
      value: [formatDate(ctx.date), periodText(ctx)].filter(Boolean).join(" · "),
    },
    {
      label: "Số bản ghi",
      value: ctx.itemCount ? `${ctx.itemCount} bản ghi` : "",
    },
  ];

  return rows.filter((r) => r.value);
}

/**
 * Tóm tắt một dòng cho danh sách: "THCS Chi Lăng · 6A1 · Nguyễn Văn A ·
 * 09/09/2026 07:00". Cắt bớt các mục trống để câu không có dấu · lủng lẳng.
 */
export function contextSummary(ctx?: ActivityContext | null): string {
  if (!ctx) return "";
  const when = [formatDate(ctx.date), HHMM(ctx.startTime)]
    .filter(Boolean)
    .join(" ");

  return [ctx.schoolName, ctx.className, ctx.subjectName, ctx.teacherName, when]
    .filter(Boolean)
    .join(" · ");
}

/**
 * ===== Dữ liệu cũ / dữ liệu mới =====
 *
 * Backend thường gửi sẵn danh sách field thay đổi. Với log cũ hoặc endpoint
 * chưa tạo danh sách này, FE vẫn có thể đối chiếu hai bản chụp trước/sau.
 */

/** Cột hệ thống — có đổi cũng không nói lên điều gì với người đọc. */
const NOISY_FIELDS = [
  "id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
  "deletedAt",
  "avatarUrl",
  "zaloUid",
  "zaloUserId",
];

const sameValue = (before: any, after: any) =>
  JSON.stringify(before) === JSON.stringify(after);

/**
 * Field đã đổi, đã bỏ cột hệ thống và gắn nhãn tiếng Việt. `beforeData` và
 * `afterData` là phương án dự phòng để mọi thao tác sửa đều có cũ/mới.
 */
export function visibleChanges(
  changes?: FieldChange[] | null,
  beforeData?: Record<string, any> | null,
  afterData?: Record<string, any> | null,
  references?: ActivityReferenceNames,
): { field: string; label: string; before: string; after: string }[] {
  const source = Array.isArray(changes) && changes.length
    ? changes
    : beforeData && afterData
      ? Object.keys({ ...beforeData, ...afterData })
        .filter((field) => !sameValue(beforeData?.[field], afterData?.[field]))
        .map((field) => ({
          field,
          before: beforeData?.[field],
          after: afterData?.[field],
        }))
      : [];

  return source
    .filter((c) => !NOISY_FIELDS.includes(c.field))
    .map((c) => ({
      field: c.field,
      label: fieldLabel(c.field),
      before: formatActivityValue(c.before, c.field, references),
      after: formatActivityValue(c.after, c.field, references),
    }));
}

/** Bản ghi bị xoá — hiện nguyên trạng lúc trước khi xoá. */
export function snapshotRows(
  data?: Record<string, any> | null,
  references?: ActivityReferenceNames,
): { label: string; value: string }[] {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(
      ([key, value]) =>
        !NOISY_FIELDS.includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== "",
    )
    .map(([key, value]) => ({
      label: fieldLabel(key),
      value: formatActivityValue(value, key, references),
    }));
}
