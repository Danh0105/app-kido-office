/**
 * Quyền HR hiệu lực của người đang đăng nhập — lấy từ `GET /api/hr/v1/access/me`.
 *
 * FE chỉ dùng để ẩn menu / tắt nút cho đỡ thao tác sai. Backend luôn kiểm tra
 * lại quyền + phạm vi; KHÔNG kiểm tra tên role (HR_ADMIN…) để quyết định UI.
 *
 * File thuần (không import runtime) để test bằng `node --test`.
 */

export type HrPermissionCode =
  | "EMPLOYEE_VIEW"
  | "EMPLOYEE_EDIT"
  | "IDENTITY_REVEAL"
  | "BANK_REVEAL"
  | "SALARY_VIEW"
  | "FILE_VIEW"
  | "AUDIT_VIEW"
  | "PARAMETER_MANAGE"
  | "HOLIDAY_MANAGE"
  | "ACCESS_VIEW"
  | "ACCESS_ADMIN"
  | "ORG_MANAGE"
  | "DOCUMENT_VIEW"
  | "DOCUMENT_MANAGE"
  | "HEALTH_DOCUMENT_VIEW";

export type HrScope = "SELF" | "TEAM" | "ORG_UNIT" | "BRANCH" | "COMPANY" | "ALL";

export const HR_SCOPES: HrScope[] = ["SELF", "TEAM", "ORG_UNIT", "BRANCH", "COMPANY", "ALL"];
export const HR_SCOPE_LABELS: Record<HrScope, string> = {
  SELF: "Bản thân",
  TEAM: "Nhóm quản lý",
  ORG_UNIT: "Phòng ban",
  BRANCH: "Chi nhánh",
  COMPANY: "Toàn công ty",
  ALL: "Tất cả",
};
const UNRESTRICTED: HrScope[] = ["COMPANY", "ALL"];

export interface HrScopeGrant {
  scope: HrScope;
  scopeRefId: number | null;
  source: string;
  via: string;
}

export interface HrMyAccess {
  accountId: number;
  on: string;
  permissions: { code: string; scopes: HrScopeGrant[] }[];
}

export const HR_PERMISSION_LABELS: Record<HrPermissionCode, string> = {
  EMPLOYEE_VIEW: "Xem hồ sơ nhân viên",
  EMPLOYEE_EDIT: "Sửa hồ sơ nhân viên",
  IDENTITY_REVEAL: "Xem đầy đủ giấy tờ định danh",
  BANK_REVEAL: "Xem đầy đủ số tài khoản",
  SALARY_VIEW: "Xem lương",
  FILE_VIEW: "Xem tài liệu nội bộ",
  AUDIT_VIEW: "Xem nhật ký HR",
  PARAMETER_MANAGE: "Quản lý tham số",
  HOLIDAY_MANAGE: "Quản lý ngày lễ",
  ACCESS_VIEW: "Xem phân quyền HR",
  ACCESS_ADMIN: "Quản trị phân quyền HR",
  ORG_MANAGE: "Quản lý cơ cấu tổ chức",
  DOCUMENT_VIEW: "Xem hồ sơ tài liệu",
  DOCUMENT_MANAGE: "Quản lý hồ sơ tài liệu",
  HEALTH_DOCUMENT_VIEW: "Xem giấy khám sức khỏe",
};

/**
 * Quyền cấp lẻ được qua Access Admin (Phase 1.3). ACCESS_ADMIN không cấp lẻ:
 * quản trị chỉ qua role HR_ADMIN (luật số quản trị tối thiểu) — backend chặn.
 */
export const DIRECT_GRANT_PERMISSIONS = (Object.keys(HR_PERMISSION_LABELS) as HrPermissionCode[]).filter(
  (c) => c !== "ACCESS_ADMIN",
);

export const permissionLabel = (code: string) =>
  HR_PERMISSION_LABELS[code as HrPermissionCode] ?? code;

/** Quyền truy cập dữ liệu nhạy cảm — role chứa một trong số này bị giới hạn 180 ngày (M2). */
export const SENSITIVE_PERMISSIONS: string[] = ["SALARY_VIEW", "IDENTITY_REVEAL", "BANK_REVEAL", "HEALTH_DOCUMENT_VIEW"];
export const MAX_SENSITIVE_ACCESS_DAYS = 180;

const scopesOf = (access: HrMyAccess | null | undefined, code: HrPermissionCode) =>
  access?.permissions.find((p) => p.code === code)?.scopes ?? [];

/** Có quyền ở BẤT KỲ phạm vi nào (backend kiểm tra phạm vi từng đối tượng). */
export function hasPermission(access: HrMyAccess | null | undefined, code: HrPermissionCode): boolean {
  return scopesOf(access, code).length > 0;
}

/** Có quyền ở phạm vi toàn công ty (COMPANY / ALL). */
export function hasUnrestricted(access: HrMyAccess | null | undefined, code: HrPermissionCode): boolean {
  return scopesOf(access, code).some((s) => UNRESTRICTED.includes(s.scope));
}

export function hasAnyHrPermission(access: HrMyAccess | null | undefined): boolean {
  return !!access?.permissions.some((p) => p.scopes.length > 0);
}

