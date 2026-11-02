/**
 * Kiểm tra định dạng số định danh phía FE — PHẢN CHIẾU
 * `src/hr/employees/hr-sensitive-identifiers.ts` (backend) để báo sớm. Backend
 * vẫn kiểm tra lại. Thông báo lỗi KHÔNG lặp lại giá trị người dùng nhập.
 */

export type HrIdentifierKind =
  | "CCCD"
  | "CMND"
  | "PASSPORT"
  | "WORK_PERMIT"
  | "TAX_NUMBER"
  | "SOCIAL_INSURANCE_NUMBER"
  | "BANK_ACCOUNT";

const RULES: Record<HrIdentifierKind, { pattern: RegExp; message: string }> = {
  CCCD: { pattern: /^\d{12}$/, message: "Số CCCD phải gồm 12 chữ số." },
  CMND: { pattern: /^(\d{9}|\d{12})$/, message: "Số CMND phải gồm 9 hoặc 12 chữ số." },
  PASSPORT: { pattern: /^[A-Z0-9]{6,20}$/, message: "Số hộ chiếu gồm 6–20 chữ cái/chữ số." },
  WORK_PERMIT: { pattern: /^[A-Z0-9]{6,30}$/, message: "Số giấy phép lao động gồm 6–30 chữ cái/chữ số." },
  TAX_NUMBER: { pattern: /^(\d{10}|\d{12}|\d{13})$/, message: "Mã số thuế phải gồm 10, 12 hoặc 13 chữ số." },
  SOCIAL_INSURANCE_NUMBER: { pattern: /^\d{10}$/, message: "Mã số BHXH phải gồm 10 chữ số." },
  BANK_ACCOUNT: { pattern: /^[A-Z0-9]{6,30}$/, message: "Số tài khoản gồm 6–30 chữ cái/chữ số." },
};

export const IDENTITY_DOCUMENT_LABELS: Record<string, string> = {
  CCCD: "Căn cước công dân",
  CMND: "Chứng minh nhân dân",
  PASSPORT: "Hộ chiếu",
  WORK_PERMIT: "Giấy phép lao động",
};

/** Giống backend: NFKC, bỏ khoảng trắng / `-` / `.`, chữ hoa. */
export function normalizeIdentifier(value: string): string {
  return value.normalize("NFKC").replace(/[\s\-.]/g, "").toUpperCase();
}

/** `null` = hợp lệ; ngược lại là câu báo lỗi (không chứa giá trị). */
export function validateIdentifier(kind: HrIdentifierKind, raw: string): string | null {
  const rule = RULES[kind];
  return rule.pattern.test(normalizeIdentifier(raw)) ? null : rule.message;
}
