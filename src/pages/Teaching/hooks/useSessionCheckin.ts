import { useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type { TeachingSession } from "@/types/teaching";
import {
  DEFAULT_CHECKIN_RADIUS,
  MAX_TRUSTED_ACCURACY,
  distanceInMeters,
  getCurrentPosition,
  isValidLatLng,
  type FixedPosition,
  type LatLng,
} from "@/utils/geo";

/** Toạ độ trường của buổi dạy; null khi Nhân sự chưa gắn vị trí. */
export const schoolPointOf = (session: TeachingSession): LatLng | null =>
  isValidLatLng({
    latitude: session.schoolLatitude ?? undefined,
    longitude: session.schoolLongitude ?? undefined,
  })
    ? {
        latitude: Number(session.schoolLatitude),
        longitude: Number(session.schoolLongitude),
      }
    : null;

/** Bán kính cho phép chấm vị trí của trường (mét). */
export const radiusOf = (session: TeachingSession) =>
  session.schoolCheckinRadius || DEFAULT_CHECKIN_RADIUS;

/** Lần check-in đang chờ xác nhận vì giáo viên đứng ngoài bán kính cho phép. */
export type OutOfRangeMark = {
  session: TeachingSession;
  position: FixedPosition;
  distance: number;
};

/**
 * Check-in theo GPS — dùng chung cho drawer chi tiết buổi dạy và màn Chấm
 * công của giáo viên. Check-out (kèm nội dung bài dạy bắt buộc) và nộp bài
 * không cần GPS dùng `useLessonSubmit` riêng — khác luồng vì phải mở form
 * nhập nội dung trước khi gửi.
 *
 * Khoảng cách thật do backend tính lại; phép so ở đây chỉ để hỏi lại người dùng
 * trước khi gửi, vì đứng ngoài bán kính vẫn chấm được nhưng bị đánh dấu.
 */
export function useSessionCheckin(
  onChanged: (session: TeachingSession) => void,
) {
  /** Buổi đang gửi — để chỉ khoá đúng nút đang bấm khi màn có nhiều buổi. */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [outOfRange, setOutOfRange] = useState<OutOfRangeMark | null>(null);

  const submit = async (session: TeachingSession, position: FixedPosition) => {
    setBusyId(session.id);
    try {
      const updated = await teachingSessionApi.checkin(session.id, {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
      });

      toast.success(
        updated.checkinOutOfRange
          ? "Đã check-in — buổi này được đánh dấu ngoài vùng"
          : "Đã check-in",
      );
      setOutOfRange(null);
      onChanged(updated);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "check-in thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  /** Lấy GPS rồi gửi; ngoài bán kính thì dừng lại chờ người dùng xác nhận. */
  const mark = async (session: TeachingSession) => {
    setBusyId(session.id);
    try {
      const position = await getCurrentPosition();

      if (position.accuracy > MAX_TRUSTED_ACCURACY) {
        toast(
          `Sai số GPS đang lớn (~${position.accuracy} m). Ra chỗ thoáng sẽ chính xác hơn.`,
          { icon: "📡" },
        );
      }

      const schoolPoint = schoolPointOf(session);
      // Trường chưa gắn toạ độ → không so được, cứ ghi nhận vị trí.
      if (schoolPoint) {
        const distance = distanceInMeters(position, schoolPoint);
        if (distance > radiusOf(session)) {
          setOutOfRange({ session, position, distance });
          return;
        }
      }

      await submit(session, position);
    } catch (error: any) {
      toast.error(error?.message || "Không lấy được vị trí hiện tại");
    } finally {
      setBusyId(null);
    }
  };

  return {
    /** id buổi đang gửi, null khi rảnh. */
    busyId,
    outOfRange,
    mark,
    confirmOutOfRange: () =>
      outOfRange && submit(outOfRange.session, outOfRange.position),
    cancelOutOfRange: () => setOutOfRange(null),
  };
}
