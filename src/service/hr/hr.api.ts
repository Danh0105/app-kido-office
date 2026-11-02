import type { HrMyAccess, HrScope } from "@/pages/Hr/lib/hrAccess";
import type { HrAttendanceMode, HrDuplicateWarning, HrGender, ProfileBody } from "@/pages/Hr/lib/hrEmployeeProfile";
import type { ScopeOption, ScopeOptionType } from "@/pages/Hr/lib/hrScopeUnits";
import type {
  HrFileClassification,
  HrFileDocumentType,
  HrFileScanStatus,
} from "@/pages/Hr/lib/hrFiles";
import type { DocumentMetadataBody, HrDocumentType, HrExpiryStatus } from "@/pages/Hr/lib/hrDocuments";
import { hrClient } from "./hrClient";

const BASE = "/api/hr/v1";

// ─── Kiểu dữ liệu (khớp response backend Phase 0) ─────────────────────

export interface HrRole {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface HrAssignment {
  id: number;
  accountId: number;
  roleCode: string;
  scope: HrScope;
  scopeRefId: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  grantedBy: number | null;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
  revokeReason: string | null;
  version: number;
  active: boolean;
}

export interface HrAdminStatus {
  on: string;
  minimum: number;
  protectedAdminCount: number;
  protectedAdminAccountIds: number[];
  temporaryAdminAccountIds: number[];
  healthy: boolean;
}

export interface HrCryptoStatus {
  status: "AVAILABLE" | "UNAVAILABLE";
  encryptionKeyringReady: boolean;
  hmacKeyringReady: boolean;
  activeEncryptionVersion: string | null;
  activeHmacVersion: string | null;
}

/**
 * Hồ sơ nhân viên. `status` là trạng thái HỒ SƠ (không phải trạng thái việc
 * làm — Phase 1.4). Danh sách (`list`) không trả ngày sinh, giới tính, email
 * cá nhân: các trường đó chỉ có ở chi tiết (`get`).
 */
export interface HrEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  accountId: number | null;
  status: "ACTIVE" | "INACTIVE";
  attendanceMode: HrAttendanceMode;
  dateOfBirth?: string | null;
  gender?: HrGender | null;
  phone: string | null;
  workEmail: string | null;
  personalEmail?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Tạo/sửa trả kèm cảnh báo trùng SĐT/email (không chặn, không lộ hồ sơ trùng). */
export type HrEmployeeWriteResult = HrEmployee & { warnings: HrDuplicateWarning[] };

export interface HrEmployeeListQuery {
  page?: number;
  limit?: number;
  /** Mã NV (tiền tố), họ tên (không dấu), SĐT, email. */
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
  attendanceMode?: HrAttendanceMode;
}

export interface HrPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type HrIdentityDocumentType = "CCCD" | "CMND" | "PASSPORT" | "WORK_PERMIT";

export interface HrIdentityDocument {
  id: number;
  employeeId: number;
  documentType: HrIdentityDocumentType;
  numberMasked: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  issuedPlace: string | null;
  version: number;
  updatedAt: string;
}

export interface HrBankAccount {
  id: number;
  employeeId: number;
  bankCode: string;
  bankName: string;
  branchName: string | null;
  accountHolderName: string;
  accountNumberMasked: string | null;
  version: number;
  updatedAt: string;
}

export interface HrTaxProfile {
  id: number;
  employeeId: number;
  taxNumberMasked: string | null;
  version: number;
  updatedAt: string;
}

export interface HrInsuranceProfile {
  id: number;
  employeeId: number;
  socialInsuranceNumberMasked: string | null;
  version: number;
  updatedAt: string;
}

export interface HrFileItem {
  id: number;
  employeeId: number;
  documentType: HrFileDocumentType;
  classification: HrFileClassification;
  identityDocumentId: number | null;
  mimeType: string;
  sizeBytes: number;
  scanStatus: HrFileScanStatus;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  /** null khi người xem không có quyền xem nội dung loại tài liệu này. */
  originalName: string | null;
  version: number;
  createdAt: string;
}

export interface HrAuditLogItem {
  id: string;
  occurredAt: string;
  actorAccountId: number | null;
  actorName: string | null;
  actorRoles: string[];
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface HrAuditQuery {
  entity?: string;
  entityId?: string;
  actorAccountId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AssignHrRoleBody {
  roleCode: string;
  scope: HrScope;
  scopeRefId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  reason: string;
}

/** Quyền lẻ (Phase 1.3) — cùng M1/M2/audit với cấp role. */
export interface HrPermissionGrant {
  id: number;
  accountId: number;
  permissionCode: string;
  scope: HrScope;
  scopeRefId: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  grantedBy: number | null;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
  revokeReason: string | null;
  version: number;
  sensitive: boolean;
  active: boolean;
}

export interface LegacyAccount {
  id: number;
  name?: string | null;
  email?: string | null;
  isActive?: boolean;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ─── Phân quyền ────────────────────────────────────────────────────────

export const hrAccessApi = {
  me: () => data<HrMyAccess>(hrClient.get(`${BASE}/access/me`)),
  roles: () => data<HrRole[]>(hrClient.get(`${BASE}/access/roles`)),
  rolePermissions: (code: string) =>
    data<{ role: HrRole; permissions: string[] }>(
      hrClient.get(`${BASE}/access/roles/${encodeURIComponent(code)}/permissions`),
    ),
  adminStatus: () => data<HrAdminStatus>(hrClient.get(`${BASE}/access/admin-status`)),
  accountAssignments: (accountId: number) =>
    data<{ accountId: number; on: string; assignments: HrAssignment[] }>(
      hrClient.get(`${BASE}/access/accounts/${accountId}/role-assignments`),
    ),
  assign: (accountId: number, body: AssignHrRoleBody) =>
    data<HrAssignment>(hrClient.post(`${BASE}/access/accounts/${accountId}/role-assignments`, body)),
  revoke: (assignmentId: number, body: { reason: string; version: number }) =>
    data<unknown>(hrClient.post(`${BASE}/access/role-assignments/${assignmentId}/revoke`, body)),
  permissionGrants: (accountId: number) =>
    data<{ accountId: number; on: string; grants: HrPermissionGrant[] }>(
      hrClient.get(`${BASE}/access/accounts/${accountId}/permission-grants`),
    ),
  grantPermission: (accountId: number, body: Omit<AssignHrRoleBody, "roleCode"> & { permissionCode: string }) =>
    data<HrPermissionGrant>(hrClient.post(`${BASE}/access/accounts/${accountId}/permission-grants`, body)),
  revokePermissionGrant: (grantId: number, body: { reason: string; version: number }) =>
    data<HrPermissionGrant>(hrClient.post(`${BASE}/access/permission-grants/${grantId}/revoke`, body)),
  /** Danh sách tài khoản (API cũ `GET /employees`) — chỉ để chọn người. */
  accounts: () => data<LegacyAccount[]>(hrClient.get(`/employees`)),
};

export const hrSystemApi = {
  cryptoStatus: () => data<HrCryptoStatus>(hrClient.get(`${BASE}/crypto/status`)),
};

export const hrAuditApi = {
  list: (query: HrAuditQuery) =>
    data<{ items: HrAuditLogItem[]; total: number; page: number; limit: number }>(
      hrClient.get(`${BASE}/audit-logs`, { params: query }),
    ),
};

// ─── Nhân viên + dữ liệu nhạy cảm ──────────────────────────────────────

const emp = (id: number) => `${BASE}/employees/${id}`;

export const hrEmployeeApi = {
  /** Tìm kiếm phía server, theo phạm vi EMPLOYEE_VIEW. Tham số rỗng không gửi. */
  list: (query: HrEmployeeListQuery = {}) =>
    data<HrPage<HrEmployee>>(
      hrClient.get(`${BASE}/employees`, {
        params: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== "")),
      }),
    ),
  get: (id: number) => data<HrEmployee>(hrClient.get(emp(id))),
  /** Mã nhân viên do backend sinh (NV + 6 số) — không gửi employeeCode. */
  create: (body: ProfileBody & { fullName: string; accountId?: number }) =>
    data<HrEmployeeWriteResult>(hrClient.post(`${BASE}/employees`, body)),
  /** Chỉ gửi trường đã đổi + `version`. Không sửa mã NV / tài khoản liên kết. */
  update: (id: number, body: ProfileBody & { version: number }) =>
    data<HrEmployeeWriteResult>(hrClient.patch(emp(id), body)),

  identityDocuments: (id: number) =>
    data<HrIdentityDocument[]>(hrClient.get(`${emp(id)}/identity-documents`)),
  createIdentityDocument: (
    id: number,
    body: {
      documentType: HrIdentityDocumentType;
      number: string;
      issuedOn?: string | null;
      expiresOn?: string | null;
      issuedPlace?: string | null;
    },
  ) => data<HrIdentityDocument>(hrClient.post(`${emp(id)}/identity-documents`, body)),
  updateIdentityDocument: (
    id: number,
    docId: number,
    body: {
      version: number;
      number?: string;
      issuedOn?: string | null;
      expiresOn?: string | null;
      issuedPlace?: string | null;
    },
  ) => data<HrIdentityDocument>(hrClient.patch(`${emp(id)}/identity-documents/${docId}`, body)),
  /** Giá trị đầy đủ — gọi trực tiếp, KHÔNG qua react-query (không cache). */
  revealIdentityDocument: (id: number, docId: number, reason: string) =>
    data<{ id: number; documentType: string; number: string }>(
      hrClient.post(`${emp(id)}/identity-documents/${docId}/reveal`, { reason }),
    ),

  bankAccount: (id: number) => data<HrBankAccount>(hrClient.get(`${emp(id)}/bank-account`)),
  createBankAccount: (
    id: number,
    body: {
      bankCode: string;
      bankName: string;
      branchName?: string | null;
      accountHolderName: string;
      accountNumber: string;
    },
  ) => data<HrBankAccount>(hrClient.post(`${emp(id)}/bank-account`, body)),
  updateBankAccount: (
    id: number,
    body: {
      version: number;
      bankCode?: string;
      bankName?: string;
      branchName?: string | null;
      accountHolderName?: string;
      accountNumber?: string;
    },
  ) => data<HrBankAccount>(hrClient.patch(`${emp(id)}/bank-account`, body)),
  revealBankAccount: (id: number, reason: string) =>
    data<{ id: number; bankCode: string; accountNumber: string }>(
      hrClient.post(`${emp(id)}/bank-account/reveal`, { reason }),
    ),

  taxProfile: (id: number) => data<HrTaxProfile>(hrClient.get(`${emp(id)}/tax-profile`)),
  saveTaxProfile: (id: number, taxNumber: string, version?: number) =>
    data<HrTaxProfile>(
      version === undefined
        ? hrClient.post(`${emp(id)}/tax-profile`, { taxNumber })
        : hrClient.patch(`${emp(id)}/tax-profile`, { taxNumber, version }),
    ),
  insuranceProfile: (id: number) =>
    data<HrInsuranceProfile>(hrClient.get(`${emp(id)}/insurance-profile`)),
  saveInsuranceProfile: (id: number, socialInsuranceNumber: string, version?: number) =>
    data<HrInsuranceProfile>(
      version === undefined
        ? hrClient.post(`${emp(id)}/insurance-profile`, { socialInsuranceNumber })
        : hrClient.patch(`${emp(id)}/insurance-profile`, { socialInsuranceNumber, version }),
    ),
};

// ─── Tài liệu riêng tư ─────────────────────────────────────────────────

export const hrFileApi = {
  list: (employeeId: number) => data<HrFileItem[]>(hrClient.get(`${emp(employeeId)}/files`)),
  upload: (
    employeeId: number,
    file: File,
    documentType: HrFileDocumentType,
    identityDocumentId: number | undefined,
    onProgress?: (percent: number) => void,
  ) => {
    const form = new FormData();
    form.append("documentType", documentType);
    if (identityDocumentId !== undefined) form.append("identityDocumentId", String(identityDocumentId));
    form.append("file", file);
    return data<HrFileItem>(
      hrClient.post(`${emp(employeeId)}/files`, form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      }),
    );
  },
  /** Xin quyền truy cập nội dung → URL/token 5 phút. Không cache, không lưu. */
  requestAccess: (fileId: number, reason?: string) =>
    data<{ fileId: number; url: string; expiresAt: string; ttlSeconds: number }>(
      hrClient.post(`${BASE}/files/${fileId}/access`, reason ? { reason } : {}),
    ),
  /**
   * SECURITY TODO: Move file token from query string to header before production rollout.
   * Backend hiện nhận token qua `?token=` (có thể lọt access log của proxy trong 5 phút).
   */
  downloadBlob: (accessUrl: string) =>
    data<Blob>(hrClient.get(accessUrl, { responseType: "blob" })),
  archive: (fileId: number, version: number, reason: string) =>
    data<{ id: number; status: string }>(
      hrClient.post(`${BASE}/files/${fileId}/archive`, { version, reason }),
    ),
};

// ─── Hồ sơ tài liệu (Phase 1.3) ────────────────────────────────────────

/** Metadata file của một phiên bản — tên file chỉ có khi xem được nội dung. */
export interface HrDocumentFile {
  id: number;
  mimeType: string;
  sizeBytes: number;
  scanStatus: HrFileScanStatus;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  classification: HrFileClassification;
  originalName: string | null;
  createdAt: string;
}

export interface HrDocumentVersion {
  id: number;
  versionNo: number;
  current: boolean;
  /** Backend quyết định: bản hiện hành ACTIVE, hoặc bản cũ (ARCHIVED) khi tài liệu còn hiệu lực. */
  canDownload: boolean;
  changeNote: string | null;
  createdAt: string;
  createdBy: number | null;
  file: HrDocumentFile | null;
}

export interface HrDocument {
  id: number;
  employeeId: number;
  documentType: HrDocumentType;
  classification: HrFileClassification;
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  /** null khi đã lưu trữ. */
  expiryStatus: HrExpiryStatus | null;
  /** null với giấy khám nếu không có quyền xem nội dung. */
  note: string | null;
  status: "ACTIVE" | "ARCHIVED";
  version: number;
  currentVersionId: number | null;
  canViewContent: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archiveReason: string | null;
  versions: HrDocumentVersion[];
}

export interface HrDocumentList {
  employeeId: number;
  documents: HrDocument[];
  /** File GENERAL tải lên trước đây (0.4C), hiển thị là "Tài liệu khác". */
  legacyOtherFiles: { documentType: "OTHER"; canDownload: boolean; file: HrDocumentFile }[];
}

export interface HrExpiringDocument {
  id: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  documentType: HrDocumentType;
  title: string;
  expiresOn: string;
  expiryStatus: HrExpiryStatus;
}

const multipart = (fields: Record<string, string>, file: File) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", file);
  return form;
};

