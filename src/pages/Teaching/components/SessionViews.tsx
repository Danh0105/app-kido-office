import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Plus } from "lucide-react";

import {
  DAY_OF_WEEK_OPTIONS,
  SESSION_STATUS_META,
  type CalendarSession,
  type TeachingSession,
} from "@/types/teaching";

import SessionStatusBadge, {
  ApplicationBadge,
  AssignmentBadge,
  CheckinBadge,
  MakeupBadge,
} from "./SessionStatusBadge";
import ScheduleResponseBadge from "./ScheduleResponseBadge";
import {
  classNameOf,
  dayOfWeekOf,
  dayTitle,
  formatCheckedAt,
  formatDate,
  formatFuelAllowance,
  formatMoney,
  formatTime,
  hasGasAllowance,
  fromISODate,
  minutesOfTime,
  monthGridDates,
  nowMinutes,
  schoolWithClass,
  startOfMonth,
  TEACHING_MONEY_FEATURES_ENABLED,
  timeFromMinutes,
  todayISO,
  weekDates,
} from "../lib";
import {
  TableCard,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "./Shared";

// ================= HẰNG SỐ LƯỚI LỊCH =================

/** Chiều cao 1 giờ trên lưới ngày/tuần (px). */
const HOUR_HEIGHT = 56;
/** Khối buổi dạy ngắn vẫn phải đủ cao để bấm được. */
const MIN_BLOCK_HEIGHT = 22;
/** Buổi thiếu giờ kết thúc → coi như dài 45 phút. */
const FALLBACK_DURATION = 45;
/** Lưới tuần hẹp hơn mức này thì cuộn ngang (7 cột ~70px + cột giờ). */
const WEEK_MIN_WIDTH = 540;
/** Bấm ô trống để thêm buổi: làm tròn giờ bắt đầu về mốc 30 phút. */
const SLOT_SNAP = 30;
/** Độ dài buổi mặc định khi tạo từ lịch — khớp mặc định 07:30–09:00 của form. */
const DEFAULT_DURATION = 90;

/**
 * Dòng phụ trong ô buổi dạy trên lưới lịch. Màn Nhân sự cần biết ai dạy lớp nào;
 * màn giáo viên chỉ mình họ dạy nên hiện trường + lớp.
 */
const blockSubtitle = (session: CalendarSession, showTeacher: boolean) =>
  showTeacher
    ? [session.teacherName, session.className].filter(Boolean).join(" · ")
    : schoolWithClass(session);

/** Tạo buổi mới từ lịch: bấm ô giờ trống (lưới ngày/tuần) hoặc ô ngày (lịch tháng). */
export type CreateAtSlot = (
  date: string,
  startTime?: string,
  endTime?: string,
) => void;

export const groupByDate = (sessions: CalendarSession[]) => {
  const map = new Map<string, CalendarSession[]>();
  sessions.forEach((s) => {
    const list = map.get(s.date) || [];
    list.push(s);
    map.set(s.date, list);
  });
  map.forEach((list) =>
    list.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
  );
  return map;
};

const shortLabel = (date: string) =>
  DAY_OF_WEEK_OPTIONS.find((d) => d.value === dayOfWeekOf(date))?.short || "";

/** Chủ Nhật tô đỏ nhạt như lịch giấy. */
const isSunday = (date: string) => dayOfWeekOf(date) === 8;

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Cập nhật mỗi phút để vạch "bây giờ" bò theo thời gian thực. */
function useNowMinutes() {
  const [value, setValue] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setValue(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);
  return value;
}

// ================= XẾP CHỖ KHỐI BUỔI DẠY =================

type TimedBlock = {
  session: CalendarSession;
  start: number;
  end: number;
  /** Cột thứ mấy trong cụm buổi trùng giờ. */
  col: number;
  /** Tổng số cột của cụm — quyết định bề ngang mỗi khối. */
  cols: number;
};

/** Khoảng giờ hiển thị: bám dữ liệu, đệm 1 giờ hai đầu, tối thiểu 5 giờ. */
function hourRange(sessions: CalendarSession[]) {
  let min = Infinity;
  let max = -Infinity;

  sessions.forEach((s) => {
    const start = minutesOfTime(s.startTime);
    if (start == null) return;
    const end = minutesOfTime(s.endTime);
    min = Math.min(min, start);
    max = Math.max(max, end != null && end > start ? end : start + FALLBACK_DURATION);
  });

  if (!Number.isFinite(min)) return { startHour: 7, endHour: 18 };

  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(24, Math.max(Math.ceil(max / 60) + 1, startHour + 5));
  return { startHour, endHour };
}

/** Buổi trùng giờ chia đôi/ba chiều ngang — giống Google Calendar. */
function layoutDay(list: CalendarSession[]): TimedBlock[] {
  type Item = { session: CalendarSession; start: number; end: number };

  const timed = list
    .map((session): Item | null => {
      const start = minutesOfTime(session.startTime);
      if (start == null) return null;
      const rawEnd = minutesOfTime(session.endTime);
      const end =
        rawEnd == null || rawEnd <= start ? start + FALLBACK_DURATION : rawEnd;
      return { session, start, end };
    })
    .filter((item): item is Item => item !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const blocks: TimedBlock[] = [];
  let cluster: Item[] = [];
  let clusterEnd = -1;

  // Một cụm = các buổi dính nhau liên tiếp; hết cụm mới biết tổng số cột.
  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((item) => {
      let col = colEnds.findIndex((end) => end <= item.start);
      if (col === -1) col = colEnds.length;
      colEnds[col] = item.end;
      return { ...item, col };
    });
    placed.forEach((item) => blocks.push({ ...item, cols: colEnds.length }));
    cluster = [];
    clusterEnd = -1;
  };

  timed.forEach((item) => {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  });
  if (cluster.length) flush();

  return blocks;
}

// ================= LƯỚI NGÀY / TUẦN =================

type TimeGridProps = {
  dates: string[];
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  /** Có hàm này = bấm ô giờ trống để thêm buổi (chỉ role được quản lý). */
  onCreate?: CreateAtSlot;
  /** Màn "Lịch dạy của tôi" không cần lặp lại tên giáo viên. */
  showTeacher?: boolean;
  minWidth?: number;
};

function TimeGrid({
  dates,
  sessions,
  onSelect,
  onCreate,
  showTeacher = true,
  minWidth = 0,
}: TimeGridProps) {
  const byDate = useMemo(() => groupByDate(sessions), [sessions]);
  const { startHour, endHour } = useMemo(() => hourRange(sessions), [sessions]);
  const now = useNowMinutes();
  const today = todayISO();

  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const gridHeight = hours.length * HOUR_HEIGHT;
  const gridStart = startHour * 60;

  // Buổi thiếu giờ bắt đầu không đặt được lên lưới → xếp vào hàng "chưa rõ giờ".
  const untimed = sessions.filter((s) => minutesOfTime(s.startTime) == null);
  const untimedByDate = groupByDate(untimed);

  /** Bấm vào chỗ trống của cột ngày → tạo buổi đúng ngày & khung giờ vừa bấm. */
  const handleSlotClick = (date: string, event: MouseEvent<HTMLDivElement>) => {
    if (!onCreate) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = gridStart + ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
    const start = Math.max(
      gridStart,
      Math.round(minutes / SLOT_SNAP) * SLOT_SNAP,
    );

    onCreate(
      date,
      timeFromMinutes(start),
      timeFromMinutes(start + DEFAULT_DURATION),
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[70vh]">
        <div style={{ minWidth }}>
          {/* Hàng ngày — dính khi cuộn dọc */}
          <div className="sticky top-0 z-20 flex bg-white border-b border-gray-100">
            <div className="w-12 shrink-0 sticky left-0 z-10 bg-white" />
            {dates.map((date) => {
              const dayList = byDate.get(date) || [];
              const count = dayList.filter((s) => !s.fromTemplate).length;
              const plannedCount = dayList.length - count;
              const isNow = date === today;
              const d = fromISODate(date);

              return (
                <div
                  key={date}
                  className="flex-1 min-w-0 border-l border-gray-100 py-1.5 text-center"
                >
                  <p
                    className={`text-[10px] font-medium ${
                      isNow
                        ? "text-blue-600"
                        : isSunday(date)
                        ? "text-rose-400"
                        : "text-gray-400"
                    }`}
                  >
                    {shortLabel(date)}
                  </p>
                  <p
                    className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                      isNow ? "bg-blue-500 text-white" : "text-gray-700"
                    }`}
                  >
                    {d.getDate()}
                  </p>
                  <p className="text-[9px] text-gray-400 h-3">
                    {count > 0
                      ? `${count} buổi`
                      : plannedCount > 0
                      ? `${plannedCount} dự kiến`
                      : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Hàng buổi chưa rõ giờ */}
          {untimed.length > 0 && (
            <div className="flex border-b border-gray-100 bg-gray-50/60">
              <div className="w-12 shrink-0 sticky left-0 z-10 bg-gray-50 flex items-center justify-end pr-1">
                <span className="text-[9px] text-gray-400">Chưa rõ</span>
              </div>
              {dates.map((date) => (
                <div
                  key={date}
                  className="flex-1 min-w-0 border-l border-gray-100 p-0.5 space-y-0.5"
                >
                  {(untimedByDate.get(date) || []).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => onSelect(session)}
                      className={`w-full truncate rounded border-l-[3px] px-1 py-0.5 text-left text-[10px] font-medium ${
                        SESSION_STATUS_META[session.status]?.event
                      }`}
                    >
                      {session.subjectName}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Lưới giờ */}
          <div className="flex">
            {/* Cột giờ — dính khi cuộn ngang */}
            <div
              className="w-12 shrink-0 sticky left-0 z-10 bg-white"
              style={{ height: gridHeight }}
            >
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  {/* Nhãn giờ nằm trên vạch kẻ; giờ đầu tiên không có vạch nên hạ xuống. */}
                  <span
                    className={`absolute right-1 text-[9px] text-gray-400 ${
                      index === 0 ? "top-0.5" : "-top-1.5"
                    }`}
                  >
                    {hourLabel(hour)}
                  </span>
                </div>
              ))}
            </div>

            {dates.map((date) => {
              const blocks = layoutDay(byDate.get(date) || []);
              const isNow = date === today;
              const nowTop = ((now - gridStart) / 60) * HOUR_HEIGHT;
              const showNow = isNow && now >= gridStart && now <= endHour * 60;

              return (
                <div
                  key={date}
                  onClick={(e) => handleSlotClick(date, e)}
                  title={onCreate ? "Bấm để thêm buổi dạy vào khung giờ này" : undefined}
                  className={`relative flex-1 min-w-0 border-l border-gray-100 ${
                    isNow ? "bg-blue-50/40" : ""
                  } ${onCreate ? "cursor-pointer" : ""}`}
                  style={{ height: gridHeight }}
                >
                  {hours.map((hour, index) =>
                    index === 0 ? null : (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                        style={{ top: index * HOUR_HEIGHT }}
                      />
                    ),
                  )}

                  {blocks.map((block) => {
                    const meta = SESSION_STATUS_META[block.session.status];
                    const top = ((block.start - gridStart) / 60) * HOUR_HEIGHT;
                    const height = Math.max(
                      ((block.end - block.start) / 60) * HOUR_HEIGHT,
                      MIN_BLOCK_HEIGHT,
                    );
                    const width = 100 / block.cols;
                    const box = {
                      top,
                      height,
                      left: `${block.col * width}%`,
                      width: `calc(${width}% - 3px)`,
                    };

                    // Ô theo mẫu lịch: dùng xanh nhạt để lịch dạy dự kiến vẫn dễ nhận ra,
                    // giữ nét đứt để phân biệt với buổi thật và lọt chuột xuống ô giờ.
                    // (Nhân sự bấm vào vẫn mở form thêm buổi đúng khung giờ đó).
                    if (block.session.fromTemplate) {
                      const rejected = block.session.rejectedTemplate;
                      const TemplateTag = rejected ? "button" : "div";
                      return (
                        <TemplateTag
                          key={block.session.id}
                          style={box}
                          onClick={rejected ? (event) => {
                            event.stopPropagation();
                            onSelect(block.session);
                          } : undefined}
                          className={`absolute overflow-hidden rounded-md border-2 border-dashed px-1.5 py-0.5 text-left shadow-sm ${
                            rejected ? "cursor-pointer active:scale-[0.98]" : "pointer-events-none"
                          } ${
                            rejected
                              ? "border-rose-500 bg-rose-100 text-rose-900"
                              : "border-blue-400 bg-blue-50 text-blue-900"
                          }`}
                        >
                          <p className="text-[9px] font-semibold leading-tight truncate">
                            {formatTime(block.session.startTime)}
                            {height >= 34
                              ? `–${formatTime(block.session.endTime)}`
                              : ""}
                          </p>
                          {height >= 34 && (
                            <p className="text-[10px] font-medium leading-tight truncate">
                              {rejected ? "TỪ CHỐI · " : ""}{block.session.subjectName}
                            </p>
                          )}
                          {height >= 50 && (
                            <p className="text-[10px] leading-tight truncate">
                              {blockSubtitle(block.session, showTeacher)}
                            </p>
                          )}
                        </TemplateTag>
                      );
                    }

                    return (
                      <button
                        key={block.session.id}
                        onClick={(e) => {
                          // Chặn nổi bọt để không mở luôn form thêm buổi của ô trống.
                          e.stopPropagation();
                          onSelect(block.session);
                        }}
                        style={box}
                        className={`absolute overflow-hidden rounded-md border-l-[3px] px-1 py-0.5 text-left shadow-sm active:scale-[0.98] transition ${meta?.event}`}
                      >
                        <p
                          className={`text-[9px] font-semibold leading-tight truncate ${
                            meta?.strike ? "line-through" : ""
                          }`}
                        >
                          {formatTime(block.session.startTime)}
                          {height >= 34
                            ? `–${formatTime(block.session.endTime)}`
                            : ""}
                          {block.session.isMakeup && (
                            <span className="ml-1 text-[8px] font-bold text-purple-600">
                              BÙ
                            </span>
                          )}
                        </p>
                        {height >= 34 && (
                          <p className="text-[10px] font-medium leading-tight truncate">
                            {block.session.subjectName}
                          </p>
                        )}
                        <span className="absolute right-1 top-1">
                          <ScheduleResponseBadge session={block.session} compact />
                        </span>
                        {height >= 50 && (
                          <p className="text-[10px] leading-tight truncate opacity-70">
                            {blockSubtitle(block.session, showTeacher)}
                          </p>
                        )}
                      </button>
                    );
                  })}

                  {showNow && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: nowTop }}
                    >
                      <div className="relative border-t-2 border-red-500">
                        <span className="absolute -left-1 -top-[5px] w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lịch tuần: 7 cột T2 → CN, buổi dạy nằm đúng khung giờ. */
export function SessionWeekCalendar({
  anchorDate,
  sessions,
  onSelect,
  onCreate,
  showTeacher = true,
}: {
  anchorDate: string;
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  onCreate?: CreateAtSlot;
  showTeacher?: boolean;
}) {
  return (
    <TimeGrid
      dates={weekDates(anchorDate)}
      sessions={sessions}
      onSelect={onSelect}
      onCreate={onCreate}
      showTeacher={showTeacher}
      minWidth={WEEK_MIN_WIDTH}
    />
  );
}

/** Lịch ngày: 1 cột duy nhất, đủ rộng để đọc tên môn / giáo viên. */
export function SessionDayCalendar({
  anchorDate,
  sessions,
  onSelect,
  onCreate,
  showTeacher = true,
}: {
  anchorDate: string;
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  onCreate?: CreateAtSlot;
  showTeacher?: boolean;
}) {
  const list = sessions.filter((s) => s.date === anchorDate);
  return (
    <TimeGrid
      dates={[anchorDate]}
      sessions={list}
      onSelect={onSelect}
      onCreate={onCreate}
      showTeacher={showTeacher}
    />
  );
}

// ================= DANH SÁCH BUỔI TRONG NGÀY =================

/** Một dòng lịch trình: giờ bên trái, vạch màu trạng thái, nội dung buổi. */
export function AgendaRow({
  session,
  onClick,
  showTeacher = true,
}: {
  session: CalendarSession;
  onClick?: () => void;
  showTeacher?: boolean;
}) {
  const meta = SESSION_STATUS_META[session.status];
  const subtitle = [
    schoolWithClass(session),
    showTeacher ? session.teacherName || "Chưa phân công" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Ô theo mẫu lịch tuần: chưa có buổi thật nên không mở được chi tiết.
  if (session.fromTemplate) {
    return (
      <div className="w-full flex items-stretch gap-2 px-2 py-2">
        <div className="w-11 shrink-0 text-right">
          <p className="text-xs font-semibold text-blue-700">
            {formatTime(session.startTime)}
          </p>
          <p className="text-[10px] text-blue-500">
            {formatTime(session.endTime)}
          </p>
        </div>

        <span className="w-1 rounded-full shrink-0 border border-dashed border-blue-400 bg-blue-100" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 truncate">
            {session.subjectName}
          </p>
          <p className="text-xs text-blue-700 truncate">{subtitle}</p>
        </div>

        <span className="self-center inline-block text-[10px] px-2 py-[2px] rounded-full font-semibold border border-dashed border-blue-400 bg-blue-50 text-blue-700 whitespace-nowrap">
          Lịch cố định
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-stretch gap-2 text-left px-2 py-2 rounded-xl hover:bg-blue-50/60 active:scale-[0.99] transition"
    >
      <div className="w-11 shrink-0 text-right">
        <p
          className={`text-xs font-semibold text-gray-700 ${
            meta?.strike ? "line-through" : ""
          }`}
        >
          {formatTime(session.startTime)}
        </p>
        <p className="text-[10px] text-gray-400">
          {formatTime(session.endTime)}
        </p>
      </div>

      <span className={`w-1 rounded-full shrink-0 ${meta?.dot}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <p className="text-sm font-medium text-gray-800 truncate">
            {session.subjectName}
          </p>
          {session.isMakeup && (
            <MakeupBadge forSessionId={session.makeupForSessionId} />
          )}
          {session.checkinAt && (
            <CheckinBadge
                  checkedOut={!!session.checkoutAt}
                  outOfRange={
                    session.checkinOutOfRange || session.checkoutOutOfRange
                  }
                />
          )}
          <ScheduleResponseBadge session={session} />
        </div>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>

      <SessionStatusBadge
        status={session.status}
        label={session.statusLabel}
        className="self-center"
      />
    </button>
  );
}

/** Lịch trình của một ngày — dùng dưới lịch tháng. */
export function SessionAgenda({
  date,
  sessions,
  onSelect,
  onCreate,
  showTeacher = true,
}: {
  date: string;
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  onCreate?: CreateAtSlot;
  showTeacher?: boolean;
}) {
  const list = sessions.filter((s) => s.date === date);
  const real = list.filter((s) => !s.fromTemplate).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
      <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-1 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {dayTitle(date)}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">
            {[
              real > 0 ? `${real} buổi` : "",
              list.length - real > 0 ? `${list.length - real} dự kiến` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {onCreate && (
            <button
              onClick={() => onCreate(date)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium active:scale-95"
            >
              <Plus size={14} /> Thêm buổi
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          Không có buổi dạy nào trong ngày này
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {list.map((session) => (
            <AgendaRow
              key={session.id}
              session={session}
              showTeacher={showTeacher}
              onClick={() => onSelect(session)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ================= LỊCH THÁNG =================

/** Lịch tháng + lịch trình của ngày đang chọn (mặc định hôm nay). */
export function SessionMonthCalendar({
  anchorDate,
  sessions,
  onSelect,
  onCreate,
  showTeacher = true,
}: {
  anchorDate: string;
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  onCreate?: CreateAtSlot;
  showTeacher?: boolean;
}) {
  const monthStart = startOfMonth(anchorDate);
  const dates = monthGridDates(anchorDate);
  const byDate = useMemo(() => groupByDate(sessions), [sessions]);
  const today = todayISO();
  const month = fromISODate(monthStart).getMonth();

  // Đổi tháng → chọn lại hôm nay nếu còn trong tháng, không thì ngày 1.
  const defaultDay = () =>
    fromISODate(today).getMonth() === month &&
    fromISODate(today).getFullYear() === fromISODate(monthStart).getFullYear()
      ? today
      : monthStart;

  const [selected, setSelected] = useState(defaultDay);
  useEffect(() => {
    setSelected(defaultDay());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart]);

  // Ô trống (hoặc bấm lại ngày đang chọn) → thêm buổi ngay cho ngày đó.
  // Ô có buổi → lần bấm đầu mở lịch trình bên dưới để xem trước đã.
  const handleDayClick = (date: string) => {
    const isEmpty = (byDate.get(date) || []).length === 0;
    setSelected(date);
    if (onCreate && (isEmpty || date === selected)) onCreate(date);
  };

  return (
    // Desktop rộng: lịch bên trái, lịch trình ngày đang chọn nằm cạnh bên phải.
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[1fr_340px] lg:gap-3 lg:items-start">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_OF_WEEK_OPTIONS.map((d) => (
            <div
              key={d.value}
              className={`text-[10px] font-semibold text-center py-1.5 ${
                d.value === 8 ? "text-rose-400" : "text-gray-400"
              }`}
            >
              {d.short}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const list = byDate.get(date) || [];
            const inMonth = fromISODate(date).getMonth() === month;
            const isNow = date === today;
            const isSelected = date === selected;

            return (
              // Ô ngày là div (không phải button) vì bên trong có nút mở chi tiết buổi.
              <div
                key={date}
                role="button"
                tabIndex={0}
                onClick={() => handleDayClick(date)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  handleDayClick(date);
                }}
                title={
                  onCreate
                    ? isSelected || list.length === 0
                      ? "Bấm để thêm buổi dạy ngày này"
                      : "Bấm để xem lịch trình ngày này"
                    : undefined
                }
                className={`min-h-[62px] sm:min-h-[92px] lg:min-h-[104px] border-b border-r border-gray-50 p-1 text-left transition cursor-pointer ${
                  isSelected ? "bg-blue-50/70" : "hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] ${
                    isNow
                      ? "bg-blue-500 text-white font-semibold"
                      : isSelected
                      ? "bg-blue-100 text-blue-700 font-semibold"
                      : !inMonth
                      ? "text-gray-300"
                      : isSunday(date)
                      ? "text-rose-400"
                      : "text-gray-700"
                  }`}
                >
                  {fromISODate(date).getDate()}
                </span>

                {/* Điện thoại: chấm màu trạng thái. Từ sm: nhãn giờ + môn. */}
                <div className="mt-1 flex flex-wrap gap-[3px] sm:hidden">
                  {list.slice(0, 4).map((session) => (
                    <span
                      key={session.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        session.fromTemplate
                          ? "border border-blue-500 bg-blue-100"
                          : SESSION_STATUS_META[session.status]?.dot
                      }`}
                    />
                  ))}
                  {list.length > 4 && (
                    <span className="text-[8px] leading-none text-gray-400">
                      +{list.length - 4}
                    </span>
                  )}
                </div>

                <div className="mt-1 hidden sm:block space-y-[2px]">
                  {list.slice(0, 3).map((session) => {
                    const meta = SESSION_STATUS_META[session.status];

                    if (session.fromTemplate && !session.rejectedTemplate) {
                      return (
                        <span
                          key={session.id}
                          className="block w-full truncate rounded border border-dashed border-blue-400 bg-blue-50 px-1 text-left text-[9px] font-medium leading-4 text-blue-800"
                        >
                          {formatTime(session.startTime)} {session.subjectName}
                        </span>
                      );
                    }

                    return (
                      <button
                        key={session.id}
                        onClick={(e) => {
                          // Bấm vào buổi = xem chi tiết, không phải chọn/thêm ngày.
                          e.stopPropagation();
                          onSelect(session);
                        }}
                        className={`block w-full truncate rounded border-l-2 px-1 text-left text-[9px] leading-4 ${meta?.event} ${
                          meta?.strike ? "line-through" : ""
                        }`}
                      >
                        {formatTime(session.startTime)} {session.subjectName}
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <span className="block pl-1 text-[9px] text-gray-400">
                      +{list.length - 3} buổi
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:sticky lg:top-[72px]">
        <SessionAgenda
          date={selected}
          sessions={sessions}
          onSelect={onSelect}
          onCreate={onCreate}
          showTeacher={showTeacher}
        />
      </div>
    </div>
  );
}

// ================= DẠNG DANH SÁCH =================

/** Dạng danh sách — bảng chuẩn của dự án. */
export function SessionTable({
  sessions,
  onSelect,
  showCheckedBy = true,
}: {
  sessions: CalendarSession[];
  onSelect: (session: TeachingSession) => void;
  showCheckedBy?: boolean;
}) {
  return (
    <TableCard minWidth={showCheckedBy ? 1370 : 1230}>
      <thead className={theadClass}>
        <tr>
          <th className={thClass}>Ngày</th>
          <th className={thClass}>Giờ</th>
          <th className={thClass}>Giáo viên</th>
          <th className={thClass}>Trường</th>
          <th className={thClass}>Lớp</th>
          <th className={thClass}>Môn</th>
          {TEACHING_MONEY_FEATURES_ENABLED && (
            <th className={`${thClass} text-right`}>Tiền công</th>
          )}
          <th className={thClass}>Trạng thái</th>
          <th className={thClass}>Phản hồi lịch</th>
          {showCheckedBy && <th className={thClass}>Người chấm</th>}
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => {
          const meta = SESSION_STATUS_META[session.status];
          return (
            <tr
              key={session.id}
              className={`${trClass} cursor-pointer`}
              onClick={() => onSelect(session)}
            >
              <td className={`${tdClass} font-medium text-gray-800`}>
                {formatDate(session.date)}
                <span className="text-gray-400 font-normal">
                  {session.dayOfWeekLabel ? ` · ${session.dayOfWeekLabel}` : ""}
                </span>
              </td>
              <td className={`${tdClass} ${meta?.strike ? "line-through" : ""}`}>
                {formatTime(session.startTime)}–{formatTime(session.endTime)}
              </td>
              <td className={tdClass}>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={session.teacherName ? "" : "text-gray-400"}>
                    {session.teacherName ||
                      (session.declinedTeacherName
                        ? `${session.declinedTeacherName} · Đã từ chối`
                        : null) ||
                      (session.assignmentStatus === "OPEN"
                        ? "Chưa phân công · Đang mở đăng ký"
                        : "Chưa phân công")}
                  </span>
                  <AssignmentBadge
                    status={session.assignmentStatus}
                    applicationCount={session.applicationCount}
                  />
                  {session.isMakeup && (
                    <MakeupBadge forSessionId={session.makeupForSessionId} />
                  )}
                </div>
              </td>
              <td className={tdClass}>{session.schoolName}</td>
              <td
                className={`${tdClass} ${
                  session.className ? "font-medium text-gray-800" : "text-gray-300"
                }`}
              >
                {classNameOf(session)}
              </td>
              <td className={tdClass}>{session.subjectName}</td>
              {/* `null` = chưa khai đơn giá, khác hẳn 0 đồng. */}
              {TEACHING_MONEY_FEATURES_ENABLED && (
                <td
                  className={`${tdClass} text-right whitespace-nowrap ${
                    session.amount == null && !hasGasAllowance(session)
                      ? "text-amber-600"
                      : "font-medium text-gray-800"
                  }`}
                >
                  {hasGasAllowance(session)
                    ? formatFuelAllowance(session)
                    : formatMoney(session.amount)}
                </td>
              )}
              <td className={tdClass}>
                <SessionStatusBadge
                  status={session.status}
                  label={session.statusLabel}
                />
              </td>
              <td className={tdClass}>
                <ScheduleResponseBadge session={session} />
              </td>
              {showCheckedBy && (
                <td className={`${tdClass} text-gray-500 text-xs`}>
                  {session.checkedByName
                    ? `${session.checkedByName} · ${formatCheckedAt(
                        session.checkedAt,
                      )}`
                    : "—"}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </TableCard>
  );
}
