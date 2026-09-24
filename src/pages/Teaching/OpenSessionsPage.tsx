import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { MapPin } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import {
  teacherApi,
  teachingApplicationApi,
  teachingSessionApi,
} from "@/service/teaching";
import type {
  ApplyResult,
  OpenSessionQuery,
  Teacher,
  TeachingSession,
} from "@/types/teaching";
import {
  MAX_TRUSTED_ACCURACY,
  formatDistance,
  getCurrentPosition,
} from "@/utils/geo";

import TeachingLayout from "./components/TeachingLayout";
import TeacherTabs from "./components/TeacherTabs";
import Modal, { ConfirmModal, Field, inputClass } from "./components/Modal";
import { ApplicationBadge } from "./components/SessionStatusBadge";
import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
} from "./components/Shared";
import {
  addDays,
  dayTitle,
  formatTime,
  periodsOf,
  schoolWithClass,
  timeRangesOverlap,
  todayISO,
} from "./lib";

const PAGE_SIZE = 20;
/** Mặc định xem các tiết mở trong 30 ngày tới. */
const DEFAULT_RANGE_DAYS = 30;

/**
 * Tiết đang mở — giáo viên xem và đăng ký nhận dạy.
 * Khoảng cách, định mức tuần và việc trùng lịch đều do backend quyết định;
 * màn này chỉ gửi GPS và hiển thị kết quả trả về.
 */