/**
 * Xem/tải nội dung KHÔNG có API riêng: dùng `hrFileApi.requestAccess` →
 * `downloadBlob` của 0.4C với `version.file.id`.
 */
export const hrDocumentApi = {
  list: (employeeId: number, status: "ACTIVE" | "ARCHIVED" | "ALL" = "ACTIVE") =>
    data<HrDocumentList>(hrClient.get(`${emp(employeeId)}/documents`, { params: { status } })),
  create: (employeeId: number, fields: Record<string, string>, file: File) =>
    data<HrDocument>(hrClient.post(`${emp(employeeId)}/documents`, multipart(fields, file))),
  addVersion: (documentId: number, version: number, file: File, changeNote?: string) =>
    data<HrDocument>(
      hrClient.post(
        `${BASE}/documents/${documentId}/versions`,
        multipart({ version: String(version), ...(changeNote ? { changeNote } : {}) }, file),
      ),
    ),
  update: (documentId: number, body: DocumentMetadataBody & { version: number }) =>
    data<HrDocument>(hrClient.patch(`${BASE}/documents/${documentId}`, body)),
  archive: (documentId: number, version: number, reason: string) =>
    data<{ id: number; status: string }>(hrClient.post(`${BASE}/documents/${documentId}/archive`, { version, reason })),
  expiring: (withinDays = 30) =>
    data<{ today: string; withinDays: number; items: HrExpiringDocument[] }>(
      hrClient.get(`${BASE}/documents/expiring`, { params: { withinDays } }),
    ),
};

