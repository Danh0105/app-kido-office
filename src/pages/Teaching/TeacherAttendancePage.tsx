import { useMemo, useState } from "react";
import { FileText, MapPin } from "lucide-react";

import { teachingSessionApi } from "@/service/teaching";
import type { SessionQuery, TeachingSession } from "@/types/teaching";
import { formatDistance } from "@/utils/geo";

import TeachingLayout from "./components/TeachingLayout";
import TeacherTabs from "./components/TeacherTabs";
import SessionDetailDrawer from "./components/SessionDetailDrawer";
import OutOfRangeConfirm from "./components/OutOfRangeConfirm";
import LessonSubmitModal from "./components/LessonSubmitModal";
import SessionStatusBadge, {
  CheckinBadge,
  MakeupBadge,
} from "./components/SessionStatusBadge";
import { EmptyState, Loading, RangeNav, ViewSwitcher } from "./components/Shared";
import { usePagedList } from "./hooks/usePagedList";
import {
  radiusOf,
  schoolPointOf,
  useSessionCheckin,
} from "./hooks/useSessionCheckin";
import { useLessonSubmit } from "./hooks/useLessonSubmit";
import {
  addMonths,
  dayTitle,
  endOfMonth,
  formatCheckedAt,
  formatMinutes,
  formatTime,
  monthTitle,
  periodsOf,
  schoolWithClass,
  startOfMonth,
  todayISO,
} from "./lib";

const PAGE_SIZE = 200;

type Tab = "today" | "history";

const TAB_OPTIONS: [Tab, string][] = [
  ["today", "Hôm nay"],
  ["history", "Lịch sử"],
];

/** Thời gian có mặt tại trường, tính từ 2 mốc check-in / check-out. */
const stayMinutesOf = (session: TeachingSession) =>
  session.checkinAt && session.checkoutAt
    ? Math.max(
        0,
        Math.round(
          (new Date(session.checkoutAt).getTime() -
            new Date(session.checkinAt).getTime()) /
            60000,
        ),
      )
    : 0;

/**
 * Chấm công của giáo viên — check-in / check-out tại trường cho buổi trong ngày,
 * và xem lại lịch sử đã chấm.
 *
 * Trạng thái công (Có dạy / Vắng / Huỷ) vẫn do Nhân sự chốt, màn này chỉ đọc.
 */
