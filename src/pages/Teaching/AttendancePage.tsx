import { useState } from "react";

import CheckinAlertBanner from "./components/CheckinAlertBanner";
import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import { ViewSwitcher } from "./components/Shared";
import AttendanceTab, { type AttendanceFilter } from "./tabs/AttendanceTab";
import SummaryTab from "./tabs/SummaryTab";
import LessonReportTab from "./tabs/LessonReportTab";
import TravelReviewTab, {
  type TravelReviewFilter,
} from "./tabs/TravelReviewTab";
import { useTeachingRefData } from "./hooks/useTeachingRefData";
import { canSetTeachingRates, TEACHING_MONEY_FEATURES_ENABLED } from "./lib";

type Tab = "attendance" | "report" | "summary" | "travel";

export default function AttendancePage() {
  const { schools, teachers, provinces } = useTeachingRefData();
  // Tính năng tiền vẫn đang ẩn chung, nhưng Nhân sự cần bảng tổng hợp để kiểm
  // tra công và tiền công. Các role khác chỉ thấy tab này khi bật cờ toàn cục.
  const tabOptions: [Tab, string][] = [
    ["attendance", "Chấm công"],
    ["report", "Báo giảng"],
    ...(TEACHING_MONEY_FEATURES_ENABLED || canSetTeachingRates()
      ? ([
          ["summary", "Tổng hợp"],
          ["travel", "Quãng đường"],
        ] as [Tab, string][])
      : []),
  ];
  const [tab, setTab] = useState<Tab>("attendance");
  const [filter, setFilter] = useState<AttendanceFilter | null>(null);
  // Đổi key để AttendanceTab khởi tạo lại state theo bộ lọc bắn từ bảng tổng hợp.
  const [filterVersion, setFilterVersion] = useState(0);

  const drillDown = (next: AttendanceFilter) => {
    setFilter(next);
    setFilterVersion((v) => v + 1);
    setTab("attendance");
  };

  const [travelFilter, setTravelFilter] = useState<TravelReviewFilter | null>(
    null,
  );
  const [travelVersion, setTravelVersion] = useState(0);

  // Bấm số km ở bảng Tổng hợp → mở lộ trình chi tiết đúng giáo viên, đúng kỳ.
  const reviewTravel = (next: TravelReviewFilter) => {
    setTravelFilter(next);
    setTravelVersion((v) => v + 1);
    setTab("travel");
  };

  return (
    <TeachingLayout title="Chấm công">
      <TeachingTabs />

      <CheckinAlertBanner />

      <ViewSwitcher<Tab> value={tab} options={tabOptions} onChange={setTab} />

      {tab === "attendance" ? (
        <AttendanceTab
          key={filterVersion}
          teachers={teachers}
          schools={schools}
          provinces={provinces}
          initialFilter={filter}
        />
      ) : tab === "report" ? (
        <LessonReportTab teachers={teachers} schools={schools} />
      ) : tab === "travel" ? (
        <TravelReviewTab
          key={travelVersion}
          teachers={teachers}
          initialFilter={travelFilter}
        />
      ) : (
        <SummaryTab
          teachers={teachers}
          schools={schools}
          onDrillDown={drillDown}
          onReviewTravel={reviewTravel}
        />
      )}
    </TeachingLayout>
  );
}
