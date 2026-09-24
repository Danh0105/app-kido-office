import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Check, Maximize2, X } from "lucide-react";

import {
  SESSION_STATUS_META,
  type Teacher,
  type TeacherRole,
  type TeachingSession,
} from "@/types/teaching";

import {
  DEFAULT_TIMETABLE_DAYS,
  DEFAULT_TIMETABLE_ROWS,
  SESSION_LABELS,
  formatCheckedAt,
  formatTime,
  isCheckoutOverdue,
  weekTitle,
  type TimetableRow,
} from "../lib";
import ScheduleResponseBadge, { scheduleResponseOf } from "./ScheduleResponseBadge";
import DragScrollContainer from "./DragScrollContainer";

type Props = {
  /** Ngày bất kỳ trong tuần đang xem. */
  anchorDate: string;
  /** Buổi dạy đã lọc sẵn ở tab — component chỉ vẽ, không tự gọi API. */
  sessions: TeachingSession[];
  onSelect: (session: TeachingSession) => void;
  /** Hiện tiến độ Check-in / Check-out / Báo giảng cạnh tên giáo viên. */
  showAttendanceBadges?: boolean;
  teachers?: Pick<Teacher, "id" | "teacherRole">[];
  /**
   * Chọn nhiều tiết ngay trên lưới để đổi giáo viên hàng loạt — checkbox chỉ
   * hiện khi truyền các prop này (Chấm công dùng, các màn khác không cần).
   */
  selectable?: (session: TeachingSession) => boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (session: TeachingSession) => void;
  /** Bấm vào tiêu đề Thứ hoặc Tiết để chọn/bỏ chọn cả nhóm cùng lúc. */
  onToggleMany?: (sessions: TeachingSession[]) => void;
};

/** Mốc chia buổi sáng / chiều, đủ dùng cho lịch trường phổ thông. */
const NOON = "12:00";

/**
 * Chia bề ngang bản phóng to: 3 cột đầu (Buổi / Tiết / Thời gian) ăn phần cố
 * định, phần còn lại chia đều cho 7 thứ, trong mỗi thứ lại chia theo tỉ trọng
 * chữ của 5 cột con (checkbox hẹp nhất, tên trường dài nhất, lớp ngắn nhất).
 */
const HEAD_COLUMN_WIDTHS = [3, 3, 6];
const DAY_SUB_COLUMN_RATIOS = [0.06, 0.32, 0.14, 0.2, 0.28];

/** Trần phóng to của bản xem cả tuần — quá mức này chữ to lố, đọc lại khó. */
const MAX_FIT_SCALE = 2.5;

/** Sàn: nhỏ hơn nữa thì có vừa khung cũng không đọc nổi, thà chấp nhận hụt. */
const MIN_FIT_SCALE = 0.15;

/** Số lần chia đôi khi dò tỉ lệ — 10 lần là sai số dưới 0.3%. */
const FIT_SEARCH_STEPS = 10;

/**
 * Buổi dạy vẽ theo dạng thời khoá biểu **tiết × thứ** — cùng cách đọc với bản
 * TKB giấy nhà trường dùng, khác với lịch Ngày/Tuần vẽ theo trục giờ.
 *
 * Chỉ đọc: khung tiết và các thứ đều **suy ra từ chính dữ liệu đang lọc**, nên
 * lọc theo giáo viên nào là ra đúng TKB của người đó.
 */