export default function TeacherAttendancePage() {
  const [tab, setTab] = useState<Tab>("today");
  const [anchor, setAnchor] = useState(todayISO());
  const [selected, setSelected] = useState<TeachingSession | null>(null);

  const today = todayISO();
  const query = useMemo<SessionQuery>(
    () =>
      tab === "today"
        ? { fromDate: today, toDate: today }
        : { fromDate: startOfMonth(anchor), toDate: endOfMonth(anchor) },
    [tab, today, anchor],
  );

  const { items, setItems, loading, notFound, reload } = usePagedList<
    TeachingSession,
    SessionQuery
  >({
    fetcher: teachingSessionApi.me,
    query,
    limit: PAGE_SIZE,
    errorMessage: "Không tải được lịch dạy",
    // 404 = tài khoản chưa gắn hồ sơ giáo viên → empty state, không phải màn lỗi.
    treat404AsEmpty: true,
  });

  // Buổi vừa chấm được thay tại chỗ để không mất vị trí cuộn của danh sách.
  const replaceSession = (updated: TeachingSession) =>
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );

  const checkin = useSessionCheckin(replaceSession);
  const lesson = useLessonSubmit(replaceSession);

  const sessions = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
      ),
    [items],
  );

  return (
    <TeachingLayout title="Chấm công">
      <TeacherTabs />

      {notFound ? (
        <EmptyState
          icon="🧑‍🏫"
          title="Chưa có hồ sơ giáo viên"
          description="Tài khoản của bạn chưa được phòng Nhân sự gắn với hồ sơ giáo viên. Vui lòng liên hệ phòng Nhân sự."
        />
      ) : (
        <>
          <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
            <ViewSwitcher<Tab>
              value={tab}
              options={TAB_OPTIONS}
              onChange={setTab}
            />

            {tab === "history" && (
              <div className="md:flex-1">
                <RangeNav
                  title={monthTitle(anchor)}
                  onPrev={() => setAnchor(addMonths(anchor, -1))}
                  onNext={() => setAnchor(addMonths(anchor, 1))}
                  onToday={() => setAnchor(todayISO())}
                  todayLabel="Tháng này"
                />
              </div>
            )}
          </div>

          {loading && <Loading />}

          {!loading && tab === "today" && (
            <TodayTab
              sessions={sessions}
              busyId={checkin.busyId}
              onMark={checkin.mark}
              lessonBusyId={lesson.busyId}
              onCheckout={lesson.openCheckout}
              onLessonOnly={lesson.openLessonOnly}
            />
          )}

          {!loading && tab === "history" && (
            <HistoryTab
              sessions={sessions}
              rangeLabel={monthTitle(anchor)}
              onSelect={setSelected}
            />
          )}
        </>
      )}

      {checkin.outOfRange && (
        <OutOfRangeConfirm
          mark={checkin.outOfRange}
          loading={checkin.busyId === checkin.outOfRange.session.id}
          onClose={checkin.cancelOutOfRange}
          onSubmit={checkin.confirmOutOfRange}
        />
      )}

      {lesson.pending && (
        <LessonSubmitModal
          session={lesson.pending.session}
          mode={lesson.pending.mode}
          loading={lesson.busyId === lesson.pending.session.id}
          onClose={lesson.cancel}
          onSubmit={lesson.submit}
        />
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

// ================= HÔM NAY =================

function TodayTab({
  sessions,
  busyId,
  onMark,
  lessonBusyId,
  onCheckout,
  onLessonOnly,
}: {
  sessions: TeachingSession[];
  busyId: number | null;
  onMark: (session: TeachingSession) => void;
  lessonBusyId: number | null;
  onCheckout: (session: TeachingSession) => void;
  onLessonOnly: (session: TeachingSession) => void;
}) {
  // Buổi bị huỷ không cần chấm vị trí nên không tính vào tiến độ.
  const markable = sessions.filter((s) => s.status !== "CANCELLED");
  const done = markable.filter((s) => s.checkoutAt).length;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="☕"
        title="Hôm nay bạn không có buổi dạy"
        description="Lịch dạy được phòng Nhân sự phân công. Xem các ngày khác trong tab Lịch sử hoặc màn Lịch của tôi."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs text-blue-700">{dayTitle(todayISO())}</p>
        <p className="text-2xl font-bold text-blue-600 leading-tight">
          {sessions.length} buổi dạy
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          {done}/{markable.length} buổi đã chấm xong check-in và check-out
        </p>
      </div>

      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
        {sessions.map((session) => (
          <TodayCard
            key={session.id}
            session={session}
            busy={busyId === session.id || lessonBusyId === session.id}
            onCheckin={() => onMark(session)}
            onCheckout={() => onCheckout(session)}
            onLessonOnly={() => onLessonOnly(session)}
          />
        ))}
      </div>
    </div>
  );
}

/** Một buổi dạy hôm nay + nút chấm vị trí. */
function TodayCard({
  session,
  busy,
  onCheckin,
  onCheckout,
  onLessonOnly,
}: {
  session: TeachingSession;
  busy: boolean;
  onCheckin: () => void;
  onCheckout: () => void;
  onLessonOnly: () => void;
}) {
  const checkedIn = !!session.checkinAt;
  const checkedOut = !!session.checkoutAt;
  // Tiết chưa phân công (đang tuyển / đã huỷ) thì chưa chấm vị trí được.
  const isAssigned = session.assignmentStatus === "ASSIGNED";
  const cancelled = session.status === "CANCELLED";
  const radius = radiusOf(session);
  const hasSchoolPoint = !!schoolPointOf(session);
  const stayMinutes = stayMinutesOf(session);

  const lessonSubmitted = !!session.lessonSubmittedAt;

  /**
   * Tiết liên tiếp cùng trường: chỉ tiết đầu cần tự check-in — nhưng giờ tiết
   * nào cũng tự check-out trực tiếp được (không chỉ tiết cuối), để giáo viên
   * báo giảng ngay sau khi dạy xong đúng tiết đó thay vì đợi hết cả block.
   * Tiết cuối (`checkoutRequired`) vẫn giữ vai trò đóng cả block như cũ —
   * check-out tiết cuối tự động check-out hộ tiết nào trong block chưa tự
   * check-out (đánh dấu `checkoutViaAdjacent` phía BE).
   */
  /** Mốc chấm công "ăn theo" tiết khác cùng trường trong chuỗi. */
  const checkinViaBlock = checkedIn && session.checkinRequired === false;
  const checkoutViaBlock = checkedOut && session.checkoutViaAdjacent === true;

  const nextAction: "checkin" | "checkout" | "lesson" | "done" =
    session.checkinRequired && !checkedIn
      ? "checkin"
      : !checkedOut
      ? "checkout"
      : lessonSubmitted
      ? "done"
      : "lesson";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2 flex flex-col">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-semibold text-gray-800">
            {formatTime(session.startTime)}–{formatTime(session.endTime)}
          </p>
          <span className="text-xs text-gray-400">
            {periodsOf(session)} tiết
          </span>
          <SessionStatusBadge
            status={session.status}
            label={session.statusLabel}
          />
          {session.isMakeup && (
            <MakeupBadge forSessionId={session.makeupForSessionId} />
          )}
          {checkedIn && (
            <CheckinBadge
              checkedOut={checkedOut}
              outOfRange={
                session.checkinOutOfRange || session.checkoutOutOfRange
              }
            />
          )}
        </div>
        {/* Giáo viên cần biết vào lớp nào, không chỉ tới trường nào. */}
        <p className="text-sm text-gray-700 mt-0.5">
          {schoolWithClass(session)}
        </p>
        <p className="text-xs text-gray-500">Môn {session.subjectName}</p>
      </div>

      {checkedIn && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 space-y-1">
          <MarkLine
            label="Check-in"
            at={session.checkinAt}
            distance={session.checkinDistance}
            outOfRange={session.checkinOutOfRange}
            radius={radius}
            viaBlock={checkinViaBlock}
          />
          <MarkLine
            label="Check-out"
            at={session.checkoutAt}
            distance={session.checkoutDistance}
            outOfRange={session.checkoutOutOfRange}
            radius={radius}
            viaBlock={checkoutViaBlock}
          />
          {stayMinutes > 0 && (
            <p className="text-xs text-gray-500">
              Có mặt <b className="text-gray-700">{formatMinutes(stayMinutes)}</b>
            </p>
          )}
          {(checkinViaBlock || checkoutViaBlock) && (
            <p className="rounded-lg bg-sky-50 px-2 py-1.5 text-[11px] leading-relaxed text-sky-800">
              Tiết này nằm trong chuỗi tiết liên tiếp cùng trường nên bạn không
              phải chấm vị trí riêng.{" "}
              {checkinViaBlock &&
                "Mốc check-in lấy theo tiết đầu chuỗi."}{" "}
              {checkoutViaBlock &&
                "Mốc check-out lấy theo tiết cuối chuỗi."}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto">
        {cancelled ? (
          <p className="text-xs text-gray-400 text-center py-2">
            Buổi đã huỷ — không cần chấm công.
          </p>
        ) : !isAssigned ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Tiết này chưa được phân công nên chưa check-in được.
          </p>
        ) : nextAction === "done" ? (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center">
            Đã chấm công xong buổi này.
          </p>
        ) : nextAction === "lesson" ? (
          <>
            <button
              onClick={onLessonOnly}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl text-white text-sm font-medium active:scale-95 disabled:opacity-50 bg-indigo-500"
            >
              <FileText size={16} />
              {busy ? "Đang gửi…" : "Nộp nội dung bài dạy"}
            </button>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Đã check-out tiết này — chỉ cần ghi lại nội dung bài dạy.
            </p>
          </>
        ) : (
          <>
            <button
              onClick={nextAction === "checkout" ? onCheckout : onCheckin}
              disabled={busy}
              className={`w-full flex items-center justify-center gap-1 py-2.5 rounded-xl text-white text-sm font-medium active:scale-95 disabled:opacity-50 ${
                nextAction === "checkout" ? "bg-blue-500" : "bg-emerald-500"
              }`}
            >
              <MapPin size={16} />
              {busy
                ? "Đang lấy vị trí…"
                : nextAction === "checkout"
                ? "Check-out"
                : "Check-in tại trường"}
            </button>

            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              {hasSchoolPoint
                ? `Cho phép trong bán kính ${radius} m quanh ${
                    session.locationName || session.schoolName
                  }. Đứng ngoài vẫn chấm được nhưng sẽ bị đánh dấu để Nhân sự xem lại.`
                : "Chưa gắn toạ độ nên hệ thống chỉ ghi nhận vị trí, chưa kiểm tra khoảng cách."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Một mốc chấm: giờ · khoảng cách tới trường. */
function MarkLine({
  label,
  at,
  distance,
  outOfRange,
  radius,
  viaBlock,
}: {
  label: string;
  at: string | null;
  distance: number | null;
  outOfRange: boolean | null;
  radius: number;
  /** Mốc lấy theo tiết khác cùng trường, không phải giáo viên tự chấm. */
  viaBlock?: boolean;
}) {
  return (
    <p className="text-xs flex flex-wrap items-center gap-x-2">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      {at ? (
        <>
          <span className="text-gray-800 font-medium">
            {formatCheckedAt(at)}
          </span>
          {viaBlock && (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
              Tự động · tiết cùng trường
            </span>
          )}
          {distance != null && (
            <span className={outOfRange ? "text-amber-600" : "text-emerald-600"}>
              {formatDistance(distance)}
              {outOfRange ? ` · ngoài bán kính ${radius} m` : ""}
            </span>
          )}
        </>
      ) : (
        <span className="text-gray-400">Chưa chấm</span>
      )}
    </p>
  );
}

// ================= LỊCH SỬ =================

function HistoryTab({
  sessions,
  rangeLabel,
  onSelect,
}: {
  sessions: TeachingSession[];
  rangeLabel: string;
  onSelect: (session: TeachingSession) => void;
}) {
  const stats = useMemo(() => {
    let markable = 0;
    let checkedIn = 0;
    let missingCheckout = 0;
    let flagged = 0;

    sessions.forEach((session) => {
      if (session.status !== "CANCELLED") markable += 1;
      if (session.checkinAt) checkedIn += 1;
      if (session.checkinAt && !session.checkoutAt) missingCheckout += 1;
      if (session.checkinOutOfRange || session.checkoutOutOfRange) flagged += 1;
    });

    return { markable, checkedIn, missingCheckout, flagged };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="Không có buổi dạy"
        description={`Bạn không có buổi dạy nào trong ${rangeLabel.toLowerCase()}.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Đã check-in"
          value={`${stats.checkedIn}/${stats.markable}`}
        />
        <StatTile
          label="Thiếu check-out"
          value={String(stats.missingCheckout)}
          tone={stats.missingCheckout > 0 ? "amber" : "plain"}
        />
        <StatTile
          label="Ngoài vùng"
          value={String(stats.flagged)}
          tone={stats.flagged > 0 ? "amber" : "plain"}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session)}
            className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 active:bg-blue-50"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">
                {dayTitle(session.date)}
              </span>
              <span className="text-xs text-gray-500">
                {formatTime(session.startTime)}–{formatTime(session.endTime)}
              </span>
              <SessionStatusBadge
                status={session.status}
                label={session.statusLabel}
              />
              {session.checkinAt && (
                <CheckinBadge
                  checkedOut={!!session.checkoutAt}
                  outOfRange={
                    session.checkinOutOfRange || session.checkoutOutOfRange
                  }
                />
              )}
            </div>

            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {schoolWithClass(session)} · Môn {session.subjectName}
            </p>

            <p className="text-[11px] text-gray-400 mt-0.5">
              {session.checkinAt
                ? `Vào ${formatCheckedAt(session.checkinAt)}${
                    session.checkoutAt
                      ? ` · Ra ${formatCheckedAt(session.checkoutAt)}`
                      : " · chưa check-out"
                  }`
                : session.status === "CANCELLED"
                ? "Buổi đã huỷ"
                : "Chưa chấm vị trí"}
            </p>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
        Trạng thái công (Có dạy / Vắng / Huỷ) do phòng Nhân sự chốt sau buổi dạy.
        Nếu thấy chưa đúng, liên hệ Nhân sự để chấm lại.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "amber";
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        tone === "amber"
          ? "border-amber-100 bg-amber-50"
          : "border-gray-100 bg-white"
      }`}
    >
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold ${
          tone === "amber" ? "text-amber-700" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
