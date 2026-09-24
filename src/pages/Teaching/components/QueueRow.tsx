import type { ReactNode } from "react";

import type { ReviewStatus } from "./ReviewQueues";

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Không duyệt",
};

/** Ngày giờ ngắn: hàng chờ chỉ cần biết "gửi lúc nào", không cần đủ giây. */
export const formatQueueTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function QueueLoading() {
  return <p className="py-5 text-center text-sm text-gray-400">Đang tải…</p>;
}

export function QueueEmpty() {
  return (
    <p className="py-5 text-center text-sm text-gray-400">Không có yêu cầu</p>
  );
}

/** Một dòng hàng chờ — gói gọn trên một hàng để danh sách không chiếm chỗ. */
export function QueueRow({
  icon,
  iconClass,
  title,
  badge,
  subtitle,
  createdAt,
  status,
  onClick,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  badge?: string;
  subtitle: string;
  createdAt: string;
  status: ReviewStatus;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-1 py-2 text-left hover:bg-gray-50"
    >
      <span className={`shrink-0 rounded-lg p-1.5 ${iconClass}`}>{icon}</span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-800">
          {title}
          {badge && (
            <span className="ml-1 text-xs font-normal text-gray-400">
              {badge}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-gray-400">
          {subtitle} · {formatQueueTime(createdAt)}
        </span>
      </span>

      {status !== "pending" && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
    </button>
  );
}

export { STATUS_LABEL, STATUS_STYLE };