// ─── Cơ cấu tổ chức (Phase 1.1) ────────────────────────────────────────

export interface HrOrgLeaderSummary {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaderRole: string;
  isApprovalAuthority: boolean;
  positionName: string | null;
}

export interface HrOrgUnit {
  id: number;
  code: string;
  version: number;
  unitType: "COMPANY" | "BRANCH" | "DEPARTMENT" | "TEAM";
  name: string;
  parentId: number | null;
  status: "ACTIVE" | "INACTIVE";
  effectiveFrom: string;
  effectiveTo: string | null;
  leaders: HrOrgLeaderSummary[];
}

export interface HrOrgUnitDetail {
  id: number;
  code: string;
  version: number;
  asOf: string;
  current: Omit<HrOrgUnit, "id" | "code" | "version" | "leaders"> | null;
  revisions: (Omit<HrOrgUnit, "id" | "code" | "version" | "leaders"> & { id: number; reason: string })[];
  leaders: (HrOrgLeaderSummary & {
    positionId: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    reason: string;
    endReason: string | null;
    version: number;
  })[];
}

export interface HrOrgApprover {
  kind: string;
  status: "RESOLVED" | "NOT_CONFIGURED";
  approver?: { employeeId: number; employeeName: string; orgUnitId: number };
  code?: string;
  message?: string;
}

