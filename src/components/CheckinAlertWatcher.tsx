import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import { getEmployeeId } from "@/utils/auth";
import { getSocket } from "@/utils/socket";
import { canViewTeaching } from "@/pages/Teaching/lib";

/**
 * Báo động "giáo viên chưa check-in" nổi lên ở bất kỳ màn nào.
 *
 * Push của Firebase chỉ tới khi app chạy nền; lúc người dùng đang mở app thì
 * thông báo đi qua socket, nên phải có một chỗ nghe chung — không thể chỉ nghe
 * trong màn Chấm công vì giáo vụ hiếm khi ngồi sẵn ở đó.
 */
type AlertPayload = {
  message?: string;
  meta?: { sessionCount?: number; route?: string };
};

const ALERT_EVENT = "teaching-checkin-alert:new";

/**
 * Còn dưới 1 ngày mà giáo viên chưa phản hồi lịch được giao — cũng khẩn như
 * chưa check-in nên dùng chung cơ chế toast global này thay vì chỉ hiện
 * trong bell (Giáo vụ/Nhân sự hiếm khi ngồi sẵn ở Home để thấy bell tăng).
 */
const SCHEDULE_CONFIRM_ALERT_EVENT = "teaching-schedule-confirm-alert:new";

export default function CheckinAlertWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    // Chưa đăng nhập hoặc không thuộc khối quản lý giảng dạy thì không nghe.
    if (!getEmployeeId() || !canViewTeaching()) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    // Chung khung toast cho mọi báo động khẩn của module giảng dạy — chỉ khác
    // icon/tiêu đề/id (id khác để 2 loại báo động không đè toast của nhau).
    const showAlertToast = ({
      id,
      icon,
      title,
      message,
      route,
    }: {
      id: string;
      icon: string;
      title: string;
      message: string;
      route: string;
    }) => {
      toast(
        (t) => (
          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate(route);
            }}
            className="flex w-full items-start gap-2.5 text-left"
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-red-700">
                {title}
              </span>
              <span className="mt-0.5 block whitespace-pre-line text-xs text-gray-600 line-clamp-3">
                {message}
              </span>
              <span className="mt-1 block text-xs font-semibold text-blue-600">
                Xem chấm công →
              </span>
            </span>
          </button>
        ),
        {
          id,
          duration: 15000,
          style: {
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            maxWidth: "min(92vw, 420px)",
          },
        },
      );
    };

    const handleAlert = (data: AlertPayload) => {
      const count = data?.meta?.sessionCount ?? 1;

      showAlertToast({
        id: "teaching-checkin-alert",
        icon: "🚨",
        title: count > 1 ? `${count} buổi chưa check-in` : "Giáo viên chưa check-in",
        message: data?.message || "Sắp tới giờ dạy mà chưa có check-in.",
        route: data?.meta?.route || "/nhan-su/cham-cong",
      });
    };

    const handleScheduleConfirmAlert = (data: AlertPayload) => {
      showAlertToast({
        id: "teaching-schedule-confirm-alert",
        icon: "⏰",
        title: "Lịch dạy chưa được xác nhận",
        message: data?.message || "Sắp tới giờ dạy mà giáo viên chưa phản hồi lịch.",
        route: data?.meta?.route || "/nhan-su/cham-cong",
      });
    };

    socket.on(ALERT_EVENT, handleAlert);
    socket.on(SCHEDULE_CONFIRM_ALERT_EVENT, handleScheduleConfirmAlert);
    return () => {
      socket.off(ALERT_EVENT, handleAlert);
      socket.off(SCHEDULE_CONFIRM_ALERT_EVENT, handleScheduleConfirmAlert);
    };
  }, [navigate]);

  return null;
}
