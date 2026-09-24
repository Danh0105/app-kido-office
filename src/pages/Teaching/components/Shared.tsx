import type { ReactNode } from "react";
import DragScrollContainer from "./DragScrollContainer";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  SESSION_STATUS_META,
  SESSION_STATUS_ORDER,
} from "@/types/teaching";

export function Loading({ label = "Đang tải…" }: { label?: string }) {
  return <div className="text-center text-gray-400 text-sm py-10">{label}</div>;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 px-4 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 disabled:opacity-40"
      >
        ← Trước
      </button>
      <span className="whitespace-nowrap text-sm text-gray-600">
        Trang {page} / {totalPages}
      </span>
      <button
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 disabled:opacity-40"
      >
        Sau →
      </button>
    </div>
  );
}

/** Thanh điều hướng lịch: < | Tháng 8, 2026 | > + nút Hôm nay. */
export function RangeNav({
  title,
  onPrev,
  onNext,
  onToday,
  todayLabel = "Hôm nay",
}: {
  /** Tên khoảng đang xem — dùng dayTitle / weekTitle / monthTitle. */
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex items-center gap-2">
      <button
        onClick={onPrev}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 active:scale-95"
        aria-label="Kỳ trước"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex-1 text-center text-sm font-semibold text-gray-800 truncate">
        {title}
      </div>

      <button
        onClick={onNext}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 active:scale-95"
        aria-label="Kỳ sau"
      >
        <ChevronRight size={18} />
      </button>

      <button
        onClick={onToday}
        className="px-3 h-9 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium active:scale-95"
      >
        {todayLabel}
      </button>
    </div>
  );
}

/** Chuyển chế độ xem: Ngày | Tuần | Tháng | Danh sách. */
export function ViewSwitcher<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    // Desktop: co lại vừa nội dung thay vì kéo ngang cả màn hình.
    <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 md:inline-flex md:w-auto md:self-start">
      {options.map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition md:flex-none md:px-4 ${
            value === mode ? "bg-blue-500 text-white" : "text-gray-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Chú thích màu trạng thái — không có nó thì chấm màu trên lịch vô nghĩa. */
export function StatusLegend({
  /** Lịch có vẽ ô dựng từ mẫu lịch tuần → chú thích thêm kiểu nét đứt. */
  planned = false,
}: {
  planned?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
      {SESSION_STATUS_ORDER.map((status) => (
        <span
          key={status}
          className="flex items-center gap-1 text-[10px] text-gray-500"
        >
          <span
            className={`w-2 h-2 rounded-full ${SESSION_STATUS_META[status].dot}`}
          />
          {SESSION_STATUS_META[status].label}
        </span>
      ))}

      {planned && (
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2 h-2 rounded-full border border-blue-500 bg-blue-100" />
          Theo lịch cố định · chưa có buổi
        </span>
      )}
    </div>
  );
}

/**
 * Khung thanh bộ lọc dùng chung.
 * Mobile: các hàng xếp dọc. Desktop: lưới 4 cột — hàng con để `md:contents`
 * thì từng ô lọc nhảy thẳng vào lưới, thành một thanh lọc ngang.
 */
export function FilterCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 space-y-2 md:space-y-0 md:grid md:grid-cols-4 md:gap-2 md:items-center">
      {children}
    </div>
  );
}

export const selectClass = "px-2 py-2 border rounded-lg text-sm bg-white";

/** Bảng cuộn ngang — cùng kiểu bảng của module Quản lý thu chi. */
export function TableCard({
  children,
  minWidth = 900,
  draggable = false,
}: {
  children: ReactNode;
  minWidth?: number;
  draggable?: boolean;
}) {
  const table = (
    <table
      className="w-full text-sm whitespace-nowrap"
      style={{ minWidth }}
    >
      {children}
    </table>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {draggable ? (
        <DragScrollContainer className="overflow-x-auto">
          {table}
        </DragScrollContainer>
      ) : (
        <div className="overflow-x-auto">{table}</div>
      )}
    </div>
  );
}

export const thClass = "px-4 py-3 text-left font-semibold";
export const tdClass = "px-4 py-3";
export const theadClass = "bg-slate-100 text-slate-700";
export const trClass = "border-t border-slate-100 hover:bg-blue-50";