export default function OpenSessionsPage() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(addDays(todayISO(), DEFAULT_RANGE_DAYS));
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<TeachingSession[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  /** Lịch đã được phân công — dùng để cảnh báo trùng giờ trước khi gửi. */
  const [mySessions, setMySessions] = useState<TeachingSession[]>([]);
  /** Định mức tuần lấy từ lần đăng ký gần nhất (BE là nguồn quyết định). */
  const [quota, setQuota] = useState<ApplyResult | null>(null);

  /** Id buổi đang gửi đăng ký / rút đăng ký. */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<TeachingSession | null>(
    null,
  );
  /** Buổi đang mở form đăng ký (để nhập ghi chú trước khi gửi). */
  const [applyTarget, setApplyTarget] = useState<TeachingSession | null>(null);
  const [applyNote, setApplyNote] = useState("");

  const query = useMemo<OpenSessionQuery>(
    () => ({ fromDate, toDate, page, limit: PAGE_SIZE }),
    [fromDate, toDate, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teachingApplicationApi.getOpenSessions(query);
      // Chỉ giữ tiết còn mở và chưa qua ngày dạy — phòng khi BE trả rộng hơn.
      const today = todayISO();
      setItems(
        (res?.data || []).filter(
          (item) => item.assignmentStatus === "OPEN" && item.date >= today,
        ),
      );
      setTotalPages(res?.pagination?.totalPages || 1);
      setNotFound(false);
    } catch (error: any) {
      // 404 = tài khoản chưa gắn hồ sơ giáo viên.
      if (error?.response?.status === 404) {
        setNotFound(true);
        setItems([]);
      } else {
        toast.error(getApiErrorMessage(error, "Không tải được tiết đang mở"));
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // Hồ sơ giáo viên — lấy định mức tuần để hiển thị.
  useEffect(() => {
    teacherApi
      .me()
      .then(setTeacher)
      .catch((error: any) => {
        if (error?.response?.status === 404) setNotFound(true);
      });
  }, []);

  // Lịch đã phân công trong cùng khoảng, để chặn đăng ký trùng giờ.
  useEffect(() => {
    teachingSessionApi
      .me({ fromDate, toDate, limit: 200 })
      .then((res) => setMySessions(res?.data || []))
      .catch(() => setMySessions([]));
  }, [fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate]);

  const apply = async (session: TeachingSession, note: string) => {
    setBusyId(session.id);
    try {
      const position = await getCurrentPosition();

      if (position.accuracy > MAX_TRUSTED_ACCURACY) {
        toast(
          `Sai số GPS đang lớn (~${position.accuracy} m). Ra chỗ thoáng rồi đăng ký lại sẽ chính xác hơn.`,
          { icon: "📡" },
        );
      }

      const result = await teachingApplicationApi.apply(session.id, {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        note: note.trim() || null,
      });

      if (result) setQuota(result);
      setApplyTarget(null);
      toast.success(
        result?.distance != null
          ? `Đã đăng ký tiết dạy · cách trường ${formatDistance(result.distance)}`
          : "Đã đăng ký tiết dạy",
      );
      load();
    } catch (error: any) {
      // Lỗi vị trí (không có response) → message của getCurrentPosition.
      // 409 = trùng lịch / đã đăng ký / vượt định mức → hiển thị nguyên văn BE.
      if (!error?.response) {
        toast.error(error?.message || "Không lấy được vị trí hiện tại");
      } else if (error.response.status !== 403) {
        toast.error(getApiErrorMessage(error, "Đăng ký tiết dạy thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (session: TeachingSession) => {
    setBusyId(session.id);
    try {
      await teachingApplicationApi.withdraw(session.id);
      toast.success("Đã rút đăng ký");
      setWithdrawTarget(null);
      load();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Rút đăng ký thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  /** Buổi đã phân công trùng giờ với tiết đang mở (nếu có). */
  const conflictOf = (session: TeachingSession) =>
    mySessions.find(
      (mine) =>
        mine.date === session.date &&
        mine.assignmentStatus === "ASSIGNED" &&
        timeRangesOverlap(
          session.startTime,
          session.endTime,
          mine.startTime,
          mine.endTime,
        ),
    ) || null;

  return (
    <TeachingLayout title="Tiết đang mở">
      <TeacherTabs />

      {notFound ? (
        <EmptyState
          icon="🧑‍🏫"
          title="Chưa có hồ sơ giáo viên"
          description="Tài khoản của bạn chưa được phòng Nhân sự gắn với hồ sơ giáo viên. Vui lòng liên hệ phòng Nhân sự."
        />
      ) : (
        <>
          <FilterCard>
            <div className="flex gap-2 items-center md:col-span-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
              />
              <span className="text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
              />
            </div>
          </FilterCard>

          {(teacher || quota) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2 text-xs text-gray-600 space-y-0.5">
              <p>
                Định mức:{" "}
                <b>
                  {teacher?.maxPeriodsPerWeek == null
                    ? "không giới hạn"
                    : `${teacher.maxPeriodsPerWeek} tiết/tuần`}
                </b>
              </p>
              {quota && (
                <p>
                  Tuần này đã nhận <b>{quota.assignedPeriodsInWeek}</b> tiết
                  {quota.pendingPeriodsInWeek > 0
                    ? `, chờ duyệt ${quota.pendingPeriodsInWeek} tiết`
                    : ""}
                  {quota.remainingPeriodsInWeek != null
                    ? ` · còn có thể đăng ký ${quota.remainingPeriodsInWeek} tiết`
                    : ""}
                </p>
              )}
            </div>
          )}

          {loading && <Loading />}

          {!loading && items.length === 0 && (
            <EmptyState
              icon="📭"
              title="Chưa có tiết nào đang mở"
              description="Phòng Nhân sự chưa mở tiết nào trong khoảng thời gian này. Thử đổi khoảng ngày."
            />
          )}

          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
            {!loading &&
              items.map((session) => (
                <OpenSessionCard
                  key={session.id}
                  session={session}
                  busy={busyId === session.id}
                  conflict={conflictOf(session)}
                  remainingPeriods={quota?.remainingPeriodsInWeek ?? null}
                  maxPeriodsPerWeek={
                    quota?.maxPeriodsPerWeek ?? teacher?.maxPeriodsPerWeek ?? null
                  }
                  onApply={() => {
                    setApplyNote("");
                    setApplyTarget(session);
                  }}
                  onWithdraw={() => setWithdrawTarget(session)}
                />
              ))}
          </div>

          {!loading && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      )}

      {applyTarget && (
        <Modal
          title="Đăng ký tiết dạy"
          submitLabel="Gửi đăng ký"
          loading={busyId === applyTarget.id}
          onClose={() => setApplyTarget(null)}
          onSubmit={() => apply(applyTarget, applyNote)}
        >
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm">
            <p className="font-semibold text-gray-800">
              {dayTitle(applyTarget.date)}
            </p>
            <p className="text-gray-600">
              {formatTime(applyTarget.startTime)}–
              {formatTime(applyTarget.endTime)} · {periodsOf(applyTarget)} tiết
            </p>
            <p className="text-gray-600">
              {applyTarget.schoolName} · {applyTarget.subjectName}
            </p>
          </div>

          <Field label="Ghi chú">
            <textarea
              value={applyNote}
              onChange={(e) => setApplyNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Không bắt buộc"
              className={inputClass}
            />
          </Field>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Khi gửi, app lấy vị trí hiện tại của bạn để Nhân sự xếp giáo viên gần
            trường nhất. Vị trí chỉ lấy một lần tại thời điểm đăng ký.
          </p>
        </Modal>
      )}

      {withdrawTarget && (
        <ConfirmModal
          title="Rút đăng ký"
          message={
            <>
              Bạn có chắc muốn rút đăng ký tiết dạy ngày{" "}
              <b>{dayTitle(withdrawTarget.date)}</b> tại{" "}
              <b>{withdrawTarget.schoolName}</b>?
            </>
          }
          submitLabel="Rút đăng ký"
          submitColor="bg-amber-500"
          loading={busyId === withdrawTarget.id}
          onClose={() => setWithdrawTarget(null)}
          onSubmit={() => withdraw(withdrawTarget)}
        />
      )}
    </TeachingLayout>
  );
}

/** Một tiết đang mở + nút đăng ký / rút đăng ký. */
function OpenSessionCard({
  session,
  busy,
  conflict,
  remainingPeriods,
  maxPeriodsPerWeek,
  onApply,
  onWithdraw,
}: {
  session: TeachingSession;
  busy: boolean;
  /** Buổi đã phân công bị trùng giờ — chặn đăng ký. */
  conflict: TeachingSession | null;
  remainingPeriods: number | null;
  maxPeriodsPerWeek: number | null;
  onApply: () => void;
  onWithdraw: () => void;
}) {
  const applied = !!session.hasApplied || !!session.myApplicationStatus;
  const pending = session.myApplicationStatus === "PENDING";
  const selected = session.myApplicationStatus === "SELECTED";

  const sessionPeriods = periodsOf(session);
  // BE vẫn kiểm tra lại khi submit; đây chỉ để khỏi bấm nhầm.
  const overQuota =
    remainingPeriods != null && remainingPeriods < sessionPeriods;
  const blocked = !!conflict || overQuota;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2 flex flex-col">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">
            {dayTitle(session.date)}
          </p>
          <ApplicationBadge status={session.myApplicationStatus} />
        </div>
        <p className="text-sm text-gray-700 mt-0.5">
          {formatTime(session.startTime)}–{formatTime(session.endTime)} ·{" "}
          {sessionPeriods} tiết
        </p>
      </div>

      <div className="text-xs text-gray-600 space-y-0.5">
        <p className="font-medium text-gray-700">
          {schoolWithClass(session)}
        </p>
        <p>Môn {session.subjectName}</p>
        {session.applicationCount > 0 && (
          <p className="text-gray-400">
            {session.applicationCount} giáo viên đã đăng ký
          </p>
        )}
      </div>

      {selected ? (
        <p className="mt-auto text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          Bạn đã được phân công tiết này — xem trong Lịch của tôi.
        </p>
      ) : applied && pending ? (
        <button
          onClick={onWithdraw}
          disabled={busy}
          className="mt-auto w-full py-2 rounded-xl border border-amber-200 text-amber-700 text-sm font-medium active:scale-95 disabled:opacity-50"
        >
          {busy ? "Đang xử lý…" : "Rút đăng ký"}
        </button>
      ) : applied ? (
        <p className="mt-auto text-xs text-gray-400 text-center py-2">
          Tiết này đã có kết quả phân công.
        </p>
      ) : (
        <div className="mt-auto space-y-1">
          {conflict && (
            <p className="text-[11px] text-red-600">
              Trùng với lịch dạy {formatTime(conflict.startTime)}–
              {formatTime(conflict.endTime)} tại {conflict.schoolName}
            </p>
          )}
          {!conflict && overQuota && (
            <p className="text-[11px] text-amber-700">
              Đã đạt giới hạn {maxPeriodsPerWeek} tiết/tuần
            </p>
          )}

          <button
            onClick={onApply}
            disabled={busy || blocked}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium active:scale-95 disabled:opacity-60"
          >
            <MapPin size={15} />
            {busy ? "Đang lấy vị trí và gửi đăng ký…" : "Đăng ký dạy"}
          </button>
        </div>
      )}
    </div>
  );
}
