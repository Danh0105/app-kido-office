import type { ReactNode } from "react";
import { AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { EmptyState, Loading } from "@/pages/Teaching/components/Shared";
import { describeHrError } from "../lib/hrErrors";

/**
 * Thành phần giao diện dùng chung của HRM — bọc lại component sẵn có của app
 * (Loading / EmptyState / TableCard…), gom bảng màu trạng thái về MỘT chỗ.
 */

export type HrTone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<HrTone, string> = {
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-gray-100 text-gray-600 border-gray-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export const STATUS_TONE: Record<string, HrTone> = {
  ACTIVE: "success",
  AVAILABLE: "success",
  CLEAN: "success",
  HEALTHY: "success",
  UPCOMING: "info",
  PENDING: "info",
  INTERNAL: "neutral",
  CONFIDENTIAL: "warning",
  NOT_SCANNED: "warning",
  INACTIVE: "neutral",
  EXPIRED: "neutral",
  ARCHIVED: "neutral",
  REVOKED: "danger",
  RESTRICTED: "danger",
  UNAVAILABLE: "danger",
  INFECTED: "danger",
  FAILED: "danger",
  UNHEALTHY: "danger",
};

export function HrBadge({
  tone,
  children,
  title,
}: {
  tone: HrTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ value, label, title }: { value: string; label?: string; title?: string }) {
  return (
    <HrBadge tone={STATUS_TONE[value] ?? "neutral"} title={title}>
      {label ?? value}
    </HrBadge>
  );
}

export function HrCard({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h3 className="font-semibold text-gray-800">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function HrAlert({ tone, children }: { tone: "warning" | "danger" | "info"; children: ReactNode }) {
  return (
    <div role="alert" className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const HrLoading = Loading;

export function HrEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <EmptyState title={title} description={description} action={action} />;
}

/** Lỗi API → câu thân thiện (qua `describeHrError`), không lộ chi tiết kỹ thuật. */
export function HrErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const view = describeHrError(error);
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 px-4 text-center space-y-2">
      <AlertTriangle className="mx-auto text-red-400" size={28} />
      <p className="text-sm font-medium text-gray-700">{view.message}</p>
      {view.details.map((d) => (
        <p key={d} className="text-xs text-gray-500">
          {d}
        </p>
      ))}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Thử lại
        </button>
      )}
    </div>
  );
}

export function HrDenied({ message = "Bạn không có quyền truy cập khu vực này." }: { message?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 px-4 text-center space-y-2">
      <Lock className="mx-auto text-gray-400" size={28} />
      <p className="text-sm font-medium text-gray-700">{message}</p>
      <p className="text-xs text-gray-400">Liên hệ quản trị HR nếu bạn cần được cấp quyền.</p>
    </div>
  );
}

/** Câu báo lỗi trong form (message + chi tiết có cấu trúc). */
export function HrFormError({ error }: { error: unknown }) {
  if (!error) return null;
  const view = describeHrError(error);
  return (
    <HrAlert tone="danger">
      <p>{view.message}</p>
      {view.details.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-xs">
          {view.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </HrAlert>
  );
}

export const CRYPTO_UNAVAILABLE_TEXT =
  "Mã hóa dữ liệu HR hiện chưa sẵn sàng. Các thao tác liên quan đến dữ liệu nhạy cảm sẽ tạm thời bị vô hiệu hóa.";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed";
export const buttonSecondary =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
export const buttonDanger =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed";
