import { useEffect, type ReactNode } from "react";
import { AlertTriangle, FileText, Loader2, X } from "lucide-react";

import type { FinanceListItem, FinanceDetail } from "@/types/finance";
import {
  APPROVAL_LABELS,
  DEDUCTION_LABELS,
  PAYMENT_LABELS,
  RECOVERY_LABELS,
  SETTLEMENT_LABELS,
  TONE_CLASSES,
  TYPE_LABELS,
  TYPE_TONES,
  type Tone,
} from "../lib";

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function TypeBadge({ type }: { type: FinanceListItem["type"] }) {
  return <Badge tone={TYPE_TONES[type]}>{TYPE_LABELS[type]}</Badge>;
}

/** Ba trục trạng thái hiển thị riêng: duyệt — chi tiền — quyết toán/khấu trừ. */
export function StatusBadges({
  item,
  compact = false,
}: {
  item: Pick<
    FinanceListItem | FinanceDetail,
    | "type"
    | "approvalStatus"
    | "paymentStatus"
    | "recoveryStatus"
    | "settlementStatus"
    | "deductionStatus"
  > & { overdue?: boolean };
  compact?: boolean;
}) {
  const [approvalLabel, approvalTone] = APPROVAL_LABELS[item.approvalStatus];
  const extra: [string, Tone][] = [];
  if (item.paymentStatus !== "NONE") extra.push(PAYMENT_LABELS[item.paymentStatus]);
  if (item.recoveryStatus !== "NONE") extra.push(RECOVERY_LABELS[item.recoveryStatus]);
  if (item.settlementStatus !== "NONE") extra.push(SETTLEMENT_LABELS[item.settlementStatus]);
  if (item.deductionStatus !== "NONE") extra.push(DEDUCTION_LABELS[item.deductionStatus]);
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "" : "items-center"}`}>
      <Badge tone={approvalTone}>{approvalLabel}</Badge>
      {extra.map(([label, tone]) => (
        <Badge key={label} tone={tone}>
          {label}
        </Badge>
      ))}
      {item.overdue && <Badge tone="rose">Quá hạn hoàn ứng</Badge>}
    </div>
  );
}

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                {icon}
              </span>
            )}
            <h2 className="font-bold text-slate-900">{title}</h2>
          </div>
          {action}
        </div>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function LoadingState({ text = "Đang tải…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl bg-white py-16 text-sm text-slate-500">
      <Loader2 size={20} className="animate-spin" /> {text}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 font-bold underline">
          Thử lại
        </button>
      )}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
      <FileText size={40} className="mx-auto text-slate-300" />
      <h2 className="mt-3 font-bold text-slate-700">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </section>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      {items.map((text) => (
        <p key={text} className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {text}
        </p>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${
          wide ? "sm:max-w-4xl" : "sm:max-w-lg"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ô nhập số thập phân giữ nguyên dạng chuỗi (không qua số thực) — dùng cho
 * SL/đơn giá. Hiển thị kiểu vi-VN: "." phân cách nghìn, "," thập phân; giá
 * trị trả ra dạng "1234.5".
 */
export function DecimalTextInput({
  value,
  onChange,
  maxFraction,
  className = "",
  placeholder = "0",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  maxFraction: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [whole = "", fraction] = (value || "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const display = value === "" ? "" : fraction !== undefined ? `${grouped},${fraction}` : grouped;
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^\d,]/g, "");
        const [intPart, ...rest] = raw.split(",");
        const cleanInt = intPart.replace(/^0+(?=\d)/, "");
        if (rest.length && maxFraction > 0) {
          onChange(`${cleanInt || "0"}.${rest.join("").slice(0, maxFraction)}`);
        } else {
          onChange(cleanInt);
        }
      }}
    />
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "blue",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {icon && <span className={`rounded-lg p-1.5 ring-1 ring-inset ${TONE_CLASSES[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-lg font-extrabold tabular-nums text-slate-900 md:text-xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-sm md:grid-cols-[170px_1fr]">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{children || "—"}</dd>
    </div>
  );
}
