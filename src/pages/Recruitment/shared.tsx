import { useEffect, useRef } from "react";
import { Gauge, Loader2, Sparkles, X } from "lucide-react";

import type { RecruitmentAiUsage } from "@/service/recruitment";

/**
 * Thành phần + nhãn dùng chung cho các màn Tuyển dụng (trang chính, duyệt tin AI,
 * hội thoại Zalo, vận hành).
 */

export const STATUS_LABEL: Record<string, string> = {
  NEW: "Mới tiếp nhận",
  COLLECTING_INFO: "Đang bổ sung",
  SCREENING: "Đang sàng lọc",
  QUALIFIED: "Phù hợp",
  NEEDS_HR_REVIEW: "Cần HR xử lý",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Đề nghị",
  HIRED: "Đã tuyển",
  REJECTED: "Không phù hợp",
  WITHDRAWN: "Đã rút",
  DRAFT: "Bản nháp",
  ACTIVE: "Đang tuyển",
  PAUSED: "Tạm dừng",
  CLOSED: "Đã đóng",
  PROPOSED: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
  NO_SHOW: "Không đến",
  OPEN: "Đang chờ",
  RESOLVED: "Đã xử lý",
  RETURNED_TO_AI: "Đã trả AI",
};

export const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("vi-VN").format(value ?? 0);

export const formatTokens = (value: number) => {
  const compact = (n: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n);
  if (value >= 1_000_000) return `${compact(value / 1_000_000)} triệu`;
  if (value >= 1_000) return `${compact(value / 1_000)} nghìn`;
  return formatNumber(value);
};

export const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
};

export const initials = (name?: string | null) => {
  const parts = (name || "Ứng viên").trim().split(/\s+/);
  return `${parts[parts.length - 1]?.[0] || "U"}${
    parts.length > 1 ? parts[0][0] : ""
  }`.toUpperCase();
};

export const errorMessage = (error: unknown) => {
  const data = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data;
  return Array.isArray(data?.message)
    ? data.message.join(". ")
    : data?.message || "Không thể tải dữ liệu tuyển dụng.";
};

