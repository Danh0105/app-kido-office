import {
  APPLICATION_STATUS_META,
  ASSIGNMENT_STATUS_META,
  SESSION_STATUS_META,
  type ApplicationStatus,
  type AssignmentStatus,
  type SessionStatus,
} from "@/types/teaching";

type Props = {
  status: SessionStatus;
  /** Ưu tiên nhãn API trả về (statusLabel). */
  label?: string | null;
  className?: string;
};

export default function SessionStatusBadge({
  status,
  label,
  className = "",
}: Props) {
  const meta = SESSION_STATUS_META[status];
  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium whitespace-nowrap ${
        meta?.badge || "bg-gray-100 text-gray-700"
      } ${className}`}
    >
      {label || meta?.label || status}
    </span>
  );
}

export function MakeupBadge({
  forSessionId,
  className = "",
}: {
  /** Buổi gốc được dạy bù — hiện trong tooltip. */
  forSessionId?: number | null;
  className?: string;
}) {
  return (
    <span
      title={
        forSessionId
          ? `Dạy bù cho buổi #${forSessionId}`
          : "Buổi dạy bù"
      }
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium bg-purple-100 text-purple-700 whitespace-nowrap ${className}`}
    >
      Dạy bù
    </span>
  );
}

/**
 * Trạng thái chấm vị trí của buổi dạy:
 * đã check-in → chờ check-out; đã check-out → xong.
 * `outOfRange` = có lần chấm nằm ngoài bán kính cho phép.
 */
export function CheckinBadge({
  checkedOut,
  outOfRange,
  className = "",
}: {
  checkedOut?: boolean | null;
  outOfRange?: boolean | null;
  className?: string;
}) {
  const label = checkedOut ? "Đã check-out" : "Đã check-in";

  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium whitespace-nowrap ${
        outOfRange
          ? "bg-amber-100 text-amber-700"
          : checkedOut
          ? "bg-emerald-100 text-emerald-700"
          : "bg-blue-100 text-blue-700"
      } ${className}`}
    >
      {outOfRange ? `${label} · ngoài vùng` : label}
    </span>
  );
}

export function OutsourcedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium border border-gray-300 text-gray-500 whitespace-nowrap ${className}`}
    >
      Thuê ngoài
    </span>
  );
}

export function ActiveBadge({
  active,
  activeLabel = "Đang dạy",
  inactiveLabel = "Ngừng",
  className = "",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium whitespace-nowrap ${
        active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      } ${className}`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/** Trạng thái phân công của tiết dạy — chỉ hiện khi chưa phân công xong. */
export function AssignmentBadge({
  status,
  applicationCount,
  className = "",
}: {
  status?: AssignmentStatus | null;
  /** Số giáo viên đã đăng ký — hiện kèm khi tiết đang mở. */
  applicationCount?: number;
  className?: string;
}) {
  if (!status || status === "ASSIGNED") return null;

  const meta = ASSIGNMENT_STATUS_META[status];
  const showCount = status === "OPEN" && !!applicationCount;

  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium whitespace-nowrap ${meta.badge} ${className}`}
    >
      {meta.label}
      {showCount ? ` · ${applicationCount} đăng ký` : ""}
    </span>
  );
}

/** Trạng thái đơn đăng ký của chính giáo viên đang đăng nhập. */
export function ApplicationBadge({
  status,
  className = "",
}: {
  status?: ApplicationStatus | null;
  className?: string;
}) {
  if (!status) return null;
  const meta = APPLICATION_STATUS_META[status];

  return (
    <span
      className={`inline-block text-[10px] px-2 py-[2px] rounded-full font-medium whitespace-nowrap ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  );
}
