import type { TeachingAlertType } from "@/service/notification";
import type { NotificationMeta, NotificationType } from "@/types/notification";

type NotificationLike = {
  type?: unknown;
  message?: string;
  meta?: object;
};

/** Xác nhận lịch dạy + báo giảng gửi cho Giáo vụ/Nhân sự — gộp chung 1 mục "Giảng dạy". */
export const TEACHING_ALERT_TYPES: TeachingAlertType[] = [
  "TEACHING_SCHEDULE_CONFIRM_RESULT",
  "TEACHING_SCHEDULE_CONFIRM_ALERT",
  "TEACHING_LESSON_REPORT_ALERT",
  "TEACHER_LOCATION_CHANGE_REQUEST",
  "TEACHING_REPLACEMENT_REQUEST",
];

export const isTeachingAlertType = (type: unknown): type is TeachingAlertType =>
  TEACHING_ALERT_TYPES.includes(type as TeachingAlertType);

/**
 * Giáo viên từ chối/hủy một tiết đã nhận: bản mới dùng type riêng, còn một số
 * bản backend cũ chỉ đánh dấu `kind` trong metadata của notification chung.
 */
export const isTeachingCancellationNotification = (
  notification: NotificationLike,
) => {
  if (notification.type === "TEACHING_REPLACEMENT_REQUEST") return true;
  const meta = (notification.meta || {}) as Record<string, unknown>;
  return String(meta.kind || "").toUpperCase() === "TEACHING_REPLACEMENT_REQUEST";
};

/**
 * Thông báo lịch dạy hiện đi qua luồng notification dùng chung. Hỗ trợ cả metadata
 * mới của backend và nội dung của các thông báo cũ đã gửi trước khi có metadata.
 */
export const isTeachingScheduleNotification = (notification: NotificationLike) => {
  const meta = (notification.meta || {}) as Record<string, unknown>;
  const markers = [
    meta.kind,
    meta.type,
    meta.category,
    meta.module,
    meta.target,
    meta.path,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/teaching|schedule|lich-day|giao-vien/.test(markers)) return true;

  return /^\s*lịch dạy\b/i.test(notification.message || "");
};

/** Link an toàn cho thông báo giáo viên xin người dạy thay. */
export const teachingReplacementPath = (notification: NotificationLike) => {
  const meta = (notification.meta || {}) as Record<string, unknown>;
  if (meta.kind !== "TEACHING_REPLACEMENT_REQUEST") return "";
  const sessionId = Number(meta.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return "";
  return `/nhan-su/lich-day?tab=sessions&sessionId=${sessionId}`;
};

export type NotificationSurface = "employee" | "director";

export type RoutableNotification = {
    type?: NotificationType | string;
    entityId?: number;
    senderId?: number | null;
    createdBy?: number;
    meta?: NotificationMeta | null;
};

const expenseRequestPath = (surface: NotificationSurface, id: number) =>
    surface === "director"
        ? `/director/expense-requests/${id}`
        : `/employee/expense-requests/${id}`;

// Single source of truth for "where does this notification take you" — used by the
// realtime socket handlers, native/web push tap handlers, and the notification lists
// in Employee/Home.tsx + Director/Home.tsx. §5 of the FE realtime notification spec.
export function notificationPath(
    notification: RoutableNotification,
    surface: NotificationSurface,
): string | null {
    const meta = notification.meta ?? undefined;

    if (meta?.route) return meta.route;

    if (meta?.kind === "TEACHING_REPLACEMENT_REQUEST" && meta.sessionId != null) {
        return `/nhan-su/lich-day?tab=sessions&sessionId=${meta.sessionId}`;
    }

    const targetId = notification.entityId ?? meta?.suggestId;

    switch (notification.type) {
        case "EXPENSE_REQUEST":
            return targetId != null ? expenseRequestPath(surface, targetId) : null;

        case "SUGGEST":
            if (meta?.suggestType === "EXPENSE_REQUEST") {
                return targetId != null ? expenseRequestPath(surface, targetId) : null;
            }
            return surface === "director"
                ? notification.entityId != null
                    ? `/director/suggest-review/${notification.entityId}`
                    : null
                : "/employee/suggest";

        case "POLICY":
            return targetId != null
                ? surface === "director"
                    ? `/director/policy/${targetId}`
                    : `/employee/policy/${targetId}`
                : null;

        case "REPORT":
            return surface === "director"
                ? `/director/daily-report/${notification.senderId ?? notification.createdBy ?? ""}`
                : "/employee/daily-report";

        case "WEEKLY_PLAN": {
            // No dedicated "kế hoạch tuần" screen exists yet — both surfaces already reuse
            // the daily-report/{senderId} view for weekly-plan notifications, keep that.
            const senderId = notification.senderId ?? notification.createdBy;
            return senderId != null ? `/director/daily-report/${senderId}` : null;
        }

        case "TEACHING_SCHEDULE":
            // Screen not implemented in this app yet — path kept for forward-compat.
            return "/giao-vien/lich-day";

        default:
            // SYSTEM / unknown → don't navigate blindly, caller should open the notification list.
            return null;
    }
}
