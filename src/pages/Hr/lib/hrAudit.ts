/** Nhãn tiếng Việt cho audit HR + tóm tắt giá trị (thuần, để test). */

export const HR_AUDIT_ACTION_LABELS: Record<string, string> = {
  ACCESS_GRANT: "Cấp quyền HR",
  ACCESS_REVOKE: "Thu hồi quyền HR",
  HR_ROLE_REMOVE: "Gỡ role HR khỏi hệ thống",
  ACCOUNT_DEACTIVATE: "Khoá/xoá tài khoản quản trị HR",
  EMPLOYEE_CREATE: "Tạo hồ sơ nhân viên",
  EMPLOYEE_UPDATE: "Sửa hồ sơ nhân viên",
  EMPLOYEE_IMPORT: "Nhập hồ sơ nhân viên từ file",
  IDENTITY_CREATE: "Thêm giấy tờ định danh",
  IDENTITY_UPDATE: "Cập nhật giấy tờ định danh",
  IDENTITY_REVEAL: "Xem số giấy tờ đầy đủ",
  BANK_ACCOUNT_CREATE: "Thêm tài khoản ngân hàng",
  BANK_ACCOUNT_UPDATE: "Cập nhật tài khoản ngân hàng",
  BANK_REVEAL: "Xem số tài khoản đầy đủ",
  TAX_PROFILE_CREATE: "Thêm mã số thuế",
  TAX_PROFILE_UPDATE: "Cập nhật mã số thuế",
  INSURANCE_PROFILE_CREATE: "Thêm mã số BHXH",
  INSURANCE_PROFILE_UPDATE: "Cập nhật mã số BHXH",
  DOCUMENT_CREATE: "Tạo hồ sơ tài liệu",
  DOCUMENT_UPDATE: "Sửa thông tin tài liệu",
  DOCUMENT_VERSION_ADD: "Thêm phiên bản tài liệu",
  DOCUMENT_ARCHIVE: "Lưu trữ hồ sơ tài liệu",
  FILE_UPLOAD: "Tải lên tài liệu",
  FILE_ACCESS: "Xin quyền truy cập tài liệu",
  FILE_DOWNLOAD: "Tải tài liệu",
  FILE_ARCHIVE: "Lưu trữ tài liệu",
  FILE_DELETE: "Xoá tài liệu",
  PARAMETER_CREATE: "Tạo tham số",
  PARAMETER_CLOSE: "Đóng tham số",
  HOLIDAY_CREATE: "Thêm ngày lễ",
  HOLIDAY_UPDATE: "Sửa ngày lễ",
  HOLIDAY_DELETE: "Xoá ngày lễ",
};

export const HR_AUDIT_ENTITY_LABELS: Record<string, string> = {
  account_role_assignment: "Cấp quyền HR",
  account_permission_grant: "Quyền lẻ",
  hr_role: "Role HR",
  account: "Tài khoản",
  employee: "Hồ sơ nhân viên",
  employee_identity_document: "Giấy tờ định danh",
  employee_bank_account: "Tài khoản ngân hàng",
  employee_tax_profile: "Mã số thuế",
  employee_insurance_profile: "BHXH",
  hr_file: "Tài liệu",
  employee_document: "Hồ sơ tài liệu",
};

export const auditActionLabel = (action: string) => HR_AUDIT_ACTION_LABELS[action] ?? action;
export const auditEntityLabel = (entity: string) => HR_AUDIT_ENTITY_LABELS[entity] ?? entity;

/** Ciphertext / blind index / token không bao giờ được hiển thị (backend đã che — chặn thêm lớp nữa). */
const HIDDEN_VALUE = /^(hrenc|hbi):\d+:|token=/i;
const HIDDEN_KEYS = /token|secret|password|hash|encrypted|storage_?key/i;

/** Phẳng hoá `oldValue`/`newValue` thành các dòng `khoá: giá trị` ngắn gọn. */
export function summarizeAuditValue(value: unknown, depth = 0): string[] {
  if (value === null || value === undefined) return [];
  if (depth > 2) return ["…"];
  if (typeof value !== "object") {
    const text = String(value);
    return [HIDDEN_VALUE.test(text) ? "[ẩn]" : text];
  }
  if (Array.isArray(value)) {
    return [value.map((v) => summarizeAuditValue(v, depth + 1).join(", ")).join("; ")];
  }
  const lines: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (HIDDEN_KEYS.test(k)) {
      lines.push(`${k}: [ẩn]`);
      continue;
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const inner of summarizeAuditValue(v, depth + 1)) lines.push(`${k}.${inner}`);
    } else {
      lines.push(`${k}: ${summarizeAuditValue(v, depth + 1).join("") || "—"}`);
    }
  }
  return lines;
}

/** `employeeId` trong audit (nếu có) để hiển thị cột Nhân viên. */
export function auditEmployeeId(entry: { entity: string; entityId: string | null; newValue: unknown; oldValue: unknown }) {
  if (entry.entity === "employee") return entry.entityId;
  const pick = (v: unknown) =>
    v && typeof v === "object" && "employeeId" in (v as object) ? String((v as { employeeId: unknown }).employeeId) : null;
  return pick(entry.newValue) ?? pick(entry.oldValue);
}
