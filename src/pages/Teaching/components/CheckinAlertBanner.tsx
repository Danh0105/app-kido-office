import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Phone, RefreshCw } from "lucide-react";

import { teachingSessionApi } from "@/service/teaching";
import { getSocket } from "@/utils/socket";
import type { CheckinAlertItem, CheckinAlertResponse } from "@/types/teaching";

/**
 * Cảnh báo giáo viên chưa check-in, đặt ngay đầu màn Chấm công.
 *
 * Backend bắn thông báo/push khi còn ít phút nữa tới giờ dạy; banner này là bản
 * "đang diễn ra" của cùng dữ liệu đó — mở màn chấm công là thấy ngay ai chưa
 * điểm danh, kèm số điện thoại để gọi luôn.
 */
const POLL_MS = 60_000;
/** FE tự bảo vệ khi đang kết nối BE cũ vẫn trả cảnh báo quá hạn. */
const MAX_LATE_MINUTES = 10;

const describeMinutes = (minutes: number) => {
  if (minutes > 0) return `còn ${minutes} phút`;
  if (minutes === 0) return "đã tới giờ";
  return `trễ ${Math.abs(minutes)} phút`;
};

/** Trễ giờ thì đỏ, còn kịp thì cam — để mắt bắt được mức độ trước khi đọc chữ. */
const toneOf = (minutes: number) =>
  minutes < 0
    ? { chip: "bg-red-100 text-red-700", dot: "bg-red-500" }
    : { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };

function AlertRow({ item }: { item: CheckinAlertItem }) {
  const tone = toneOf(item.minutesToStart);
  const place = [item.className, item.schoolName].filter(Boolean).join(" · ");

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-gray-900">
            {item.teacherName || "Chưa rõ giáo viên"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}
          >
            {describeMinutes(item.minutesToStart)}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-gray-500">
          {item.startTime}
          {item.endTime ? `–${item.endTime}` : ""}
          {place ? ` · ${place}` : ""}
        </p>
      </div>

      {item.teacherPhone && (
        <a
          href={`tel:${item.teacherPhone}`}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 active:scale-95"
        >
          <Phone size={13} />
          Gọi
        </a>
      )}
    </li>
  );
}

export default function CheckinAlertBanner() {
  const [state, setState] = useState<CheckinAlertResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await teachingSessionApi.checkinAlerts());
    } catch (error) {
      // Không chặn màn chấm công vì banner phụ hỏng; giữ dữ liệu lần trước.
      console.error("Không tải được cảnh báo check-in", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Báo động đẩy về qua socket thì tải lại ngay, không đợi hết nhịp poll.
  useEffect(() => {
    const socket = getSocket();
    socket.on("teaching-checkin-alert:new", load);
    return () => {
      socket.off("teaching-checkin-alert:new", load);
    };
  }, [load]);

  const visibleAlerts = (state?.data ?? []).filter(
    (item) => item.minutesToStart >= -MAX_LATE_MINUTES,
  );

  if (!state || visibleAlerts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-amber-900">
              {visibleAlerts.length} buổi chưa check-in
            </h3>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-800 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Tải lại
            </button>
          </div>

          <p className="mt-0.5 text-xs text-amber-800">
            Hệ thống báo động trước giờ vào tiết {state.leadMinutes} phút.
          </p>

          <ul className="mt-1 divide-y divide-amber-200/70">
            {visibleAlerts.map((item) => (
              <AlertRow key={item.sessionId} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
