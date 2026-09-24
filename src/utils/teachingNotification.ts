import type { TeachingAlertType } from "@/service/notification";

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
