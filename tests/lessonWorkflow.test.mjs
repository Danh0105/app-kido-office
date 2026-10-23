import assert from "node:assert/strict";
import test from "node:test";

import { teacherLessonAction } from "../src/pages/Teaching/lessonWorkflow.ts";

const session = (extra = {}) => ({
  checkinRequired: true,
  checkinAt: null,
  checkoutAt: null,
  lessonSubmittedAt: null,
  ...extra,
});

test("tiết chưa check-in bắt đầu ở bước check-in", () => {
  assert.equal(teacherLessonAction(session()), "checkin");
});

test("tiết trong block vẫn phải check-out trước khi báo giảng", () => {
  assert.equal(
    teacherLessonAction(session({ checkinRequired: false })),
    "checkout",
  );
});

test("check-out xong nhưng chưa có lessonSubmittedAt thì chưa hoàn tất", () => {
  assert.equal(
    teacherLessonAction(
      session({ checkinAt: "2026-10-07T13:23:00+07:00", checkoutAt: "2026-10-07T16:30:00+07:00" }),
    ),
    "lesson",
  );
});

test("chỉ coi là xong khi backend trả lessonSubmittedAt", () => {
  assert.equal(
    teacherLessonAction(
      session({
        checkinAt: "2026-10-07T13:23:00+07:00",
        checkoutAt: "2026-10-07T16:30:00+07:00",
        lessonSubmittedAt: "2026-10-07T16:41:00+07:00",
      }),
    ),
    "done",
  );
});
