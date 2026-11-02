/**
 * Hồ sơ nhân viên cơ bản (Phase 1.2.3) — nhãn, kiểm tra form, tạo patch.
 * Backend là nơi kiểm tra cuối; ở đây chỉ để báo lỗi sớm cho người dùng.
 * Không enum / parameter property (test chạy bằng node strip-types).
 */

export type HrAttendanceMode = "SHIFT" | "TEACHING_SESSION" | "UNASSIGNED";
export type HrGender = "MALE" | "FEMALE" | "OTHER";
export type HrDuplicateWarning = "DUPLICATE_PHONE" | "DUPLICATE_EMAIL";

export const ATTENDANCE_MODE_LABELS: Record<HrAttendanceMode, string> = {
  SHIFT: "Theo ca (văn phòng)",
  TEACHING_SESSION: "Theo tiết dạy (giáo viên)",
  UNASSIGNED: "Chưa phân loại",
};
export const ATTENDANCE_MODES = Object.keys(ATTENDANCE_MODE_LABELS) as HrAttendanceMode[];

export const GENDER_LABELS: Record<HrGender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};
export const GENDERS = Object.keys(GENDER_LABELS) as HrGender[];

export const DUPLICATE_WARNING_LABELS: Record<HrDuplicateWarning, string> = {
  DUPLICATE_PHONE: "Số điện thoại này đã có ở hồ sơ khác.",
  DUPLICATE_EMAIL: "Email này đã có ở hồ sơ khác.",
};

/** Thời gian chờ trước khi gọi API tìm kiếm (ms). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Giống backend: chỉ bỏ khoảng trắng, dấu chấm, dấu gạch nối. */
export const normalizePhoneInput = (value: string) => value.replace(/[\s.-]/g, "");
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProfileForm {
  fullName: string;
  attendanceMode: HrAttendanceMode;
  dateOfBirth: string;
  gender: HrGender | "";
  phone: string;
  workEmail: string;
  personalEmail: string;
}

export interface ProfileSource {
  fullName: string;
  attendanceMode: HrAttendanceMode;
  dateOfBirth: string | null;
  gender: HrGender | null;
  phone: string | null;
  workEmail: string | null;
  personalEmail: string | null;
}

export const emptyProfileForm = (): ProfileForm => ({
  fullName: "",
  attendanceMode: "UNASSIGNED",
  dateOfBirth: "",
  gender: "",
  phone: "",
  workEmail: "",
  personalEmail: "",
});

export const profileFormFrom = (e: ProfileSource): ProfileForm => ({
  fullName: e.fullName,
  attendanceMode: e.attendanceMode,
  dateOfBirth: e.dateOfBirth ?? "",
  gender: e.gender ?? "",
  phone: e.phone ?? "",
  workEmail: e.workEmail ?? "",
  personalEmail: e.personalEmail ?? "",
});

/** Lỗi phát hiện sớm (câu tiếng Việt). Rỗng = gửi được. */
export function profileProblems(form: ProfileForm, today: string): string[] {
  const out: string[] = [];
  if (!form.fullName.trim()) out.push("Nhập họ tên.");
  if (form.dateOfBirth && (form.dateOfBirth > today || form.dateOfBirth < "1900-01-01"))
    out.push("Ngày sinh phải từ 01/01/1900 đến hôm nay.");
  const phone = normalizePhoneInput(form.phone);
  if (phone && !PHONE_PATTERN.test(phone))
    out.push("Số điện thoại gồm 8–15 chữ số, có thể bắt đầu bằng +.");
  if (form.workEmail.trim() && !EMAIL_PATTERN.test(form.workEmail.trim()))
    out.push("Email công việc không hợp lệ.");
  if (form.personalEmail.trim() && !EMAIL_PATTERN.test(form.personalEmail.trim()))
    out.push("Email cá nhân không hợp lệ.");
  return out;
}

export interface ProfileBody {
  fullName?: string;
  attendanceMode?: HrAttendanceMode;
  dateOfBirth?: string | null;
  gender?: HrGender | null;
  phone?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
}

/** Giá trị form → dạng gửi API (chuỗi rỗng = null). */
function formValues(form: ProfileForm): Required<ProfileBody> {
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  const phone = normalizePhoneInput(form.phone);
  return {
    fullName: form.fullName.trim(),
    attendanceMode: form.attendanceMode,
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender || null,
    phone: phone || null,
    workEmail: orNull(form.workEmail)?.toLowerCase() ?? null,
    personalEmail: orNull(form.personalEmail)?.toLowerCase() ?? null,
  };
}

/** Body tạo hồ sơ: bỏ trường trống (không gửi null khi tạo). */
export function createBody(form: ProfileForm): ProfileBody {
  const v = formValues(form);
  const body: ProfileBody = { fullName: v.fullName, attendanceMode: v.attendanceMode };
  for (const k of ["dateOfBirth", "gender", "phone", "workEmail", "personalEmail"] as const)
    if (v[k] !== null) (body as Record<string, unknown>)[k] = v[k];
  return body;
}

/** Patch sửa hồ sơ: CHỈ trường đã đổi so với bản gốc (null = xoá giá trị). */
export function profilePatch(original: ProfileSource, form: ProfileForm): ProfileBody {
  const v = formValues(form);
  const patch: ProfileBody = {};
  for (const k of Object.keys(v) as (keyof ProfileBody)[])
    if (v[k] !== (original[k] ?? null)) (patch as Record<string, unknown>)[k] = v[k];
  return patch;
}
