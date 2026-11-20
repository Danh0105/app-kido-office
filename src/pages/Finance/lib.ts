import { useLocation } from "react-router-dom";

import type {
  ApprovalStatus,
  AttachmentKind,
  DeductionStatus,
  FinanceRequestType,
  FinanceRole,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
  RecoveryStatus,
  SelfApprovalMode,
  SettlementStatus,
  SignatureSlot,
  StepStatus,
} from "@/types/finance";

export type Tone = "slate" | "blue" | "amber" | "emerald" | "rose" | "violet" | "sky";

export const TONE_CLASSES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
};

export const TYPE_LABELS: Record<FinanceRequestType, string> = {
  ADVANCE: "Tạm ứng",
  SALARY_ADVANCE: "Tạm ứng lương",
  SETTLEMENT: "Hoàn ứng",
  EXPENSE_PAYMENT: "Thanh toán chi phí",
  INTERNAL_TRANSFER: "Điều chuyển tiền nội bộ",
};

export const TYPE_TITLES: Record<FinanceRequestType, string> = {
  ADVANCE: "Giấy đề nghị tạm ứng",
  SALARY_ADVANCE: "Giấy đề nghị tạm ứng lương",
  SETTLEMENT: "Giấy đề nghị hoàn ứng",
  EXPENSE_PAYMENT: "Giấy đề nghị thanh toán chi phí / công tác phí",
  INTERNAL_TRANSFER: "Giấy đề nghị điều chuyển tiền nội bộ",
};

export const TYPE_DESCRIPTIONS: Record<FinanceRequestType, string> = {
  ADVANCE: "Ứng trước tiền cho công việc, sự kiện; hoàn ứng sau khi chi.",
  SALARY_ADVANCE: "Ứng trước một phần lương, khấu trừ vào kỳ lương.",
  SETTLEMENT: "Quyết toán khoản đã tạm ứng bằng chi phí thực tế.",
  EXPENSE_PAYMENT: "Thanh toán chi phí đã tự chi, công tác phí.",
  INTERNAL_TRANSFER: "Chuyển tiền từ nguồn này sang nguồn khác (tiền mặt ↔ ngân hàng, giữa các tài khoản).",
};

export const TYPE_TONES: Record<FinanceRequestType, Tone> = {
  ADVANCE: "blue",
  SALARY_ADVANCE: "violet",
  SETTLEMENT: "amber",
  EXPENSE_PAYMENT: "sky",
  INTERNAL_TRANSFER: "emerald",
};

export const APPROVAL_LABELS: Record<ApprovalStatus, [string, Tone]> = {
  DRAFT: ["Nháp", "slate"],
  PENDING: ["Chờ duyệt", "amber"],
  RETURNED: ["Yêu cầu bổ sung", "violet"],
  APPROVED: ["Đã duyệt", "emerald"],
  REJECTED: ["Từ chối", "rose"],
  CANCELLED: ["Đã huỷ", "slate"],
};

export const PAYMENT_LABELS: Record<PaymentStatus, [string, Tone]> = {
  NONE: ["—", "slate"],
  UNPAID: ["Chờ chi tiền", "amber"],
  PARTIALLY_PAID: ["Đã chi một phần", "sky"],
  PAID: ["Đã chi đủ", "emerald"],
};

export const RECOVERY_LABELS: Record<RecoveryStatus, [string, Tone]> = {
  NONE: ["—", "slate"],
  PENDING: ["Chờ hoàn trả", "amber"],
  PARTIAL: ["Đã thu một phần", "sky"],
  RECOVERED: ["Đã thu đủ", "emerald"],
};

export const SETTLEMENT_LABELS: Record<SettlementStatus, [string, Tone]> = {
  NONE: ["—", "slate"],
  NOT_SETTLED: ["Chưa hoàn ứng", "amber"],
  PARTIALLY_SETTLED: ["Hoàn ứng một phần", "sky"],
  SETTLED: ["Đã hoàn ứng đủ", "emerald"],
  PENDING_PAYMENT: ["Chờ thanh toán bổ sung", "amber"],
  PENDING_REFUND: ["Chờ hoàn trả tiền thừa", "violet"],
  COMPLETED: ["Đã quyết toán", "emerald"],
};

export const DEDUCTION_LABELS: Record<DeductionStatus, [string, Tone]> = {
  NONE: ["—", "slate"],
  NOT_DEDUCTED: ["Chưa khấu trừ", "amber"],
  DEDUCTING: ["Đang khấu trừ", "sky"],
  DEDUCTED: ["Đã khấu trừ hết", "emerald"],
};

export const STEP_LABELS: Record<StepStatus, [string, Tone]> = {
  WAITING: ["Chưa tới lượt", "slate"],
  PENDING: ["Đang chờ duyệt", "amber"],
  APPROVED: ["Đã duyệt", "emerald"],
  REJECTED: ["Từ chối", "rose"],
  RETURNED: ["Yêu cầu bổ sung", "violet"],
  SKIPPED: ["Bỏ qua", "slate"],
  CANCELLED: ["Đã huỷ vòng", "slate"],
};

export const ROLE_LABELS: Record<FinanceRole, string> = {
  MANAGER: "Quản lý trực tiếp",
  CONTROLLER: "Bộ phận kiểm soát",
  ACCOUNTANT: "Kế toán",
  CASHIER: "Thủ quỹ",
  DIRECTOR: "Giám đốc duyệt",
  ADMIN: "Quản trị phân hệ",
  VIEWER: "Xem báo cáo",
};

export const SLOT_LABELS: Record<SignatureSlot, string> = {
  MANAGER: "Quản lý trực tiếp",
  CONTROLLER: "Bộ phận kiểm soát",
  ACCOUNTANT: "Kế toán",
  DIRECTOR: "Giám đốc duyệt",
};

