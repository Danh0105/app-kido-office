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
    let checkoutCompleted = mode === "lesson-only" || !!session.checkoutAt;
    setBusyId(session.id);
    try {
      // Check-out (GPS) không nhận nội dung bài dạy — nộp bài là lệnh gọi
      // riêng ngay sau đó, chạy được cho mọi tiết (kể cả tiết giữa block vừa
      // tự check-out) vì lúc này tiết đã có checkoutAt của chính nó.
      if (mode === "checkout" && position) {
        const checkedOut = await teachingSessionApi.checkout(session.id, {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        });
        checkoutCompleted = true;
        // `/checkout` và `/lesson` là hai request độc lập. Nếu upload
        // bị ngắt sau bước này, lần bấm lại chỉ được gọi `/lesson`;
        // gọi lại `/checkout` sẽ nhận 409 và khoá luôn đường retry.
        setPending((current) =>
          current?.session.id === session.id
            ? {
                session: checkedOut,
                mode: "lesson-only",
              }
            : current,
        );
      }
      const updated = await teachingSessionApi.submitLesson(session.id, content);
      if (!updated.lessonSubmittedAt) {
        throw new Error(
          "Máy chủ chưa xác nhận đã lưu báo giảng. Vui lòng gửi lại.",
        );
      }

      toast.success("Đã báo giảng thành công");
      onChanged(updated);
      setPending(null);
    } catch (error: any) {
      // Có thể server đã commit nhưng kết nối mất trước khi client
      // nhận response. GET lại là nguồn xác nhận duy nhất; không bao
      // giờ hiển thị thành công chỉ vì request đã được bắt đầu.
      try {
        const latest = await teachingSessionApi.findOne(session.id);
        if (latest.lessonSubmittedAt) {
          toast.success("Đã báo giảng thành công");
          onChanged(latest);
          setPending(null);
          return;
        }
      } catch {
        // Giữ lỗi gốc; việc kiểm tra lại cũng có thể mất mạng.
      }

      if (error?.response?.status !== 403) {
        toast.error(
          checkoutCompleted &&
            (!error?.response || error?.response?.status === 499)
            ? "Kết nối bị gián đoạn khi tải ảnh. Check-out đã lưu nhưng báo giảng chưa được xác nhận; giữ nguyên màn hình và bấm Gửi lại."
            : getApiErrorMessage(error, "Gửi báo giảng thất bại"),
          { duration: 8000 },
        );
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
