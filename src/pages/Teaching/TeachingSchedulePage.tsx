import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import { ViewSwitcher } from "./components/Shared";
import FreeTeacherTab from "./tabs/FreeTeacherTab";
import SessionTab from "./tabs/SessionTab";
import TimetableTab from "./tabs/TimetableTab";
import { useTeachingRefData } from "./hooks/useTeachingRefData";
import { canManageTeaching } from "./lib";
import BulkScheduleWizard from "./components/BulkScheduleWizard";

type Tab = "timetable" | "sessions" | "freeTeachers";

// Mẫu lịch tuần không còn tab riêng: xem và sửa ngay trên lưới TKB.
const TAB_OPTIONS: [Tab, string][] = [
  ["timetable", "Thời khoá biểu"],
  ["sessions", "Buổi dạy"],
  ["freeTeachers", "GV trống tiết"],
];

export default function TeachingSchedulePage() {
  const { schools, teachers, provinces, wards } = useTeachingRefData();
  const canManage = canManageTeaching();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const focusSessionId = Number(searchParams.get("sessionId")) || undefined;
  const focusScheduleId = Number(searchParams.get("scheduleId")) || undefined;
  const [tab, setTab] = useState<Tab>(
    TAB_OPTIONS.some(([value]) => value === requestedTab)
      ? (requestedTab as Tab)
      : "timetable",
  );
  // Sinh buổi dạy ở TKB → invalidate danh sách buổi dạy.
  const [sessionVersion, setSessionVersion] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <TeachingLayout title="Thời khóa biểu">
      <TeachingTabs />

      {canManage && tab === "timetable" && <button onClick={() => setBulkOpen(true)} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white md:w-auto md:px-5">Áp môn cho nhiều lớp</button>}

      <ViewSwitcher<Tab> value={tab} options={TAB_OPTIONS} onChange={setTab} />

      {tab === "timetable" && (
        <TimetableTab
          teachers={teachers}
          schools={schools}
          canManage={canManage}
          onCreated={() => setSessionVersion((v) => v + 1)}
          // Tới từ màn "Nhập TKB": mở sẵn đúng trường + giáo viên vừa xếp lịch.
          initialSchoolId={searchParams.get("schoolId") || ""}
          initialTeacherId={searchParams.get("teacherId") || ""}
          initialSchoolYear={searchParams.get("schoolYear") || ""}
          focusScheduleId={focusScheduleId}
        />
      )}

      {tab === "sessions" && (
        <SessionTab
          teachers={teachers}
          schools={schools}
          reloadToken={sessionVersion}
          focusSessionId={focusSessionId}
        />
      )}
      {tab === "freeTeachers" && (
        <FreeTeacherTab
          teachers={teachers}
          schools={schools}
          provinces={provinces}
          wards={wards}
        />
      )}

      {bulkOpen && <BulkScheduleWizard teachers={teachers} onClose={() => setBulkOpen(false)} onCreated={() => setSessionVersion((v) => v + 1)} />}
    </TeachingLayout>
  );
}
