import type { TeachingSession } from "@/types/teaching";

export type TeacherLessonAction = "checkin" | "checkout" | "lesson" | "done";

/**
 * Trạng thái hiển thị cho giáo viên. Backend là nguồn sự thật:
 * check-out và báo giảng là hai bước riêng, nên có `checkoutAt`
 * chưa đủ để coi một tiết là hoàn tất.
 */
export const teacherLessonAction = (
  session: Pick<
    TeachingSession,
    "checkinRequired" | "checkinAt" | "checkoutAt" | "lessonSubmittedAt"
  >,
): TeacherLessonAction => {
  if (session.checkoutAt) {
    return session.lessonSubmittedAt ? "done" : "lesson";
  }
  if (session.checkinRequired && !session.checkinAt) return "checkin";
  return "checkout";
};
