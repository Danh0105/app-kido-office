import type { HrMyAccess, HrPermissionCode } from "./hrAccess.ts";

/**
 * Luật tài liệu HR phía FE — PHẢN CHIẾU `src/hr/files/hr-file-policy.ts` của
 * backend để báo sớm cho người dùng. Backend vẫn là nơi kiểm tra thật.
 */

export type HrFileDocumentType =
  | "IDENTITY_FRONT"
  | "IDENTITY_BACK"
  | "BANK_PROOF"
  | "CONTRACT"
  | "TAX"
  | "INSURANCE"
  | "GENERAL"
  | "RESUME"
  | "DEGREE"
  | "CERTIFICATE"
  | "HEALTH_CERTIFICATE";

export type HrFileClassification = "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type HrFileScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "FAILED" | "NOT_SCANNED";

export const HR_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const HR_FILE_ALLOWED_LABEL = "PDF, JPEG, PNG";

const ALLOWED: { mime: string; exts: string[] }[] = [
  { mime: "application/pdf", exts: [".pdf"] },
  { mime: "image/jpeg", exts: [".jpg", ".jpeg"] },
  { mime: "image/png", exts: [".png"] },
];

export const DOCUMENT_TYPE_LABELS: Record<HrFileDocumentType, string> = {
  IDENTITY_FRONT: "Giấy tờ tuỳ thân — mặt trước",
  IDENTITY_BACK: "Giấy tờ tuỳ thân — mặt sau",
  BANK_PROOF: "Xác nhận tài khoản ngân hàng",
  CONTRACT: "Hợp đồng",
  TAX: "Thuế",
  INSURANCE: "BHXH",
  // Phase 1.3: GENERAL hiển thị là "Tài liệu khác" (= OTHER của mục Tài liệu).
  GENERAL: "Tài liệu khác",
  RESUME: "Sơ yếu lý lịch",
  DEGREE: "Bằng cấp",
  CERTIFICATE: "Chứng chỉ",
  HEALTH_CERTIFICATE: "Giấy khám sức khỏe",
};

/**
 * Quyền xem NỘI DUNG theo loại — có MỘT trong các quyền là đủ; rỗng = backend
 * chưa có quyền tương đương (fail closed).
 */
export const FILE_ACCESS_PERMISSIONS: Record<HrFileDocumentType, HrPermissionCode[]> = {
  IDENTITY_FRONT: ["IDENTITY_REVEAL"],
  IDENTITY_BACK: ["IDENTITY_REVEAL"],
  BANK_PROOF: ["BANK_REVEAL"],
  CONTRACT: [],
  TAX: [],
  INSURANCE: [],
  GENERAL: ["FILE_VIEW", "DOCUMENT_VIEW"],
  RESUME: ["DOCUMENT_VIEW"],
  DEGREE: ["DOCUMENT_VIEW"],
  CERTIFICATE: ["DOCUMENT_VIEW"],
  HEALTH_CERTIFICATE: ["HEALTH_DOCUMENT_VIEW"],
};

/**
 * Tab "File" (0.4C) chỉ còn file định danh / ngân hàng. Tài liệu khác (lý
 * lịch, bằng cấp, chứng chỉ, giấy khám, GENERAL = "Tài liệu khác") quản lý ở
 * tab "Tài liệu" (Phase 1.3).
 */
export const FILES_TAB_TYPES: HrFileDocumentType[] = ["IDENTITY_FRONT", "IDENTITY_BACK", "BANK_PROOF"];

/** Loại upload được ở tab File. */
export const UPLOADABLE_DOCUMENT_TYPES = FILES_TAB_TYPES.filter((t) => FILE_ACCESS_PERMISSIONS[t].length > 0);

export const IDENTITY_FILE_TYPES: HrFileDocumentType[] = ["IDENTITY_FRONT", "IDENTITY_BACK"];

export const SCAN_STATUS_LABELS: Record<HrFileScanStatus, { label: string; hint: string }> = {
  NOT_SCANNED: { label: "Chưa quét", hint: "File chưa được hệ thống quét mã độc." },
  PENDING: { label: "Đang chờ quét", hint: "File đang chờ quét mã độc." },
  CLEAN: { label: "Đã quét — sạch", hint: "File đã được quét mã độc." },
  INFECTED: { label: "Nhiễm mã độc", hint: "File bị phát hiện mã độc — không thể tải." },
  FAILED: { label: "Quét lỗi", hint: "Quét mã độc thất bại — không thể tải." },
};

const DOWNLOADABLE_SCAN: HrFileScanStatus[] = ["CLEAN", "NOT_SCANNED"];

/** Kiểm tra trước khi upload. Trả câu báo lỗi hoặc null. */
export function validateHrUpload(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return "File rỗng.";
  if (file.size > HR_FILE_MAX_BYTES) return "File vượt quá 10 MB.";
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const type = (file.type || "").toLowerCase();
  const match = ALLOWED.find((a) => a.exts.includes(ext));
  if (!match) return `Chỉ nhận ${HR_FILE_ALLOWED_LABEL}.`;
  const normalized = type === "image/jpg" ? "image/jpeg" : type;
  if (normalized && normalized !== match.mime) return `Chỉ nhận ${HR_FILE_ALLOWED_LABEL} (định dạng file không khớp đuôi).`;
  return null;
}

export function fileNeedsReason(classification: HrFileClassification): boolean {
  return classification !== "INTERNAL";
}

/**
 * Hiện nút "Tải" khi: file ACTIVE, quét không bị chặn, loại có quyền tương
 * đương và người dùng có quyền đó (backend còn kiểm tra phạm vi nhân viên).
 */
export function canRequestFileAccess(
  file: { status: string; scanStatus: HrFileScanStatus; documentType: HrFileDocumentType },
  access: HrMyAccess | null | undefined,
): boolean {
  if (file.status !== "ACTIVE") return false;
  if (!DOWNLOADABLE_SCAN.includes(file.scanStatus)) return false;
  const permissions = FILE_ACCESS_PERMISSIONS[file.documentType] ?? [];
  return permissions.some((code) => !!access?.permissions.some((p) => p.code === code && p.scopes.length > 0));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