export interface HrPosition {
  id: number;
  code: string;
  name: string;
  level: number | null;
  isActive: boolean;
  version: number;
}

export interface HrLegacyOrgMapping {
  id: number;
  sourceType: "DEPARTMENT" | "ROLE";
  sourceValue: string;
  orgUnitId: number;
  priority: number;
  isActive: boolean;
  version: number;
}

export const hrOrgApi = {
  /**
   * Đơn vị cho ô chọn phạm vi khi cấp quyền (cần ACCESS_ADMIN). Backend đã lọc
   * theo phạm vi quản trị của người gọi và ngày hiệu lực — chỉ id/mã/tên/loại/đường dẫn.
   */
  scopeOptions: (scopeType: ScopeOptionType, asOf: string) =>
    data<{ scopeType: ScopeOptionType; asOf: string; options: ScopeOption[] }>(
      hrClient.get(`${BASE}/organization/scope-options`, { params: { scopeType, asOf } }),
    ),
  units: (asOf: string, includeInactive = false) =>
    data<{ asOf: string; units: HrOrgUnit[] }>(
      hrClient.get(`${BASE}/org-units`, { params: { asOf, includeInactive } }),
    ),
  unit: (id: number, asOf: string) =>
    data<HrOrgUnitDetail>(hrClient.get(`${BASE}/org-units/${id}`, { params: { asOf } })),
  approvers: (id: number, asOf: string) =>
    data<{ approvers: HrOrgApprover[] }>(hrClient.get(`${BASE}/org-units/${id}/approvers`, { params: { asOf } })),
  /** Mã đơn vị do backend sinh (DV + 4 số) — không gửi code. */
  create: (body: { name: string; unitType: string; parentId?: number; effectiveFrom?: string; reason: string }) =>
    data<HrOrgUnit>(hrClient.post(`${BASE}/org-units`, body)),
  revise: (
    id: number,
    body: { version: number; effectiveFrom: string; name?: string; unitType?: string; parentId?: number | null; status?: string; reason: string },
  ) => data<HrOrgUnit>(hrClient.post(`${BASE}/org-units/${id}/revisions`, body)),
  assignLeader: (
    id: number,
    body: {
      employeeId: number;
      leaderRole: string;
      positionId?: number;
      isApprovalAuthority: boolean;
      effectiveFrom: string;
      effectiveTo?: string;
      reason: string;
    },
  ) => data<unknown>(hrClient.post(`${BASE}/org-units/${id}/leaders`, body)),
  endLeader: (leaderId: number, body: { version: number; effectiveTo: string; reason: string }) =>
    data<unknown>(hrClient.post(`${BASE}/org-unit-leaders/${leaderId}/end`, body)),
  positions: () => data<HrPosition[]>(hrClient.get(`${BASE}/positions`)),
  /** Mã chức danh do backend sinh (CD + 4 số) — không gửi code. */
  createPosition: (body: { name: string; level?: number }) =>
    data<HrPosition>(hrClient.post(`${BASE}/positions`, body)),
  updatePosition: (id: number, body: { version: number; name?: string; level?: number | null }) =>
    data<HrPosition>(hrClient.patch(`${BASE}/positions/${id}`, body)),
  deactivatePosition: (id: number, body: { version: number; reason: string }) =>
    data<HrPosition>(hrClient.post(`${BASE}/positions/${id}/deactivate`, body)),
  mappings: () => data<HrLegacyOrgMapping[]>(hrClient.get(`${BASE}/legacy-org-mappings`)),
  createMapping: (body: { sourceType: string; sourceValue: string; orgUnitId: number; priority?: number }) =>
    data<HrLegacyOrgMapping>(hrClient.post(`${BASE}/legacy-org-mappings`, body)),
  deactivateMapping: (id: number, body: { version: number; reason: string }) =>
    data<unknown>(hrClient.post(`${BASE}/legacy-org-mappings/${id}/deactivate`, body)),
};