export default function SessionTimetable({
  anchorDate,
  sessions,
  onSelect,
  showAttendanceBadges = false,
  teachers = [],
  selectable,
  selectedIds,
  onToggleSelect,
  onToggleMany,
}: Props) {
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [hoveredTimeRowKey, setHoveredTimeRowKey] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);

  // Chỉ viền trên/dưới của nhóm cùng giờ, kể cả khi ô thời gian gộp nhiều hàng.
  // Shadow giữ viền trên hiển thị ở bảng ghim cột vốn bỏ border-top.
  const timeRowBorderClass = (key: string, slotIndex = 0, slotCount = 1) => {
    if (hoveredTimeRowKey !== key) return "border-gray-200";
    if (slotCount === 1) {
      return "border-x-gray-200 border-y-blue-500 shadow-[inset_0_1px_0_0_#3b82f6,inset_0_-1px_0_0_#3b82f6]";
    }
    if (slotIndex === 0) {
      return "border-x-gray-200 border-b-gray-200 border-t-blue-500 shadow-[inset_0_1px_0_0_#3b82f6]";
    }
    if (slotIndex === slotCount - 1) {
      return "border-x-gray-200 border-t-gray-200 border-b-blue-500 shadow-[inset_0_-1px_0_0_#3b82f6]";
    }
    return "border-gray-200";
  };

  // Ghép viền dọc với shadow của hàng để giữ đủ viền tại ô giao nhau.
  const dayColumnBorderStyle = (
    day: number,
    edge: "left" | "right" | "both",
  ): CSSProperties | undefined => {
    if (hoveredDay !== day) return undefined;
    const left = edge !== "right";
    const right = edge !== "left";
    return {
      borderLeftColor: left ? "#a855f7" : undefined,
      borderRightColor: right ? "#a855f7" : undefined,
      boxShadow: [
        "var(--tw-shadow, 0 0 #0000)",
        ...(left ? ["inset 1px 0 0 0 #a855f7"] : []),
        ...(right ? ["inset -1px 0 0 0 #a855f7"] : []),
      ].join(", "),
    };
  };

  /**
   * Bản phóng to lấp kín khung popup: bảng luôn `table-fixed w-full h-full`
   * trong một khung vẽ cỡ `khung / tỉ lệ`, rồi `transform: scale(tỉ lệ)` kéo về
   * vừa khít. Tỉ lệ chỉ còn quyết định cỡ chữ: tỉ lệ nhỏ = khung vẽ rộng = chữ
   * nhỏ nhưng ít phải xuống dòng.
   *
   * Tỉ lệ đo thẳng trên DOM (không qua state) vì phải thử — đặt bề ngang rồi
   * mới biết bảng cao bao nhiêu. Đi qua state thì mỗi lần thử là một lượt vẽ,
   * dễ kẹt giữa chừng như bản trước.
   */
  const fitBoxRef = useRef<HTMLDivElement>(null);
  const fitContentRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLTableElement>(null);

  // Đo bề rộng thật vì cột Buổi / Tiết có thể đổi theo dữ liệu và cỡ màn hình.
  useLayoutEffect(() => {
    const table = scrollTableRef.current;
    const cells = table?.tHead?.rows[0]?.cells;
    if (!table || !cells) return;

    const updatePinnedOffsets = () => {
      const partWidth = cells[0].getBoundingClientRect().width;
      const periodWidth = cells[1].getBoundingClientRect().width;
      table.style.setProperty("--period-left", `${partWidth}px`);
      table.style.setProperty("--time-left", `${partWidth + periodWidth}px`);
    };

    updatePinnedOffsets();
    const observer = new ResizeObserver(updatePinnedOffsets);
    observer.observe(cells[0]);
    observer.observe(cells[1]);
    return () => observer.disconnect();
  }, []);

  // Esc để thoát bản phóng to, và khoá cuộn nền để không cuộn nhầm trang sau lưng.
  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomed]);
  const hasLessonReport = (session: TeachingSession) =>
    !!(session.lessonName?.trim() || session.lessonEvaluation?.trim());

  const rowClassName = (session: TeachingSession, defaultClass = "text-gray-800") => {
    const hovered = hoveredSessionId === session.id;
    const declined = !!(
      session.declinedAt ||
      (!session.teacherId && session.declinedTeacherName)
    );
    if (declined) {
      return hovered
        ? "bg-gray-100 text-gray-500"
        : "bg-slate-50 text-gray-400";
    }
    if (session.checkinAt && !session.checkoutAt) {
      return hovered
        ? "bg-amber-200 text-amber-900"
        : "bg-amber-100 text-amber-800";
    }
    if (isCheckoutOverdue(session)) {
      return hovered ? "bg-red-200 text-red-800" : "bg-red-100 text-red-700";
    }
    if (session.checkinAt && session.checkoutAt && !hasLessonReport(session)) {
      return hovered
        ? "bg-violet-200 text-violet-900"
        : "bg-violet-100 text-violet-800";
    }
    if (scheduleResponseOf(session) === "PENDING") {
      return hovered
        ? "bg-orange-200 text-orange-900"
        : "bg-orange-100 text-orange-800";
    }
    return hovered ? "bg-blue-50 text-blue-700" : defaultClass;
  };

  const teacherRoles = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher.teacherRole])),
    [teachers],
  );

  const teacherRowClassName = (session: TeachingSession) => {
    const hovered = hoveredSessionId === session.id;
    const declined = !!(
      session.declinedAt ||
      (!session.teacherId && session.declinedTeacherName)
    );
    if (declined) return hovered ? "bg-gray-100 text-gray-500" : "bg-slate-50 text-gray-400";
    if (session.checkinAt && !session.checkoutAt) {
      return hovered ? "bg-amber-200 text-gray-900" : "bg-amber-100 text-gray-900";
    }
    if (isCheckoutOverdue(session)) return "bg-red-100 text-gray-900";
    if (session.checkinAt && session.checkoutAt && !hasLessonReport(session)) {
      return hovered ? "bg-violet-200 text-gray-900" : "bg-violet-100 text-gray-900";
    }
    if (scheduleResponseOf(session) === "PENDING") {
      return hovered ? "bg-orange-200 text-gray-900" : "bg-orange-100 text-gray-900";
    }
    return hovered ? `${rowClassName(session)} text-gray-900` : "text-gray-900";
  };

  /** Khung tiết lấy từ các khung giờ thật đang có, sắp theo giờ trong từng buổi. */
  const rows = useMemo<TimetableRow[]>(() => {
    if (sessions.length === 0) return DEFAULT_TIMETABLE_ROWS;

    const found = new Map<string, TimetableRow>();

    sessions.forEach((session) => {
      const startTime = formatTime(session.startTime);
      if (found.has(startTime)) return;
      found.set(startTime, {
        key: startTime,
        session: startTime < NOON ? "SANG" : "CHIEU",
        isPeriod: true,
        label: "",
        startTime,
        endTime: formatTime(session.endTime),
      });
    });

    return (["SANG", "CHIEU"] as const).flatMap((part) => {
      let index = 0;
      return Array.from(found.values())
        .filter((row) => row.session === part)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((row) => ({ ...row, label: String(++index) }));
    });
  }, [sessions]);

  /**
   * Bản thu nhỏ chỉ hiện thứ nào thực sự có buổi dạy — kéo đủ 7 cột × 4 ô thì
   * bảng rộng gấp đôi mà phần lớn để trống, phải cuộn ngang mới đọc được.
   */
  const days = useMemo(() => {
    const found = Array.from(
      new Set(sessions.map((session) => session.dayOfWeek)),
    ).sort((a, b) => a - b);
    return found.length > 0 ? found : DEFAULT_TIMETABLE_DAYS;
  }, [sessions]);

  /** Buổi dạy của từng ô, khớp theo thứ + giờ bắt đầu. */
  const byCell = useMemo(() => {
    const map = new Map<string, TeachingSession[]>();

    sessions.forEach((session) => {
      const key = `${session.dayOfWeek}|${formatTime(session.startTime)}`;
      map.set(key, [...(map.get(key) || []), session]);
    });

    return map;
  }, [sessions]);

  /** Mọi buổi dạy của một thứ — dùng cho "chọn tất cả" khi bấm tiêu đề Thứ. */
  const sessionsOfDay = (day: number) =>
    sessions.filter((session) => session.dayOfWeek === day);

  /** Mọi buổi dạy của một tiết (cùng giờ bắt đầu, mọi thứ) — bấm tiêu đề Tiết. */
  const sessionsOfPeriod = (row: TimetableRow) =>
    sessions.filter((session) => formatTime(session.startTime) === row.startTime);

  /**
   * Dò tỉ lệ lớn nhất mà bảng vẫn nằm gọn trong khung, bằng chia đôi khoảng:
   * tỉ lệ càng lớn thì khung vẽ càng hẹp (bảng cao lên) mà chỗ chứa lại càng
   * ít, nên "vừa khung" là điều kiện đơn điệu — chia đôi luôn ra đúng ngưỡng.
   */
  useLayoutEffect(() => {
    if (!zoomed) return;

    const fitNow = () => {
      const box = fitBoxRef.current;
      const content = fitContentRef.current;
      if (!box || !content) return;

      const boxWidth = box.clientWidth;
      const boxHeight = box.clientHeight;
      if (!boxWidth || !boxHeight) return;

      // Đo ở cỡ thật: bỏ transform, thả chiều cao cho bảng tự dâng theo nội dung.
      content.style.transform = "none";
      content.style.height = "auto";

      const fitsAt = (scale: number) => {
        content.style.width = `${boxWidth / scale}px`;
        return (
          content.scrollWidth <= boxWidth / scale + 1 &&
          content.scrollHeight <= boxHeight / scale + 1
        );
      };

      let scale = MIN_FIT_SCALE;
      if (fitsAt(MAX_FIT_SCALE)) {
        scale = MAX_FIT_SCALE;
      } else {
        let low = MIN_FIT_SCALE;
        let high = MAX_FIT_SCALE;
        for (let step = 0; step < FIT_SEARCH_STEPS; step += 1) {
          const mid = (low + high) / 2;
          if (fitsAt(mid)) low = mid;
          else high = mid;
        }
        scale = low;
      }

      // Chốt: khung vẽ đúng cỡ khung chia tỉ lệ để bảng giãn lấp đầy cả 2 chiều.
      content.style.width = `${boxWidth / scale}px`;
      content.style.height = `${boxHeight / scale}px`;
      content.style.transform = `scale(${scale})`;
    };

    fitNow();

    // Nội dung nằm `absolute` nên không ảnh hưởng cỡ khung → không có vòng lặp.
    const box = fitBoxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(fitNow);
    observer.observe(box);
    return () => observer.disconnect();
    // `rows`/`days` suy ra từ `sessions` nên đổi lịch là hai giá trị này đổi theo.
  }, [zoomed, rows, days, showAttendanceBadges]);

  /**
   * Bấm vào tiết thì thu bản phóng to lại trước: drawer chi tiết buổi nằm ở
   * z-index thấp hơn popup này, để nguyên thì bấm xong không thấy gì.
   */
  const selectSession = (session: TeachingSession) => {
    setZoomed(false);
    onSelect(session);
  };

  /**
   * Trong ô hẹp phải cắt bớt chữ cho vừa; ở bản phóng to thì để nguyên — mở
   * popup chính là để đọc đủ tên trường, tên môn và tên giáo viên.
   */
  const grid = (expanded = false) => {
    // Bản phóng to hiện đủ cả tuần, kể cả thứ chưa xếp tiết nào: nhìn một khung
    // là thấy ngay chỗ trống còn xếp được, không phải đoán thứ nào bị thiếu.
    const columnDays = expanded ? DEFAULT_TIMETABLE_DAYS : days;

    // Bản phóng to chia đều 7 thứ; chữ dài xuống dòng trong ô chứ không tràn.
    const equalColumns = expanded;
    const dayWidth =
      (100 - HEAD_COLUMN_WIDTHS.reduce((sum, item) => sum + item, 0)) /
      columnDays.length;

    return (
      <table
        ref={expanded ? undefined : scrollTableRef}
        onMouseOver={(event) => {
          const cell = (event.target as Element).closest<HTMLElement>("[data-timetable-day]");
          setHoveredDay(cell ? Number(cell.dataset.timetableDay) : null);
        }}
        onMouseLeave={() => setHoveredDay(null)}
        className={`text-sm ${
          expanded
            ? "border-collapse h-full w-full table-fixed"
            : "border-separate border-spacing-0 w-full [&_th]:border-l-0 [&_th]:border-t-0 [&_td]:border-l-0 [&_td]:border-t-0"
        }`}
      >
        {equalColumns && (
          <colgroup>
            {HEAD_COLUMN_WIDTHS.map((width, index) => (
              <col key={`head-${index}`} style={{ width: `${width}%` }} />
            ))}
            {columnDays.map((day) => (
              <Fragment key={day}>
                {DAY_SUB_COLUMN_RATIOS.map((ratio, index) => (
                  <col
                    key={`${day}-${index}`}
                    style={{ width: `${dayWidth * ratio}%` }}
                  />
                ))}
              </Fragment>
            ))}
          </colgroup>
        )}
        <thead className={expanded ? undefined : "sticky top-0 z-30"}>
          <tr className="bg-amber-100 text-gray-800">
            <th
              rowSpan={2}
              className={`border border-amber-200 bg-amber-100 px-2 py-2 text-xs font-bold uppercase ${expanded ? "" : "sticky left-0 z-10"}`}
            >
              Buổi
            </th>
            <th
              className={`border border-amber-200 bg-amber-100 px-2 py-2 text-xs font-bold uppercase ${expanded ? "" : "sticky z-10"}`}
              style={expanded ? undefined : { left: "var(--period-left)" }}
              rowSpan={2}
            >
              Tiết
            </th>
            <th
              className={`border border-amber-200 bg-amber-100 px-2 py-2 text-xs font-bold uppercase ${expanded ? "" : "sticky z-10"}`}
              style={expanded ? undefined : { left: "var(--time-left)" }}
              rowSpan={2}
            >
              Thời gian
            </th>
            {columnDays.map((day) => {
              const daySessions = onToggleMany ? sessionsOfDay(day) : [];
              const daySelectable = daySessions.filter((s) => selectable?.(s));
              const dayClickable = onToggleMany && daySelectable.length > 0;
              return (
                <th
                  key={day}
                  colSpan={5}
                  data-timetable-day={day}
                  style={dayColumnBorderStyle(day, "both")}
                  // `[role='button']` khớp với danh sách loại trừ trong
                  // DragScrollContainer — thiếu nó thì pointerdown ở đây bị
                  // container bắt làm kéo-cuộn và nuốt mất sự kiện click.
                  role={dayClickable ? "button" : undefined}
                  onClick={dayClickable ? () => onToggleMany(daySelectable) : undefined}
                  title={dayClickable ? "Bấm để chọn/bỏ chọn cả thứ này" : undefined}
                  className={`border border-amber-200 px-2 py-1.5 text-sm font-bold transition-colors ${
                    dayClickable ? "cursor-pointer" : ""
                  } ${hoveredDay === day ? "bg-purple-100 text-purple-800" : ""}`}
                >
                  {dayName(day)}
                </th>
              );
            })}
          </tr>
          <tr className="bg-amber-50 text-gray-700">
            {columnDays.map((day) => (
              <Fragment key={day}>
                <th data-timetable-day={day} style={dayColumnBorderStyle(day, "left")} className="border border-amber-200 px-1 py-1 text-xs font-semibold" />
                <th data-timetable-day={day} className="border border-amber-200 px-2 py-1 text-xs font-semibold">
                  Trường
                </th>
                <th data-timetable-day={day} className="border border-amber-200 px-2 py-1 text-xs font-semibold">
                  Lớp
                </th>
                <th data-timetable-day={day} className="border border-amber-200 px-2 py-1 text-xs font-semibold">
                  Môn
                </th>
                <th data-timetable-day={day} style={dayColumnBorderStyle(day, "right")} className="border border-amber-200 px-2 py-1 text-xs font-semibold">
                  GV dạy
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {(["SANG", "CHIEU"] as const).map((part) => {
            const partRows = rows.filter((row) => row.session === part);
            if (partRows.length === 0) return null;

            // Mỗi buổi dạy dùng một hàng thật để bốn cột luôn cùng chiều cao,
            // kể cả khi tên trường xuống dòng hoặc giáo viên có nhiều nhãn.
            const rowSlots = partRows.map((row) => ({
              row,
              slotCount: Math.max(
                1,
                ...columnDays.map(
                  (day) => (byCell.get(`${day}|${row.startTime}`) || []).length,
                ),
              ),
            }));
            const partRowSpan = rowSlots.reduce((sum, slot) => sum + slot.slotCount, 0);

            return rowSlots.flatMap(({ row, slotCount }, index) =>
              Array.from({ length: slotCount }, (_, slotIndex) => (
                <tr
                  key={`${row.key}-${slotIndex}`}
                  className={row.isPeriod ? "" : "bg-green-100"}
                  onMouseEnter={() => setHoveredTimeRowKey(row.key)}
                  onMouseLeave={() => setHoveredTimeRowKey(null)}
                >
                  {index === 0 && slotIndex === 0 && (
                    <td
                      rowSpan={partRowSpan}
                      className={`border border-gray-200 bg-white px-2 py-2 text-center text-sm font-bold text-gray-800 ${expanded ? "" : "sticky left-0 z-20"}`}
                    >
                      {SESSION_LABELS[part]}
                    </td>
                  )}

                  {slotIndex === 0 && (
                    <>
                      <td
                        rowSpan={slotCount}
                        // `[role='button']` — xem chú thích ở tiêu đề Thứ.
                        role={onToggleMany ? "button" : undefined}
                        onClick={
                          onToggleMany
                            ? () => {
                                const target = sessionsOfPeriod(row).filter(
                                  (s) => selectable?.(s),
                                );
                                if (target.length > 0) onToggleMany(target);
                              }
                            : undefined
                        }
                        title={onToggleMany ? "Bấm để chọn/bỏ chọn cả tiết này" : undefined}
                        className={`border ${timeRowBorderClass(row.key)} bg-white px-2 py-1 text-center text-sm font-bold text-gray-800 transition-colors ${expanded ? "" : "sticky z-20"} ${onToggleMany ? "cursor-pointer hover:bg-purple-50" : ""}`}
                        style={expanded ? undefined : { left: "var(--period-left)" }}
                      >
                        {row.label}
                      </td>
                      <td
                        rowSpan={slotCount}
                        style={expanded ? undefined : { left: "var(--time-left)" }}
                        className={`border ${timeRowBorderClass(row.key)} px-2 py-1 text-center text-xs transition-colors ${
                          hoveredTimeRowKey === row.key
                            ? "bg-blue-100 text-blue-800"
                            : "bg-white text-gray-700"
                        } ${
                          expanded ? "" : "sticky z-20 whitespace-nowrap"
                        }`}
                      >
                        {row.startTime} - {row.endTime}
                      </td>
                    </>
                  )}

                  {columnDays.map((day) => {
                    const session = byCell.get(`${day}|${row.startTime}`)?.[slotIndex];

                    return (
                      <Fragment key={day}>
                        <td
                          data-timetable-day={day}
                          style={dayColumnBorderStyle(day, "left")}
                          onClick={
                            session && onToggleSelect && selectable?.(session)
                              ? () => onToggleSelect(session)
                              : undefined
                          }
                          className={`border ${timeRowBorderClass(row.key, slotIndex, slotCount)} px-1 py-1 text-center align-middle ${session ? rowClassName(session) : ""} ${
                            session && onToggleSelect && selectable?.(session) ? "cursor-pointer" : ""
                          }`}
                        >
                          {session && onToggleSelect && selectable?.(session) && (
                            <input
                              type="checkbox"
                              checked={!!selectedIds?.has(session.id)}
                              onChange={() => onToggleSelect(session)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              title="Chọn tiết này để đổi giáo viên hàng loạt"
                            />
                          )}
                        </td>
                        <td data-timetable-day={day} className={`border ${timeRowBorderClass(row.key, slotIndex, slotCount)} px-1 py-1 align-top ${session ? rowClassName(session) : ""}`}>
                          {session && (
                            <CellLine
                              key={session.id}
                              session={session}
                              onSelect={selectSession}
                              className={rowClassName(session)}
                              onHover={setHoveredSessionId}
                              expanded={expanded}
                            >
                              <span className="flex flex-col items-center">
                                <span>{session.schoolName}</span>
                                {session.locationName && (
                                  <span className="text-[11px] leading-4 font-normal text-gray-500">
                                    {session.locationName}
                                  </span>
                                )}
                              </span>
                            </CellLine>
                          )}
                        </td>
                        <td data-timetable-day={day} className={`border ${timeRowBorderClass(row.key, slotIndex, slotCount)} px-1 py-1 align-top ${session ? rowClassName(session) : ""}`}>
                          {session && (
                            <CellLine
                              key={session.id}
                              session={session}
                              onSelect={selectSession}
                              className={rowClassName(session)}
                              onHover={setHoveredSessionId}
                              expanded={expanded}
                            >
                              {session.className || "Chưa xếp lớp"}
                            </CellLine>
                          )}
                        </td>
                        <td data-timetable-day={day} className={`border ${timeRowBorderClass(row.key, slotIndex, slotCount)} px-1 py-1 align-top ${session ? rowClassName(session) : ""}`}>
                          {session && (
                            <CellLine
                              key={session.id}
                              session={session}
                              onSelect={selectSession}
                              className={rowClassName(session)}
                              onHover={setHoveredSessionId}
                              expanded={expanded}
                            >
                              {session.subjectName || "Chưa có môn"}
                            </CellLine>
                          )}
                        </td>
                        <td data-timetable-day={day} style={dayColumnBorderStyle(day, "right")} className={`border ${timeRowBorderClass(row.key, slotIndex, slotCount)} px-1 py-1 align-top ${session ? teacherRowClassName(session) : ""}`}>
                          {session && (
                            <CellLine
                              key={session.id}
                              session={session}
                              onSelect={selectSession}
                              className={teacherRowClassName(session)}
                              onHover={setHoveredSessionId}
                              expanded={expanded}
                              teacherRole={
                                session.teacherId
                                  ? teacherRoles.get(session.teacherId)
                                  : null
                              }
                              showAttendanceBadges={showAttendanceBadges}
                            >
                              {session.teacherName ||
                                (session.declinedTeacherName
                                  ? `${session.declinedTeacherName} · Đã từ chối`
                                  : "Chưa phân công")}
                            </CellLine>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              )),
            );
          })}
        </tbody>
      </table>
    );
  };

  const heading = (
    <>
      <p className="text-sm font-bold uppercase text-gray-800">
        Thời khoá biểu tuần
      </p>
      <p className="text-xs text-gray-600">{weekTitle(anchorDate)}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-amber-200/70 pt-2 text-[11px] font-medium text-gray-600">
        {showAttendanceBadges && (
          <>
            <LegendColor color="bg-red-100 ring-red-200" label="Quá giờ, chưa checkout" />
            <LegendColor color="bg-amber-100 ring-amber-200" label="Đã check-in, chưa checkout" />
            <LegendColor color="bg-violet-100 ring-violet-200" label="Đã checkout, chưa báo giảng" />
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 text-blue-700"><Check size={11} /> Đã chấm</span>
              Nhân sự / Giáo vụ đã chấm công
            </span>
          </>
        )}
        <LegendColor color="bg-slate-50 ring-gray-200" label="Tiết đã từ chối" />
        <LegendColor
          color="bg-orange-100 ring-orange-200"
          label="Chưa được giáo viên xác nhận"
        />
      </div>
    </>
  );

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative rounded-t-2xl border-b border-gray-200 bg-amber-50/60 px-4 py-2 text-center">
          {heading}
          <button
            type="button"
            onClick={() => setZoomed(true)}
            title="Phóng to xem cả tuần"
            aria-label="Phóng to thời khoá biểu"
            className="absolute right-3 top-2 rounded-lg border border-amber-200 bg-white/80 p-1.5 text-gray-500 hover:text-gray-800 active:scale-95"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        <DragScrollContainer className="relative isolate max-h-[70vh] overflow-auto rounded-b-2xl">
          {grid()}
        </DragScrollContainer>
      </div>

      {/* Bản phóng to: cả tuần gọn trong đúng một khung hình — bảng tự thu cho
          vừa màn hình nên không phải cuộn, và không ô nào bị cắt chữ. */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[120] flex bg-black/50 p-2 md:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setZoomed(false);
          }}
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="relative shrink-0 border-b border-gray-200 bg-amber-50/60 px-4 py-2 text-center">
              {heading}
              <button
                type="button"
                onClick={() => setZoomed(false)}
                title="Đóng (Esc)"
                aria-label="Đóng bản phóng to"
                className="absolute right-3 top-2 rounded-lg border border-amber-200 bg-white/80 p-1.5 text-gray-500 hover:text-gray-800 active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            <div
              ref={fitBoxRef}
              className="relative min-h-0 flex-1 overflow-hidden"
            >
              {/* Bề ngang / chiều cao / tỉ lệ do `fitNow` đặt thẳng vào style. */}
              <div
                ref={fitContentRef}
                className="absolute left-0 top-0 origin-top-left"
              >
                {grid(true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LegendColor({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-5 rounded-sm ring-1 ring-inset ${color}`} />
      {label}
    </span>
  );
}

const DAY_NAMES: Record<number, string> = {
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
  8: "Chủ Nhật",
};

const dayName = (day: number) => DAY_NAMES[day] || `Thứ ${day}`;

/**
 * Một dòng trong ô. Bấm vào mở chi tiết buổi — TKB ở đây là một cách xem của
 * danh sách buổi dạy, không phải bảng tĩnh.
 */
function CellLine({
  session,
  onSelect,
  className = "text-gray-800",
  showAttendanceBadges = false,
  onHover,
  teacherRole,
  expanded = false,
  children,
}: {
  session: TeachingSession;
  onSelect: (session: TeachingSession) => void;
  className?: string;
  showAttendanceBadges?: boolean;
  onHover?: (sessionId: number | null) => void;
  teacherRole?: TeacherRole | null;
  /** Bản phóng to: hiện đủ chữ, không cắt. */
  expanded?: boolean;
  children: React.ReactNode;
}) {
  const meta = SESSION_STATUS_META[session.status];
  const hasAttendanceMark = session.status !== "SCHEDULED" && !!(
    session.checkedAt || session.checkedById || session.checkedByName
  );
  const attendanceTitle = [
    `Đã chấm công: ${meta?.label || session.statusLabel || session.status}`,
    session.checkedByName && `Người chấm: ${session.checkedByName}`,
    session.checkedAt && `Lúc: ${formatCheckedAt(session.checkedAt)}`,
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      onMouseEnter={() => onHover?.(session.id)}
      onMouseLeave={() => onHover?.(null)}
      title={`${session.subjectName} · ${session.schoolName}${
        session.locationName ? ` · ${session.locationName}` : ""
      } · ${session.statusLabel || meta?.label}`}
      className={`flex w-full flex-col items-center gap-1 px-1 py-0.5 text-sm leading-5 font-semibold hover:bg-blue-50 ${className}`}
    >
      <span className={`flex w-full items-start justify-center gap-1 ${meta?.strike ? "line-through opacity-60" : ""}`}>
        {teacherRole && <span className="mt-1 flex shrink-0"><TeacherRoleBadge role={teacherRole} /></span>}
        {/* Bản phóng to chia đều cột nên chữ dài xuống dòng trong ô, không cắt. */}
        <span className={expanded ? "min-w-0 break-words" : "min-w-0 truncate"}>
          {children}
        </span>
        <span className="mt-1.5 flex shrink-0"><ScheduleResponseBadge session={session} compact /></span>
      </span>
      {showAttendanceBadges && (
        <span className="flex flex-wrap items-center justify-center gap-1 empty:hidden">
          <AttendanceProgressBadges session={session} />
          {hasAttendanceMark && (
            <span
              title={attendanceTitle}
              aria-label={attendanceTitle}
              className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 py-0.5 text-[10px] leading-4 font-semibold text-blue-700"
            >
              <Check size={11} /> Đã chấm · {meta?.label || session.statusLabel}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function TeacherRoleBadge({ role }: { role: TeacherRole }) {
  const staff = role === "giaovien_congty";
  return (
    <span
      className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold leading-none ${
        staff
          ? "bg-blue-100 text-blue-700"
          : "bg-violet-100 text-violet-700"
      }`}
      title={staff ? "Giáo viên công ty" : "Giáo viên cộng tác viên"}
    >
      {staff ? "CTY" : "CTV"}
    </span>
  );
}

function AttendanceProgressBadges({ session }: { session: TeachingSession }) {
  const reported = !!(
    session.lessonName?.trim() || session.lessonEvaluation?.trim()
  );
  const completed = [
    session.checkinAt
      ? {
          key: "in",
          label: "IN",
          title: "Đã Check-in",
          className: "bg-emerald-100 text-emerald-700",
        }
      : null,
    session.checkoutAt
      ? {
          key: "out",
          label: "OUT",
          title: "Đã Check-out",
          className: "bg-emerald-100 text-emerald-700",
        }
      : null,
    reported
      ? {
          key: "report",
          label: "BG",
          title: "Đã báo giảng",
          className: "bg-emerald-100 text-emerald-700",
        }
      : null,
  ].filter(
    (item): item is {
      key: string;
      label: string;
      title: string;
      className: string;
    } => !!item,
  );

  if (completed.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-0.5 no-underline">
      {completed.map((item) => (
        <span
          key={item.key}
          title={item.title}
          aria-label={item.title}
          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold leading-none ${item.className}`}
        >
          <Check size={9} strokeWidth={3} />
          {item.label}
        </span>
      ))}
    </span>
  );
}
