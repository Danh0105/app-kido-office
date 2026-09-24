import { useMemo, useState } from "react";

import { teachingScheduleApi, teachingSessionApi } from "@/service/teaching";
import type {
  ScheduleQuery,
  SessionQuery,
  TeachingSchedule,
  TeachingSession,
} from "@/types/teaching";

import TeachingLayout from "./components/TeachingLayout";
import TeacherTabs from "./components/TeacherTabs";
import SessionDetailDrawer from "./components/SessionDetailDrawer";
import TeacherSummary from "./components/TeacherSummary";
import WeekTemplate from "./components/WeekTemplate";
import {
  SessionDayCalendar,
  SessionMonthCalendar,
  SessionWeekCalendar,
} from "./components/SessionViews";
import {
  EmptyState,
  Loading,
  RangeNav,
  StatusLegend,
  ViewSwitcher,
} from "./components/Shared";
import { usePagedList } from "./hooks/usePagedList";
import {
  addDays,
  addMonths,
  datesInRange,
  dayTitle,
  endOfMonth,
  endOfWeek,
  monthGridDates,
  monthTitle,
  plannedFromSchedules,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekTitle,
} from "./lib";

const PAGE_SIZE = 200;

/** Mẫu lịch tuần đang áp dụng — hằng số để hook không tải lại mỗi lần render. */
const TEMPLATE_QUERY: ScheduleQuery = { isActive: true };
const TEMPLATE_PAGE_SIZE = 100;

type ViewMode = "day" | "week" | "month" | "summary" | "template";

const VIEW_OPTIONS: [ViewMode, string][] = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  ["month", "Tháng"],
  ["summary", "Tổng hợp"],
  // Mẫu lịch lặp hàng tuần Nhân sự xếp — không gắn với khoảng ngày nào.
  ["template", "Cố định"],
];

/** Lịch dạy của tôi — chỉ đọc, dành cho role giaovien. */
export default function MySchedulePage() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [selected, setSelected] = useState<TeachingSession | null>(null);

  const { fromDate, toDate } = useMemo(() => {
    if (view === "day") {
      return { fromDate: anchor, toDate: anchor };
    }
    if (view === "month") {
      const cells = monthGridDates(anchor);
      return { fromDate: cells[0], toDate: cells[cells.length - 1] };
    }
    // Tổng hợp tính trọn tháng, không lấy ngày bù đầu/cuối như lưới lịch.
    if (view === "summary") {
      return { fromDate: startOfMonth(anchor), toDate: endOfMonth(anchor) };
    }
    return { fromDate: startOfWeek(anchor), toDate: endOfWeek(anchor) };
  }, [view, anchor]);

  const query = useMemo<SessionQuery>(
    () => ({ fromDate, toDate }),
    [fromDate, toDate],
  );

  const { items, loading, notFound, reload } = usePagedList<
    TeachingSession,
    SessionQuery
  >(
    {
      fetcher: teachingSessionApi.me,
      query,
      limit: PAGE_SIZE,
      // Chế độ "Cố định" đọc mẫu lịch, không cần buổi dạy theo khoảng ngày.
      enabled: view !== "template",
      errorMessage: "Không tải được lịch dạy",
      // 404 = tài khoản chưa gắn hồ sơ giáo viên → empty state, không phải màn lỗi.
      treat404AsEmpty: true,
    },
  );

  const isCalendar = view === "day" || view === "week" || view === "month";

  // Mẫu lịch tuần để vẽ kèm các buổi Nhân sự chưa sinh; chỉ 3 chế độ lịch mới cần.
  const { items: schedules } = usePagedList<TeachingSchedule, ScheduleQuery>({
    fetcher: teachingScheduleApi.me,
    query: TEMPLATE_QUERY,
    limit: TEMPLATE_PAGE_SIZE,
    enabled: isCalendar,
    errorMessage: "Không tải được lịch tuần cố định",
    treat404AsEmpty: true,
  });

  const planned = useMemo(
    () =>
      isCalendar
        ? plannedFromSchedules(schedules, datesInRange(fromDate, toDate), items)
        : [],
    [isCalendar, schedules, fromDate, toDate, items],
  );

  const calendarSessions = useMemo(
    () => [...items, ...planned],
    [items, planned],
  );

  /** Lùi/tiến 1 ngày, 1 tuần hoặc 1 tháng theo chế độ đang xem. */
  const shift = (direction: 1 | -1) => {
    if (view === "day") return setAnchor(addDays(anchor, direction));
    if (view === "week") return setAnchor(addDays(anchor, 7 * direction));
    setAnchor(addMonths(anchor, direction));
  };

  const navTitle =
    view === "day"
      ? dayTitle(anchor)
      : view === "week"
      ? weekTitle(anchor)
      : monthTitle(anchor);

  return (
    <TeachingLayout title="Lịch dạy của tôi">
      <TeacherTabs />

      {notFound ? (
          <EmptyState
            icon="🧑‍🏫"
            title="Chưa có hồ sơ giáo viên"
            description="Tài khoản của bạn chưa được phòng Nhân sự gắn với hồ sơ giáo viên. Vui lòng liên hệ phòng Nhân sự."
          />
        ) : (
          <>
            {/* Desktop: chế độ xem và điều hướng kỳ nằm chung một hàng */}
            <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
              <ViewSwitcher<ViewMode>
                value={view}
                options={VIEW_OPTIONS}
                onChange={setView}
              />

              {/* Lịch tuần cố định lặp lại mọi tuần → không có kỳ để lùi/tiến. */}
              {view !== "template" && (
                <div className="md:flex-1">
                  <RangeNav
                    title={navTitle}
                    onPrev={() => shift(-1)}
                    onNext={() => shift(1)}
                    onToday={() => setAnchor(todayISO())}
                  />
                </div>
              )}
            </div>

            {loading && <Loading />}

            {loading || !isCalendar ? null : (
              <StatusLegend planned={planned.length > 0} />
            )}

            {!loading && (
              <>
                {view === "day" && (
                  <SessionDayCalendar
                    anchorDate={anchor}
                    sessions={calendarSessions}
                    onSelect={setSelected}
                    showTeacher={false}
                  />
                )}
                {view === "week" && (
                  <SessionWeekCalendar
                    anchorDate={anchor}
                    sessions={calendarSessions}
                    onSelect={setSelected}
                    showTeacher={false}
                  />
                )}
                {view === "month" && (
                  <SessionMonthCalendar
                    anchorDate={anchor}
                    sessions={calendarSessions}
                    onSelect={setSelected}
                    showTeacher={false}
                  />
                )}
                {view === "summary" && (
                  <TeacherSummary sessions={items} rangeLabel={navTitle} />
                )}
                {view === "template" && <WeekTemplate />}

                {isCalendar && calendarSessions.length === 0 && (
                  <p className="text-xs text-gray-400 text-center px-4">
                    Bạn không có buổi dạy nào trong khoảng thời gian này.
                  </p>
                )}
              </>
            )}
          </>
        )}

      {selected && (
        <SessionDetailDrawer
          session={selected}
          canManage={false}
          canCheckin
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </TeachingLayout>
  );
}
