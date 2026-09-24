import { useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type { TeachingSession } from "@/types/teaching";
import { getCurrentPosition, type FixedPosition } from "@/utils/geo";
import type { LessonSubmitContent } from "../components/LessonSubmitModal";

type PendingSubmit = {
  session: TeachingSession;
  mode: "checkout" | "lesson-only";
  /** Chỉ có ở mode "checkout" — đã lấy GPS trước khi mở form nội dung bài dạy. */
  position?: FixedPosition;
};

/**
 * Nộp nội dung bài dạy — dùng chung cho check-out (kèm GPS, tiết cuối một
 * block nhiều tiết hoặc buổi lẻ) và nộp bài không cần GPS (tiết giữa/đầu một
 * block, `session.checkoutRequired === false`).
 *
 * Check-in vẫn dùng `useSessionCheckin` riêng — chỉ check-out/nộp bài mới cần
 * form nội dung nên tách hook để không làm phình luồng check-in đơn giản.
 */
export function useLessonSubmit(onChanged: (session: TeachingSession) => void) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingSubmit | null>(null);

  /** Bấm "Check-out": lấy GPS trước rồi mới mở form nội dung bài dạy. */
  const openCheckout = async (session: TeachingSession) => {
    setBusyId(session.id);
    try {
      const position = await getCurrentPosition();
      setPending({ session, mode: "checkout", position });
    } catch (error: any) {
      toast.error(error?.message || "Không lấy được vị trí hiện tại");
    } finally {
      setBusyId(null);
    }
  };

  /** Bấm "Nộp nội dung bài dạy" — tiết giữa/đầu một block, không cần GPS. */
  const openLessonOnly = (session: TeachingSession) => {
    setPending({ session, mode: "lesson-only" });
  };

  const cancel = () => setPending(null);

  const submit = async (content: LessonSubmitContent) => {
    if (!pending) return;
    const { session, mode, position } = pending;
    setBusyId(session.id);
    try {
      // Check-out (GPS) không nhận nội dung bài dạy — nộp bài là lệnh gọi
      // riêng ngay sau đó, chạy được cho mọi tiết (kể cả tiết giữa block vừa
      // tự check-out) vì lúc này tiết đã có checkoutAt của chính nó.
      if (mode === "checkout" && position) {
        await teachingSessionApi.checkout(session.id, {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        });
      }
      const updated = await teachingSessionApi.submitLesson(session.id, content);

      toast.success(mode === "checkout" ? "Đã check-out" : "Đã nộp nội dung bài dạy");
      onChanged(updated);
      setPending(null);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Gửi nội dung bài dạy thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  return {
    /** id buổi đang gửi (lấy GPS hoặc đang submit), null khi rảnh. */
    busyId,
    /** Buổi đang mở form nội dung bài dạy, null khi chưa mở. */
    pending,
    openCheckout,
    openLessonOnly,
    cancel,
    submit,
  };
}