export function StatusBadge({ status }: { status: string }) {
  const tone = [
    "ACTIVE",
    "QUALIFIED",
    "HIRED",
    "CONFIRMED",
    "COMPLETED",
    "RESOLVED",
  ].includes(status)
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
    : ["NEEDS_HR_REVIEW", "REJECTED", "CANCELLED", "NO_SHOW", "OPEN"].includes(
        status
      )
    ? "bg-rose-50 text-rose-700 ring-rose-600/15"
    : ["SCREENING", "OFFER", "PAUSED"].includes(status)
    ? "bg-amber-50 text-amber-700 ring-amber-600/15"
    : ["INTERVIEW", "RETURNED_TO_AI"].includes(status)
    ? "bg-violet-50 text-violet-700 ring-violet-600/15"
    : "bg-sky-50 text-sky-700 ring-sky-600/15";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function Avatar({
  name,
  className = "",
}: {
  name?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[11px] font-extrabold text-[#005BEA] ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#005BEA]">
        <Sparkles size={20} />
      </div>
      <h3 className="mt-4 text-sm font-extrabold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-slate-500">
      <Loader2 className="animate-spin text-[#005BEA]" size={20} />
      Đang tải dữ liệu tuyển dụng…
    </div>
  );
}

export function AiUsagePanel({ usage }: { usage: RecruitmentAiUsage }) {
  const { today, month, limits, pilot } = usage;
  return (
    <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#005BEA]">
            <Gauge size={17} />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              Mức dùng AI
            </h2>
            <p className="text-[10px] text-slate-400">
              So với trần đang áp dụng, tính theo giờ Việt Nam
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
          {pilot.enabled
            ? `Pilot · ${formatNumber(pilot.senders)} người gửi`
            : "Mở cho mọi ứng viên"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <UsageMeter
          label="Lượt hôm nay"
          used={today.turns}
          max={limits.maxTurnsPerDay}
          format={formatNumber}
          hint={`Mỗi ứng viên tối đa ${limits.maxTurnsPerSenderHour} lượt/giờ, ${limits.maxTurnsPerSenderDay} lượt/ngày`}
        />
        <UsageMeter
          label="Token hôm nay"
          used={today.reservedTokens}
          max={limits.dailyTokenBudget}
          format={formatTokens}
          hint={`Thực dùng ${formatTokens(
            today.tokens
          )}, phần còn lại là giữ chỗ${
            today.reservationOverruns
              ? ` · ${today.reservationOverruns} lượt vượt mức giữ chỗ`
              : ""
          }`}
        />
        <UsageMeter
          label="Token tháng này"
          used={month.reservedTokens}
          max={limits.monthlyTokenBudget}
          format={formatTokens}
          hint={`Thực dùng ${formatTokens(month.tokens)}`}
        />
      </div>
    </section>
  );
}

export function UsageMeter({
  label,
  used,
  max,
  hint,
  format,
}: {
  label: string;
  used: number;
  max: number;
  hint: string;
  format: (value: number) => string;
}) {
  const percent = max > 0 ? Math.min(100, (used / max) * 100) : 100;
  const bar =
    percent >= 90
      ? "bg-rose-500"
      : percent >= 70
      ? "bg-amber-500"
      : "bg-[#005BEA]";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-500">{label}</span>
        <span
          className={`text-[10px] font-bold ${
            used >= max ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {used >= max ? "Chạm trần" : `${Math.round(percent)}%`}
        </span>
      </div>
      <p className="mt-1 text-lg font-black tracking-tight text-slate-900">
        {format(used)}
        <span className="ml-1 text-xs font-semibold text-slate-400">
          / {format(max)}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-slate-400">{hint}</p>
    </div>
  );
}

export const errorCode = (error: unknown) =>
  (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-slate-100 p-4">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
      />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-[10px] text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

/** Viền đỏ cho ô có `aria-invalid` — selector thuộc tính thắng `border-slate-200` của inputClass. */

export const invalidRing =
  " aria-[invalid=true]:border-rose-300 aria-[invalid=true]:focus:border-rose-400 aria-[invalid=true]:focus:ring-rose-100";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export const CONTROL_MODE_LABEL: Record<string, string> = {
  AI_ACTIVE: "AI đang hỗ trợ",
  AI_PAUSED: "AI tạm dừng",
  HUMAN_TAKEOVER: "HR đang xử lý",
  CLOSED: "Đã đóng",
};

export const APPROVAL_STATE_LABEL: Record<string, string> = {
  AWAITING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Hết hạn duyệt",
};

export const OUTBOX_STATUS_LABEL: Record<string, string> = {
  AWAITING_APPROVAL: "Chờ duyệt",
  PENDING: "Chờ gửi",
  SENDING: "Đang gửi",
  RETRY: "Gửi lại",
  SENT: "Đã gửi",
  UNKNOWN: "Chưa rõ kết quả",
  DEAD_LETTER: "Gửi lỗi",
  SUPPRESSED: "Không gửi",
};

export const SENDER_LABEL: Record<string, string> = {
  CANDIDATE: "Ứng viên",
  AI: "AI",
  HR: "Nhân sự",
  SYSTEM: "Hệ thống",
};

export const ALERT_TYPE_LABEL: Record<string, string> = {
  CANDIDATE_REQUESTED_HUMAN: "Ứng viên muốn gặp HR",
  AI_POLICY_HANDOFF: "AI bị chặn bởi chính sách",
  CANDIDATE_MESSAGE_WAITING: "Tin ứng viên đang chờ",
  OUTBOUND_UNKNOWN: "Tin gửi chưa rõ kết quả",
  OUTBOUND_DEAD_LETTER: "Tin gửi lỗi",
  CHANNEL_EVENT_DEAD_LETTER: "Tin đến xử lý lỗi",
  REFRESH_OUTCOME_UNKNOWN: "Làm mới token Zalo chưa rõ",
  REPEATED_AI_FAILURE: "AI lỗi lặp lại",
  AI_LIMIT_REACHED: "Chạm giới hạn AI",
};

export const SEVERITY_TONE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-rose-50 text-rose-700",
  CRITICAL: "bg-rose-600 text-white",
};

/** Mã idempotency cho thao tác duyệt: giữ nguyên khi người dùng bấm lại cùng một thao tác. */
export const newRequestId = (): string => {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // UUID v4 từ getRandomValues (backend kiểm @IsUUID) — WebView cũ chưa có randomUUID.
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20)}`;
};

export const httpStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status;

export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs"
    >
      <span className="text-slate-500">
        Trang {page}/{pages} · {formatNumber(total)} mục
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="h-8 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 disabled:opacity-40"
        >
          Trước
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="h-8 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 disabled:opacity-40"
        >
          Sau
        </button>
      </div>
    </nav>
  );
}

/** Drawer bên phải: Escape đóng, focus vào drawer khi mở và trả về chỗ cũ khi đóng. */
export function DrawerShell({
  title,
  eyebrow,
  onClose,
  footer,
  busy = false,
  children,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);
  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[#FAFBFF] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#005BEA]">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-1 truncate text-lg font-black text-slate-900">
              {title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {busy && (
              <Loader2
                size={16}
                className="animate-spin text-[#005BEA]"
                aria-label="Đang tải"
              />
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="border-t border-slate-200 bg-white px-5 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}

/** Hộp xác nhận trong ứng dụng (thay window.confirm cho thao tác quan trọng). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="recruitment-confirm-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <h3
          id="recruitment-confirm-title"
          className="text-base font-black text-slate-900"
        >
          {title}
        </h3>
        <div className="mt-2 text-xs leading-6 text-slate-600">{message}</div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50 ${
              tone === "danger"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-[#005BEA] hover:bg-blue-700"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
