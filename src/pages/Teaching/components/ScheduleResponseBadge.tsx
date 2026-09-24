import type { ScheduleResponseStatus, TeachingSession } from "@/types/teaching";

const META: Record<ScheduleResponseStatus, { label: string; className: string; dot: string }> = {
  PENDING: {
    label: "Chưa phản hồi",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  ACCEPTED: {
    label: "Đã nhận lịch",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  DECLINED: {
    label: "Từ chối lịch",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
};

/** Chuẩn hoá cả field mới và tên field cũ để FE không gãy khi BE triển khai lệch phiên bản. */
export function scheduleResponseOf(session: TeachingSession): ScheduleResponseStatus | null {
  if (session.declinedAt) return "DECLINED";

  const raw = String(
    session.scheduleResponseStatus ?? session.responseStatus ?? "",
  ).toUpperCase();
  if (["ACCEPTED", "CONFIRMED", "ACKNOWLEDGED", "RECEIVED"].includes(raw)) {
    return "ACCEPTED";
  }
  if (["DECLINED", "REJECTED", "REFUSED"].includes(raw)) return "DECLINED";
  if (["PENDING", "SENT", "UNRESPONDED", "NO_RESPONSE"].includes(raw)) {
    return "PENDING";
  }

  // Chỉ hiện "chưa phản hồi" khi có dấu vết lịch đã được gửi; dữ liệu cũ
  // chưa từng gửi lịch không bị gắn nhãn nhầm.
  if (session.acceptedAt) return "ACCEPTED";
  if (session.scheduleNotifiedAt && !session.respondedAt) return "PENDING";
  return null;
}

export default function ScheduleResponseBadge({
  session,
  compact = false,
}: {
  session: TeachingSession;
  compact?: boolean;
}) {
  const status = scheduleResponseOf(session);
  if (!status) return null;
  const meta = META[status];

  if (compact) {
    return (
      <span
        title={meta.label}
        aria-label={meta.label}
        className={`inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-white ${meta.dot}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function ScheduleResponseLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
      {(Object.keys(META) as ScheduleResponseStatus[]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${META[status].dot}`} />
          {META[status].label}
        </span>
      ))}
    </div>
  );
}
