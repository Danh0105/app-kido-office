import { hasRole } from "@/utils/auth";

/**
 * Vai trò được vào màn Máy chấm công. Phải khớp ADMIN_ROLES / VIEW_ROLES trên máy chủ
 * chấm công (hik-attendance); menu và route guard dùng chung các hằng số này.
 * Máy chủ mới là nơi quyết định quyền thật — kế toán chỉ xem (không ảnh, không sửa).
 */
export const ATTENDANCE_ADMIN_ROLES = ["nhansu", "director", "director_la"];
export const ATTENDANCE_VIEW_ROLES = ["accountant", "ketoan_truong", "ketoan_congno"];
export const ATTENDANCE_ROLES = [...ATTENDANCE_ADMIN_ROLES, ...ATTENDANCE_VIEW_ROLES];

export const canViewAttendance = (): boolean => hasRole(...ATTENDANCE_ROLES);

const TZ = "Asia/Ho_Chi_Minh";

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const todayVN = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const fmtTime = (iso?: string | null, seconds = false): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(iso));
};

export const fmtDateTime = (iso?: string | null): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
};

export const fmtDay = (ymd: string): string => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

export const timeAgo = (iso?: string | null): string => {
  if (!iso) return "chưa từng";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "vừa xong";
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`;
  return `${Math.floor(sec / 86400)} ngày trước`;
};

export const METHOD_LABEL: Record<string, string> = {
  fingerprint: "Vân tay",
  face: "Khuôn mặt",
  card: "Thẻ",
};

export const methodLabel = (method?: string | null): string =>
  (method && METHOD_LABEL[method]) || method || "Khác";

/** Tải file từ Blob (bản web). */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Bỏ dấu tiếng Việt + chữ thường, dùng cho ô tìm kiếm. */
export const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
