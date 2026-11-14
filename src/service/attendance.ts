import axios from "axios";

/**
 * API máy chấm công (dịch vụ hik-attendance, máy chủ riêng).
 * Mặc định https://chamcong.kidoedu.vn; đặt VITE_ATTENDANCE_API_URL khi build để trỏ chỗ khác.
 * Đăng nhập dùng chung token Kido Office: máy chủ chấm công tự hỏi lại backend Kido
 * xem token còn hiệu lực không, nên không có màn đăng nhập riêng.
 */
const DEFAULT_ATTENDANCE_API_URL = "https://chamcong.kidoedu.vn";
const baseURL = (import.meta.env.VITE_ATTENDANCE_API_URL || DEFAULT_ATTENDANCE_API_URL).replace(/\/+$/, "");

export const attendanceConfigured = Boolean(baseURL);

const http = axios.create({
  baseURL: baseURL ? `${baseURL}/api` : undefined,
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Cố ý KHÔNG tự đăng xuất khi API chấm công trả 401: sự cố ở máy chủ chấm công
// không được làm văng người dùng khỏi toàn bộ Kido Office. Màn hình tự báo lỗi.

export type AttendanceAccess = "admin" | "view";

export type AttendanceMe = {
  name: string | null;
  roles: string[];
  access: AttendanceAccess;
};

export type AttendanceEmployee = {
  id: number;
  employee_no: string;
  full_name: string;
  department: string | null;
  shift_code: string | null;
  status: "active" | "inactive";
  status_label: string;
};

export type TodayRow = AttendanceEmployee & {
  first_in: string | null;
  last_out: string | null;
  punch_count: number;
};

export type TodayResponse = {
  date: string;
  generated_at: string;
  summary: {
    employees: number;
    present: number;
    absent_so_far: number;
    unmatched_codes: number;
  };
  departments: string[];
  rows: TodayRow[];
  unmatched: { employee_no: string; count: number; last: string | null }[];
};

export type Punch = {
  id: number;
  time: string;
  employee_no: string;
  full_name: string | null;
  department: string | null;
  matched: boolean;
  method: string | null;
  kind: "punch" | "unclassified";
  has_image: boolean;
};

export type AttendanceDevice = {
  id: number;
  name: string;
  enabled: boolean;
  online: boolean;
  last_seen_at: string | null;
};

export type DevicesResponse = {
  devices: AttendanceDevice[];
  clock_drift: {
    samples: number;
    median_seconds: number | null;
    max_seconds: number | null;
    warn: boolean;
  };
};

export type UnmatchedItem = {
  employee_no: string;
  count: number;
  first: string | null;
  last: string | null;
};

export type EmployeeInput = {
  employee_no: string;
  full_name: string;
  department?: string | null;
  shift_code?: string | null;
  status: "active" | "inactive";
};

export type EmployeeUpdate = Partial<Omit<EmployeeInput, "employee_no">>;

export type ImportResult = {
  applied: boolean;
  errors: string[];
  warnings: string[];
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  rematched: number;
};

export const attendanceApi = {
  me: () => http.get<AttendanceMe>("/me").then((r) => r.data),

  devices: () => http.get<DevicesResponse>("/devices").then((r) => r.data),

  today: (date: string, department?: string) =>
    http
      .get<TodayResponse>("/today", {
        params: { date, department: department || undefined },
      })
      .then((r) => r.data),

  punches: (date: string, employeeNo?: string) =>
    http
      .get<{ date: string; punches: Punch[] }>("/punches", {
        params: { date, employee_no: employeeNo || undefined },
      })
      .then((r) => r.data),

  punchImage: (id: number) =>
    http
      .get<Blob>(`/punches/${id}/image`, { responseType: "blob" })
      .then((r) => r.data),

  unmatched: () =>
    http.get<{ unmatched: UnmatchedItem[] }>("/unmatched").then((r) => r.data),

  employees: (params: { status?: string; q?: string; department?: string }) =>
    http
      .get<{ employees: AttendanceEmployee[] }>("/employees", {
        params: {
          status: params.status || "active",
          q: params.q?.trim() || undefined,
          department: params.department || undefined,
        },
      })
      .then((r) => r.data),

  createEmployee: (body: EmployeeInput) =>
    http.post<AttendanceEmployee>("/employees", body).then((r) => r.data),

  updateEmployee: (id: number, body: EmployeeUpdate) =>
    http.put<AttendanceEmployee>(`/employees/${id}`, body).then((r) => r.data),

  template: () =>
    http
      .get<Blob>("/employees/template", { responseType: "blob" })
      .then((r) => r.data),

  importEmployees: (file: File, apply: boolean) =>
    http
      .post<ImportResult>("/employees/import", file, {
        params: { apply },
        headers: { "Content-Type": "application/octet-stream" },
      })
      .then((r) => r.data),
};

/** Lấy thông điệp lỗi tiếng Việt từ phản hồi FastAPI ({detail: "..."} hoặc danh sách lỗi). */
export const attendanceError = (
  error: unknown,
  fallback = "Không tải được dữ liệu chấm công."
): string => {
  const res = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (!res) {
    return attendanceConfigured
      ? "Không kết nối được máy chủ chấm công. Kiểm tra mạng rồi thử lại."
      : "Chưa cấu hình địa chỉ máy chủ chấm công (VITE_ATTENDANCE_API_URL).";
  }
  const detail = (res.data as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return "Dữ liệu chưa hợp lệ, kiểm tra lại các ô đã nhập.";
  }
  if (res.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (res.status === 403) return "Bạn không có quyền dùng chức năng này.";
  return fallback;
};

export const attendanceStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;
