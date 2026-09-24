import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  submitLabel?: string;
  submitColor?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  wide?: boolean;
  hideFooter?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
};

/** Khung modal dùng chung — cùng hình thức với ActionModal của module Đề xuất chi. */
export default function Modal({
  title,
  children,
  submitLabel,
  submitColor = "bg-blue-500",
  cancelLabel = "Hủy",
  loading,
  disabled,
  wide,
  hideFooter,
  onClose,
  onSubmit,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[10000] bg-black/40 flex items-end md:items-center justify-center"
      // Modal có thể được mở từ dropdown dùng portal. Chặn mousedown truyền tới
      // listener "click outside" của chuông, nếu không dropdown sẽ unmount cả
      // modal trước khi nút duyệt/từ chối nhận được sự kiện click.
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`bg-white w-full rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden ${
          wide ? "md:max-w-2xl" : "md:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">{children}</div>

        {!hideFooter && <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            {cancelLabel}
          </button>
          {onSubmit && (
            <button
              onClick={onSubmit}
              disabled={loading || disabled}
              className={`flex-1 py-2 text-sm rounded-xl text-white font-medium active:scale-95 disabled:opacity-60 ${submitColor}`}
            >
              {loading ? "Đang xử lý…" : submitLabel}
            </button>
          )}
        </div>}
      </div>
    </div>
  );
}

/** Modal xác nhận (xoá / thao tác không hoàn tác). */
export function ConfirmModal({
  title,
  message,
  hint,
  submitLabel = "Xoá",
  submitColor = "bg-red-500",
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  message: ReactNode;
  hint?: ReactNode;
  submitLabel?: string;
  submitColor?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      title={title}
      submitLabel={submitLabel}
      submitColor={submitColor}
      loading={loading}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <p className="text-sm text-gray-700">{message}</p>
      {hint && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {hint}
        </div>
      )}
    </Modal>
  );
}

// ---- Field wrappers dùng chung cho các form của module ----

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400";