export function isSensitiveRole(permissionCodes: string[]): boolean {
  return permissionCodes.some((p) => SENSITIVE_PERMISSIONS.includes(p));
}

export interface HrNavItem {
  key: string;
  title: string;
  path: string;
}

/**
 * Menu con HRM theo quyền. Nhật ký cần AUDIT_VIEW toàn công ty (backend từ
 * chối phạm vi hẹp hơn). "File nhân sự" nằm trong hồ sơ nhân viên — chưa có
 * API danh sách file toàn công ty nên không có menu riêng.
 */
export function hrNavItems(access: HrMyAccess | null | undefined): HrNavItem[] {
  if (!hasAnyHrPermission(access)) return [];
  const items: HrNavItem[] = [{ key: "overview", title: "Tổng quan", path: "/hr" }];
  if (hasPermission(access, "EMPLOYEE_VIEW"))
    items.push({ key: "employees", title: "Hồ sơ nhân viên", path: "/hr/employees" });
  if (hasPermission(access, "EMPLOYEE_VIEW") || hasPermission(access, "ORG_MANAGE"))
    items.push({ key: "org", title: "Tổ chức", path: "/hr/org" });
  if (hasPermission(access, "ACCESS_VIEW") || hasPermission(access, "ACCESS_ADMIN"))
    items.push({ key: "access", title: "Phân quyền", path: "/hr/access" });
  if (hasUnrestricted(access, "AUDIT_VIEW"))
    items.push({ key: "audit", title: "Nhật ký", path: "/hr/audit" });
  if (hasPermission(access, "ACCESS_VIEW"))
    items.push({ key: "settings", title: "Cấu hình HR", path: "/hr/settings" });
  return items;
}

// ─── Ngày (theo giờ Việt Nam, dạng YYYY-MM-DD — giống backend) ──────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "Hôm nay" theo Asia/Ho_Chi_Minh — không dùng giờ máy người dùng. */
export function vnToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Cộng ngày trên lịch UTC thuần (không lệch múi giờ). */
export function addDays(iso: string, days: number): string {
  if (!ISO.test(iso)) throw new Error("Ngày không hợp lệ");
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Ngày hết hạn muộn nhất cho quyền nhạy cảm: 180 ngày tính cả hai đầu. */
export function latestSensitiveEffectiveTo(from: string): string {
  return addDays(from, MAX_SENSITIVE_ACCESS_DAYS - 1);
}

/** `2026-12-15` → `15/12/2026`; timestamp ISO → ngày giờ Việt Nam. */
export function formatVnDate(value: string | null | undefined): string {
  if (!value) return "—";
  if (ISO.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export type HrAssignmentStatus = "ACTIVE" | "UPCOMING" | "EXPIRED" | "REVOKED";

export function assignmentStatus(
  a: { revokedAt: string | null; effectiveFrom: string; effectiveTo: string | null },
  today: string,
): HrAssignmentStatus {
  if (a.revokedAt) return "REVOKED";
  if (a.effectiveFrom > today) return "UPCOMING";
  if (a.effectiveTo !== null && a.effectiveTo < today) return "EXPIRED";
  return "ACTIVE";
}

/** Quyết định hiển thị nút / thao tác — MỘT nơi, component chỉ đọc kết quả. */
export function hrCapabilities(access: HrMyAccess | null | undefined) {
  return {
    canGrantRoles: hasPermission(access, "ACCESS_ADMIN"),
    canViewAccess: hasPermission(access, "ACCESS_VIEW"),
    canViewEmployees: hasPermission(access, "EMPLOYEE_VIEW"),
    canEditEmployees: hasPermission(access, "EMPLOYEE_EDIT"),
    /** Tạo hồ sơ: backend chỉ cho quyền sửa ở phạm vi toàn công ty. */
    canCreateEmployees: hasUnrestricted(access, "EMPLOYEE_EDIT"),
    canRevealIdentity: hasPermission(access, "IDENTITY_REVEAL"),
    canRevealBank: hasPermission(access, "BANK_REVEAL"),
    /** MST / BHXH: backend chưa có quyền reveal riêng → luôn false. */
    canRevealTax: false,
    canRevealInsurance: false,
    canViewAudit: hasUnrestricted(access, "AUDIT_VIEW"),
    canViewOrg: hasPermission(access, "EMPLOYEE_VIEW") || hasPermission(access, "ORG_MANAGE"),
    /** Có ORG_MANAGE ở phạm vi nào đó — backend kiểm tra phạm vi từng đơn vị. */
    canManageOrg: hasPermission(access, "ORG_MANAGE"),
    /** Danh mục chức danh / mapping dùng chung: chỉ ORG_MANAGE toàn công ty. */
    canManageOrgCatalog: hasUnrestricted(access, "ORG_MANAGE"),
    /** Phase 1.3 — hồ sơ tài liệu (backend kiểm tra phạm vi nhân viên). */
    canViewDocuments: hasPermission(access, "DOCUMENT_VIEW"),
    canManageDocuments: hasPermission(access, "DOCUMENT_MANAGE"),
  };
}

export const MIN_REASON_LENGTH = 5;
export const isValidReason = (reason: string) => reason.trim().length >= MIN_REASON_LENGTH;
