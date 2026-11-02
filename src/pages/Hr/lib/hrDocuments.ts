/**
 * Hồ sơ tài liệu nhân viên (Phase 1.3) phía FE — PHẢN CHIẾU
 * `src/hr/documents/document-policy.ts` để báo sớm cho người dùng. Backend là
 * nơi kiểm tra thật. Không enum / parameter property (test chạy bằng node).
 */
import type { HrFileClassification } from "./hrFiles.ts";

export type HrDocumentType = "RESUME" | "DEGREE" | "CERTIFICATE" | "HEALTH_CERTIFICATE" | "OTHER";
export type HrExpiryRule = "NONE" | "OPTIONAL" | "REQUIRED";
export type HrExpiryStatus = "NO_EXPIRY" | "VALID" | "EXPIRING" | "EXPIRED";

export const DOCUMENT_TYPES: HrDocumentType[] = ["RESUME", "DEGREE", "CERTIFICATE", "HEALTH_CERTIFICATE", "OTHER"];

export const DOCUMENT_POLICY: Record<
  HrDocumentType,
  { label: string; expiry: HrExpiryRule; classification: HrFileClassification; sensitive: boolean }
> = {
  RESUME: { label: "Sơ yếu lý lịch", expiry: "NONE", classification: "CONFIDENTIAL", sensitive: false },
  DEGREE: { label: "Bằng cấp", expiry: "NONE", classification: "CONFIDENTIAL", sensitive: false },
  CERTIFICATE: { label: "Chứng chỉ", expiry: "OPTIONAL", classification: "CONFIDENTIAL", sensitive: false },
  HEALTH_CERTIFICATE: { label: "Giấy khám sức khỏe", expiry: "REQUIRED", classification: "RESTRICTED", sensitive: true },
  OTHER: { label: "Tài liệu khác", expiry: "OPTIONAL", classification: "INTERNAL", sensitive: false },
};

export const EXPIRY_STATUS_VIEW: Record<HrExpiryStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  NO_EXPIRY: { label: "Không thời hạn", tone: "neutral" },
  VALID: { label: "Còn hạn", tone: "success" },
  EXPIRING: { label: "Sắp hết hạn", tone: "warning" },
  EXPIRED: { label: "Đã hết hạn", tone: "danger" },
};

export interface DocumentForm {
  documentType: HrDocumentType;
  title: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string;
  note: string;
}

export const emptyDocumentForm = (documentType: HrDocumentType = "CERTIFICATE"): DocumentForm => ({
  documentType,
  title: "",
  issuer: "",
  issuedOn: "",
  expiresOn: "",
  note: "",
});

/** Lỗi phát hiện sớm (câu tiếng Việt). Rỗng = gửi được. */
export function documentFormProblems(form: DocumentForm, today: string): string[] {
  const out: string[] = [];
  const policy = DOCUMENT_POLICY[form.documentType];
  if (!form.title.trim()) out.push("Nhập tiêu đề.");
  if (policy.expiry === "NONE" && form.expiresOn) out.push(`${policy.label} không có ngày hết hạn.`);
  if (policy.expiry === "REQUIRED" && !form.expiresOn) out.push(`${policy.label} bắt buộc có ngày hết hạn.`);
  if (form.issuedOn && form.issuedOn > today) out.push("Ngày cấp không được ở tương lai.");
  if (form.issuedOn && form.expiresOn && form.issuedOn > form.expiresOn) out.push("Ngày hết hạn phải sau hoặc bằng ngày cấp.");
  return out;
}

export interface DocumentMetadataBody {
  title?: string;
  issuer?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  note?: string | null;
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** Trường text của multipart khi tạo: bỏ trường trống. Không có classification. */
export function createDocumentFields(form: DocumentForm): Record<string, string> {
  const out: Record<string, string> = { documentType: form.documentType, title: form.title.trim() };
  for (const k of ["issuer", "issuedOn", "expiresOn", "note"] as const) {
    const v = orNull(form[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

export interface DocumentSource {
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  note: string | null;
}

export const documentFormFrom = (type: HrDocumentType, d: DocumentSource): DocumentForm => ({
  documentType: type,
  title: d.title,
  issuer: d.issuer ?? "",
  issuedOn: d.issuedOn ?? "",
  expiresOn: d.expiresOn ?? "",
  note: d.note ?? "",
});

/** Patch sửa metadata: CHỈ trường đã đổi (null = xoá giá trị). */
export function documentPatch(original: DocumentSource, form: DocumentForm): DocumentMetadataBody {
  const next: Required<DocumentMetadataBody> = {
    title: form.title.trim(),
    issuer: orNull(form.issuer),
    issuedOn: orNull(form.issuedOn),
    expiresOn: orNull(form.expiresOn),
    note: orNull(form.note),
  };
  const patch: DocumentMetadataBody = {};
  for (const k of Object.keys(next) as (keyof DocumentMetadataBody)[])
    if (next[k] !== (original[k] ?? null)) (patch as Record<string, unknown>)[k] = next[k];
  return patch;
}