export const SELF_MODE_LABELS: Record<SelfApprovalMode, string> = {
  BLOCK: "Không cho tự duyệt (cấp không còn ai thì không gửi được)",
  SKIP_STEP: "Bỏ qua cấp mà người đề nghị là người duyệt duy nhất",
  ALLOW: "Cho phép tự duyệt",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  CASH: "Tiền mặt",
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  VAT: "Hoá đơn VAT",
  NON_VAT: "Không VAT",
  NONE: "Không có hoá đơn",
};

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  DOCUMENT: "Tài liệu",
  INVOICE: "Hoá đơn",
  PAYMENT_PROOF: "Biên nhận chi tiền",
  REFUND_PROOF: "Biên nhận hoàn trả",
  ADJUSTMENT_EVIDENCE: "Bằng chứng điều chỉnh",
  CONTROL_EVIDENCE: "Chứng từ kiểm soát",
};

export const AUDIT_LABELS: Record<string, string> = {
  CREATED: "Tạo phiếu",
  UPDATED: "Chỉnh sửa",
  DELETED: "Xoá bản nháp",
  SUBMITTED: "Gửi duyệt",
  WITHDRAWN: "Thu hồi",
  APPROVED_STEP: "Duyệt một cấp",
  APPROVED: "Phê duyệt hoàn tất",
  REJECTED: "Từ chối",
  RETURNED: "Yêu cầu bổ sung",
  STEP_SKIPPED: "Bỏ qua cấp duyệt",
  AMOUNTS_ADJUSTED: "Điều chỉnh số tiền chấp nhận",
  CANCELLED: "Huỷ phiếu",
  COPIED: "Sao chép từ phiếu khác",
  ATTACHMENT_ADDED: "Thêm tệp đính kèm",
  ATTACHMENT_REMOVED: "Xoá tệp đính kèm",
  PAYMENT_RECORDED: "Ghi nhận chi tiền",
  PAYMENT_VOIDED: "Huỷ phiếu chi",
  REFUND_RECORDED: "Ghi nhận hoàn trả",
  REFUND_VOIDED: "Huỷ phiếu thu",
  ALLOCATION_APPLIED: "Đối trừ tạm ứng",
  DEDUCTION_PLANNED: "Lập kế hoạch khấu trừ lương",
  DEDUCTION_CONFIRMED: "Ghi nhận khấu trừ lương",
  SETTLEMENT_COMPLETED: "Quyết toán hoàn tất",
};

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("vi-VN").format(Math.trunc(Number(value ?? 0)));

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
};

export const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";

export const todayVN = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export const formatBytes = (value: number) =>
  value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;

/** "1.5000" → "1,5" (hiển thị số lượng theo kiểu vi-VN). */
export const formatQuantity = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return `${formatMoney(Number(whole))}${trimmed ? `,${trimmed}` : ""}`;
};

/**
 * Thành tiền xem trước trên form (số nguyên VND, làm tròn nửa lên). Backend
 * luôn tính lại — đây chỉ để người nhập thấy ngay.
 */
export const previewLineAmount = (quantity: string, unitPrice: string) => {
  const parse = (value: string, scale: number) => {
    const match = /^(\d+)(?:\.(\d+))?$/.exec((value || "").trim());
    if (!match) return null;
    const fraction = (match[2] ?? "").padEnd(scale, "0").slice(0, scale);
    return Number(match[1] + fraction);
  };
  const q = parse(quantity, 4);
  const p = parse(unitPrice, 2);
  if (q === null || p === null) return 0;
  const scaled = q * p;
  if (Number.isSafeInteger(scaled)) return Math.floor((scaled * 2 + 1_000_000) / 2_000_000);
  return Math.round(Number(quantity) * Number(unitPrice));
};

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const UNITS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

const readTriple = (value: number, full: boolean) => {
  const h = Math.floor(value / 100);
  const t = Math.floor((value % 100) / 10);
  const u = value % 10;
  const words: string[] = [];
  if (full || h > 0) words.push(DIGITS[h], "trăm");
  if (t === 0) {
    if (u > 0) {
      if (full || h > 0) words.push("linh");
      words.push(DIGITS[u]);
    }
  } else if (t === 1) {
    words.push("mười");
    if (u === 5) words.push("lăm");
    else if (u > 0) words.push(DIGITS[u]);
  } else {
    words.push(DIGITS[t], "mươi");
    if (u === 1) words.push("mốt");
    else if (u === 4) words.push("tư");
    else if (u === 5) words.push("lăm");
    else if (u > 0) words.push(DIGITS[u]);
  }
  return words.join(" ");
};

/** Đọc số tiền bằng chữ (giống hệt quy tắc backend dùng trên PDF). */
export const vndToWords = (amount: number) => {
  amount = Math.round(amount || 0);
  if (amount === 0) return "Không đồng";
  const negative = amount < 0;
  let rest = Math.abs(amount);
  const groups: number[] = [];
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!groups[i]) continue;
    const text = readTriple(groups[i], i !== groups.length - 1);
    parts.push(UNITS[i] ? `${text} ${UNITS[i]}` : text);
  }
  const sentence = `${negative ? "âm " : ""}${parts.join(" ")} đồng`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

/** Gốc đường dẫn của phân hệ theo workspace đang đứng (/director hay /employee). */
export const useFinanceBase = () => {
  const { pathname } = useLocation();
  return pathname.startsWith("/employee") ? "/employee/finance" : "/director/finance";
};

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

export const labelClass = "block text-xs font-semibold text-slate-600";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60";

/** Mở blob (PDF/ảnh) ở tab mới; trình chặn popup thì tải xuống. */
export const openBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank", "noopener");
  if (!tab) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
