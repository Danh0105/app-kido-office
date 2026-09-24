import { useMemo, useState } from "react";

import { teachingScheduleApi } from "@/service/teaching";
import {
  DAY_OF_WEEK_OPTIONS,
  dayOfWeekLabel,
  type ScheduleQuery,
  type TeachingSchedule,
} from "@/types/teaching";

import { ActiveBadge } from "./SessionStatusBadge";
import { EmptyState, Loading, Pagination, ViewSwitcher } from "./Shared";
import { usePagedList } from "../hooks/usePagedList";
import { formatDate, formatTime, periodsOf, todayISO } from "../lib";

const PAGE_SIZE = 50;

type Filter = "active" | "all";

const FILTER_OPTIONS: [Filter, string][] = [
  ["active", "Đang áp dụng"],
  ["all", "Tất cả"],
];

/** Mẫu lịch đang có hiệu lực hôm nay — mẫu ngừng / hết hạn không tính vào định mức tuần. */
const isInEffect = (schedule: TeachingSchedule, today: string) =>
  schedule.isActive &&
  schedule.effectiveFrom <= today &&
  (!schedule.effectiveTo || schedule.effectiveTo >= today);

/**
 * Lịch tuần cố định của chính giáo viên — chỉ đọc, là một chế độ xem của
 * "Lịch dạy của tôi". Mẫu lịch do phòng Nhân sự xếp; buổi dạy thực tế
 * (kể cả buổi lẻ, dạy bù) vẫn nằm ở các chế độ xem theo ngày/tuần/tháng.
 */
export default function WeekTemplate() {
  const [filter, setFilter] = useState<Filter>("active");
  const today = todayISO();

  const query = useMemo<ScheduleQuery>(
    () => ({ isActive: filter === "active" ? true : undefined }),
    [filter],
  );

  const { items, pagination, page, setPage, loading, notFound } = usePagedList<
    TeachingSchedule,
    ScheduleQuery
  >({
    fetcher: teachingScheduleApi.me,
    query,
    limit: PAGE_SIZE,
    errorMessage: "Không tải được lịch tuần cố định",
    // 404 = tài khoản chưa gắn hồ sơ giáo viên → empty state, không phải màn lỗi.
    treat404AsEmpty: true,
  });

  // BE đã sắp theo thứ rồi giờ bắt đầu, ở đây chỉ gom lại theo thứ.
  const days = useMemo(
    () =>
      DAY_OF_WEEK_OPTIONS.map((day) => ({
        ...day,
        rows: items.filter((item) => item.dayOfWeek === day.value),
      })).filter((day) => day.rows.length > 0),
    [items],
  );

  const inEffect = useMemo(
    () => items.filter((item) => isInEffect(item, today)),
    [items, today],
  );

  const periodsPerWeek = useMemo(
    () => inEffect.reduce((sum, item) => sum + periodsOf(item), 0),
    [inEffect],
  );

  if (notFound) {
    return (
      <EmptyState
        icon="🧑‍🏫"
        title="Chưa có hồ sơ giáo viên"
        description="Tài khoản của bạn chưa được phòng Nhân sự gắn với hồ sơ giáo viên. Vui lòng liên hệ phòng Nhân sự."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
        <ViewSwitcher<Filter>
          value={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
        />

        {!loading && inEffect.length > 0 && (
          <p className="text-xs text-gray-500 px-1 md:px-0">
            Tuần này có <b className="text-gray-700">{inEffect.length}</b> buổi cố
            định · <b className="text-gray-700">{periodsPerWeek}</b> tiết
          </p>
        )}
      </div>

      {loading && <Loading />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon="🗓️"
          title={
            filter === "active"
              ? "Chưa có lịch tuần cố định"
              : "Chưa có mẫu lịch nào"
          }
          description="Phòng Nhân sự chưa xếp lịch lặp hàng tuần cho bạn. Các buổi dạy đã được phân công vẫn hiện ở chế độ xem Ngày / Tuần / Tháng."
          action={
            filter === "active" ? (
              <button
                onClick={() => setFilter("all")}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:scale-95"
              >
                Xem cả mẫu đã ngừng
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 md:items-start">
            {days.map((day) => (
              <DayCard
                key={day.value}
                label={dayOfWeekLabel(day.value)}
                rows={day.rows}
                today={today}
              />
            ))}
          </div>

          <p className="text-[11px] text-gray-400 text-center px-4 leading-relaxed">
            Lịch tuần cố định do phòng Nhân sự xếp. Buổi dạy thực tế — kể cả buổi
            lẻ và dạy bù — xem ở chế độ Ngày / Tuần / Tháng.
          </p>
        </>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={setPage}
      />
    </div>
  );
}

/** Các buổi cố định của một thứ trong tuần. */
function DayCard({
  label,
  rows,
  today,
}: {
  label: string;
  rows: TeachingSchedule[];
  today: string;
}) {
  const periods = rows
    .filter((row) => isInEffect(row, today))
    .reduce((sum, row) => sum + periodsOf(row), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        {periods > 0 && (
          <span className="text-[11px] text-gray-400">{periods} tiết</span>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {rows.map((row) => (
          <ScheduleRow key={row.id} schedule={row} today={today} />
        ))}
      </div>
    </div>
  );
}

function ScheduleRow({
  schedule,
  today,
}: {
  schedule: TeachingSchedule;
  today: string;
}) {
  const expired = !!schedule.effectiveTo && schedule.effectiveTo < today;
  const notStarted = schedule.effectiveFrom > today;
  const dimmed = !schedule.isActive || expired;

  return (
    <div className={`px-3 py-2.5 flex gap-3 ${dimmed ? "opacity-60" : ""}`}>
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold text-gray-800">
          {formatTime(schedule.startTime)}
        </p>
        <p className="text-[11px] text-gray-400">
          {formatTime(schedule.endTime)}
        </p>
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800 truncate">
            Môn {schedule.subjectName}
          </p>
          {!schedule.isActive && (
            <ActiveBadge active={false} inactiveLabel="Ngừng áp dụng" />
          )}
          {schedule.isActive && expired && (
            <span className="inline-block text-[10px] px-2 py-[2px] rounded-full font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
              Hết hiệu lực
            </span>
          )}
          {schedule.isActive && notStarted && (
            <span className="inline-block text-[10px] px-2 py-[2px] rounded-full font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
              Chưa bắt đầu
            </span>
          )}
        </div>

        {/* Giáo viên cần biết vào lớp nào, không chỉ trường nào. */}
        <p className="text-xs text-gray-600 truncate">
          {schedule.schoolName}
          {schedule.className && (
            <span className="font-medium text-gray-800">
              {" "}
              · {schedule.className}
            </span>
          )}
          {schedule.schoolYear && (
            <span className="text-gray-400"> · {schedule.schoolYear}</span>
          )}
        </p>

        <p className="text-[11px] text-gray-400">
          {periodsOf(schedule)} tiết · Hiệu lực{" "}
          {formatDate(schedule.effectiveFrom)} →{" "}
          {schedule.effectiveTo
            ? formatDate(schedule.effectiveTo)
            : "không thời hạn"}
        </p>

        {schedule.note && (
          <p className="text-[11px] text-gray-400">Ghi chú: {schedule.note}</p>
        )}
      </div>
    </div>
  );
}
