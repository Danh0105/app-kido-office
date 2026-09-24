import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Home,
  Map as MapIcon,
  MapPin,
  RefreshCw,
} from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import {
  fuelAllowanceTierApi,
  type RecomputeGasAllowanceResult,
} from "@/service/fuelAllowanceTier.api";
import SearchableSelect from "@/components/SearchableSelect";
import type {
  GasAllowanceMissingReason,
  Teacher,
  TravelDay,
  TravelFlag,
  TravelPoint,
  TravelReview,
  TravelStop,
  TravelTeacher,
} from "@/types/teaching";

import { EmptyState, FilterCard, Loading, selectClass } from "../components/Shared";
import Modal from "../components/Modal";
import MissingAllowanceReport, {
  isReportEmpty,
} from "../components/MissingAllowanceReport";
import {
  canSetTeachingRates,
  endOfMonth,
  formatCheckedAt,
  formatDate,
  formatMoney,
  formatTime,
  isDateOrderValid,
  startOfMonth,
  todayISO,
} from "../lib";

/** Bộ lọc mở sẵn khi bấm số km từ bảng Tổng hợp. */
export type TravelReviewFilter = {
  fromDate: string;
  toDate: string;
  teacherId?: number;
};

type Props = {
  teachers: Teacher[];
  initialFilter?: TravelReviewFilter | null;
};

const RECENT_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { value, label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` };
});

const FLAG_META: Record<TravelFlag, { label: string; className: string }> = {
  UNCHECKED: {
    label: "Chưa chấm công",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  NOT_COUNTED: {
    label: "Không có phụ cấp",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  NO_DISTANCE: {
    label: "Không tính được km",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  NO_CHECKIN: {
    label: "Không check-in",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CHECKIN_OUT_OF_RANGE: {
    label: "Check-in ngoài bán kính",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  CHECKOUT_OUT_OF_RANGE: {
    label: "Check-out ngoài bán kính",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

/** Lý do cụ thể của nhãn "Không có phụ cấp" trên từng lượt. */
const missingReasonLabel = (
  reason: GasAllowanceMissingReason,
  distanceKm: number | null,
) => {
  switch (reason) {
    case "NO_TEACHER_LOCATION":
      return "Giáo viên chưa có vị trí nhà";
    case "NO_SCHOOL_LOCATION":
      return "Trường chưa có toạ độ";
    case "NO_MATCHING_TIER":
      return distanceKm != null
        ? `${km(distanceKm)} không khớp bậc phụ cấp`
        : "Không khớp bậc phụ cấp";
    case "INVALID_DISTANCE":
      return "Toạ độ nhà/trường sai";
  }
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

const km = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`;

const point = (p: TravelPoint) => `${p.lat},${p.lng}`;

/**
 * Link chỉ đường Google Maps cho cả ngày: nhà → các điểm dạy theo thứ tự.
 * Chỉ nối các lượt được tính tiền — đúng lộ trình đang dùng để tính km.
 * Thiếu nhà thì xuất phát từ điểm dạy đầu tiên.
 */
const dayDirectionsUrl = (home: TravelPoint | null, day: TravelDay) => {
  const stops = day.stops
    .filter((stop) => stop.counted && stop.coords)
    .map((stop) => stop.coords!);
  const points = home ? [home, ...stops] : stops;
  if (points.length < 2) return null;

  const params = new URLSearchParams({
    api: "1",
    origin: point(points[0]),
    destination: point(points[points.length - 1]),
    travelmode: "driving",
  });
  const waypoints = points.slice(1, -1).map(point).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const placeName = (stop: TravelStop) =>
  [stop.schoolName, stop.locationName].filter(Boolean).join(" · ") ||
  `Trường #${stop.schoolId}`;

export default function TravelReviewTab({ teachers, initialFilter }: Props) {
  const [fromDate, setFromDate] = useState(
    initialFilter?.fromDate ?? startOfMonth(todayISO()),
  );
  const [toDate, setToDate] = useState(
    initialFilter?.toDate ?? endOfMonth(todayISO()),
  );
  const [teacherId, setTeacherId] = useState(
    initialFilter?.teacherId ? String(initialFilter.teacherId) : "",
  );
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [data, setData] = useState<TravelReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] =
    useState<RecomputeGasAllowanceResult | null>(null);
  const [reportOpen, setReportOpen] = useState(true);
  const canRecompute = canSetTeachingRates();

  const rangeValid = isDateOrderValid(fromDate, toDate);

  const changeMonth = (value: string) => {
    if (!value) return;
    setFromDate(startOfMonth(`${value}-01`));
    setToDate(endOfMonth(`${value}-01`));
  };

  const load = useCallback(async () => {
    if (!fromDate || !toDate || !rangeValid) return;

    setLoading(true);
    try {
      const res = await teachingSessionApi.travelReview({
        fromDate,
        toDate,
        teacherId: teacherId ? Number(teacherId) : undefined,
      });
      setData(res);
      // Xem 1 giáo viên thì mở sẵn chi tiết; xem cả danh sách thì để gọn.
      setExpanded(
        new Set(res.teachers.length === 1 ? [res.teachers[0].teacherId] : []),
      );
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải được quãng đường"));
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, teacherId, rangeValid]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleTeachers = useMemo(() => {
    const list = data?.teachers ?? [];
    if (!flaggedOnly) return list;
    return list
      .map((teacher) => ({
        ...teacher,
        days: teacher.days
          .map((day) => ({
            ...day,
            stops: day.stops.filter((stop) => stop.flags.length > 0),
          }))
          .filter((day) => day.stops.length > 0),
      }))
      .filter((teacher) => teacher.days.length > 0);
  }, [data, flaggedOnly]);

  const total = data?.grandTotal;

  const notCountedStops = useMemo(
    () =>
      (data?.teachers ?? []).reduce(
        (sum, teacher) =>
          sum +
          teacher.days.reduce(
            (daySum, day) =>
              daySum +
              day.stops.filter((stop) => stop.flags.includes("NOT_COUNTED"))
                .length,
            0,
          ),
        0,
      ),
    [data],
  );

  /**
   * Phụ cấp chỉ chốt lúc tạo buổi, nên buổi tạo khi giáo viên chưa có vị trí
   * sẽ trống. Backend đã tự điền khi vị trí/bậc thay đổi — nút này để Nhân sự
   * chủ động chạy lại (vd. sau khi đổi loại giáo viên ở màn Nhân viên).
   */
  const recompute = async () => {
    setRecomputing(true);
    try {
      const res = await fuelAllowanceTierApi.recompute(
        teacherId ? Number(teacherId) : undefined,
      );
      // Kết quả đầy đủ (kể cả việc còn phải bổ sung) hiện trong hộp thoại —
      // toast vài giây không đủ chỗ để liệt kê từng giáo viên/trường.
      setRecomputeResult(res);
      if (res.updated > 0) await load();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không tính lại được phụ cấp"));
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="space-y-3">
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

        <select
          defaultValue=""
          onChange={(e) => changeMonth(e.target.value)}
          className={selectClass}
          title="Chọn nhanh cả tháng"
        >
          <option value="" disabled>
            Chọn nhanh theo tháng…
          </option>
          {RECENT_MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <SearchableSelect
          value={teacherId}
          onChange={setTeacherId}
          options={teachers}
          placeholder="Tất cả giáo viên"
          searchPlaceholder="Tìm giáo viên…"
        />

        {!rangeValid && (
          <p className="text-xs text-red-500 md:col-span-4">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
            />
            Chỉ hiện lượt cần kiểm tra
          </label>

          {canRecompute && (
            <button
              type="button"
              onClick={recompute}
              disabled={recomputing}
              title="Điền phụ cấp cho các buổi đang trống. Không sửa buổi đã có phụ cấp, bỏ qua tháng đã gửi lương."
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 disabled:opacity-60"
            >
              <RefreshCw size={13} className={recomputing ? "animate-spin" : ""} />
              {recomputing
                ? "Đang tính lại…"
                : `Tính lại phụ cấp${teacherId ? " (giáo viên này)" : ""}`}
              {!recomputing && notCountedStops > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {notCountedStops}
                </span>
              )}
            </button>
          )}
        </div>
      </FilterCard>

      <p className="px-1 text-[11px] leading-relaxed text-gray-500">
        Chỉ giáo viên công ty. Gồm buổi đã chấm <b>Có mặt</b> và buổi đã tới
        ngày nhưng <b>chưa chấm công</b> (không gồm vắng/nghỉ/huỷ và buổi chưa
        tới ngày). Chặng đầu ngày tính từ nhà tới trường; các chặng sau tính từ
        điểm trường trước. Chưa tính chặng về nhà. Đổi vị trí nhà có hiệu lực
        từ <b>ngày Nhân sự duyệt</b>: các ngày trước đó vẫn tính theo nhà cũ. Phần "đã chấm" khớp với tab
        Tổng hợp.
      </p>

      {!loading &&
        data &&
        (!isReportEmpty(data.missing) || data.needsRecomputeSessions > 0) && (
          <section className="rounded-2xl border border-amber-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setReportOpen((open) => !open)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              {reportOpen ? (
                <ChevronDown size={16} className="text-amber-500" />
              ) : (
                <ChevronRight size={16} className="text-amber-500" />
              )}
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">
                Cần bổ sung để có phụ cấp xăng
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {reportOpen ? "Thu gọn" : "Xem"}
              </span>
            </button>
            {reportOpen && (
              <div className="border-t border-amber-100 p-3">
                <MissingAllowanceReport
                  report={data.missing}
                  needsRecomputeSessions={data.needsRecomputeSessions}
                  onRecompute={canRecompute ? recompute : undefined}
                />
              </div>
            )}
          </section>
        )}

      {recomputeResult && (
        <Modal
          title="Kết quả tính lại phụ cấp"
          wide
          cancelLabel="Đóng"
          onClose={() => setRecomputeResult(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <ResultStat
                label="Đã điền phụ cấp"
                value={recomputeResult.updated}
                tone="ok"
              />
              <ResultStat
                label="Còn thiếu dữ liệu"
                value={recomputeResult.stillMissing}
                tone={recomputeResult.stillMissing > 0 ? "warn" : "ok"}
              />
              <ResultStat
                label="Tháng đã gửi lương (giữ nguyên)"
                value={recomputeResult.skippedLocked}
                tone="muted"
              />
            </div>

            {isReportEmpty(recomputeResult.missing) ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Tất cả buổi của giáo viên công ty đã có phụ cấp xăng.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  Các buổi dưới đây (mọi thời gian
                  {teacherId ? ", giáo viên đang chọn" : ""}) vẫn chưa có phụ
                  cấp. Bổ sung xong là hệ thống tự điền lại, không cần bấm tính
                  lại.
                </p>
                <MissingAllowanceReport report={recomputeResult.missing} />
              </>
            )}
          </div>
        </Modal>
      )}

      {total && !loading && (data?.teachers.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
          <Stat
            label="Tổng km"
            value={km(total.totalDistanceKm)}
            hint={`Đã chấm: ${km(total.checkedDistanceKm)}`}
          />
          <Stat
            label="Phụ cấp xăng"
            value={formatMoney(total.fuelAllowanceAmount)}
            hint={`Đã chấm: ${formatMoney(total.checkedFuelAllowanceAmount)}`}
          />
          <Stat
            label="Lượt cần kiểm tra"
            value={total.flaggedStops.toLocaleString("vi-VN")}
            tone={total.flaggedStops > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Buổi chưa chấm công"
            value={total.uncheckedSessions.toLocaleString("vi-VN")}
            tone={total.uncheckedSessions > 0 ? "warn" : "ok"}
          />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : visibleTeachers.length === 0 ? (
        <EmptyState
          icon="🛵"
          title={
            flaggedOnly && (data?.teachers.length ?? 0) > 0
              ? "Không có lượt nào cần kiểm tra"
              : "Không có dữ liệu di chuyển"
          }
          description="Chỉ giáo viên công ty có buổi đã chấm Có mặt hoặc đã tới ngày mà chưa chấm công trong khoảng ngày này mới có lộ trình."
        />
      ) : (
        <div className="space-y-2">
          {visibleTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.teacherId}
              teacher={teacher}
              open={expanded.has(teacher.teacherId)}
              onToggle={() => toggle(teacher.teacherId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "warn"
        ? "text-amber-700 bg-amber-50"
        : "text-gray-600 bg-gray-50";
  return (
    <div className={`rounded-xl px-2 py-2 ${color}`}>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString("vi-VN")}</p>
      <p className="text-[11px] leading-tight">{label}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-emerald-800">{label}</p>
      <p
        className={`text-lg font-bold leading-tight tabular-nums ${
          tone === "warn" ? "text-amber-600" : "text-emerald-700"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-emerald-800/80 tabular-nums">{hint}</p>}
    </div>
  );
}

function TeacherCard({
  teacher,
  open,
  onToggle,
}: {
  teacher: TravelTeacher;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown size={18} className="mt-0.5 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={18} className="mt-0.5 shrink-0 text-gray-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900">{teacher.teacherName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-gray-500">{teacher.days.length} ngày</span>
            {teacher.flaggedStops > 0 && (
              <span className="rounded-full bg-amber-100 px-2 font-semibold text-amber-700">
                {teacher.flaggedStops} lượt cần kiểm tra
              </span>
            )}
            {teacher.uncheckedSessions > 0 && (
              <span className="rounded-full bg-gray-100 px-2 font-medium text-gray-600">
                {teacher.uncheckedSessions} buổi chưa chấm công
              </span>
            )}
            {!teacher.home && (
              <span className="rounded-full bg-red-50 px-2 font-medium text-red-600">
                Chưa có vị trí nhà
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold leading-none text-emerald-700 tabular-nums">
            {km(teacher.totalDistanceKm)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {formatMoney(teacher.fuelAllowanceAmount)}
          </p>
          {teacher.uncheckedSessions > 0 && (
            <p className="mt-0.5 text-[10px] text-gray-400 tabular-nums">
              đã chấm {km(teacher.checkedDistanceKm)}
            </p>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {teacher.days.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-3">
              Không có buổi nào trong khoảng ngày này.
            </p>
          ) : (
            teacher.days.map((day, index) => (
              <DayRoute
                key={day.date}
                day={day}
                // Backend cũ chưa trả `day.home` → lùi về nhà hiện tại.
                home={day.home !== undefined ? day.home : teacher.home}
                movedHome={
                  index > 0 && !samePoint(day.home, teacher.days[index - 1].home)
                }
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

const samePoint = (a?: TravelPoint | null, b?: TravelPoint | null) =>
  a?.lat === b?.lat && a?.lng === b?.lng;

function DayRoute({
  day,
  home,
  movedHome,
}: {
  day: TravelDay;
  home: TravelPoint | null;
  /** Nhà khác ngày trước đó — đổi vị trí có hiệu lực từ ngày này. */
  movedHome?: boolean;
}) {
  const directions = dayDirectionsUrl(home, day);

  return (
    <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-gray-800">
          {weekdayOf(day.date)}, {formatDate(day.date)}
        </p>
        <span className="text-xs font-semibold text-emerald-700 tabular-nums">
          {km(day.totalDistanceKm)}
        </span>
        <span className="text-xs text-gray-500">
          {formatMoney(day.fuelAllowanceAmount)}
        </span>
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            <MapIcon size={13} /> Xem lộ trình
          </a>
        )}
      </div>

      <ol className="mt-2 space-y-0">
        <li className="flex items-center gap-2 text-xs text-gray-500">
          <Home size={14} className="shrink-0 text-gray-400" />
          {home ? "Nhà" : "Nhà (chưa có vị trí)"}
          {movedHome && home && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              Nhà mới từ ngày này
            </span>
          )}
        </li>
        {day.stops.map((stop, index) => (
          <StopRow key={`${stop.placeKey}-${stop.startTime}-${index}`} stop={stop} />
        ))}
      </ol>
    </div>
  );
}

function StopRow({ stop }: { stop: TravelStop }) {
  const legLabel = !stop.counted
    ? "không tính"
    : stop.distanceKm == null
      ? "? km"
      : km(stop.distanceKm);
  const legHint =
    stop.distanceSource === "home"
      ? "nhà → trường"
      : stop.distanceSource === "previous_place"
        ? "từ điểm trước"
        : "";

  return (
    <li>
      {/* Chặng đi tới điểm này */}
      <div className="ml-[6px] flex items-center gap-2 border-l-2 border-dashed border-gray-300 py-1.5 pl-4 text-[11px] text-gray-500">
        <span
          className={`font-semibold tabular-nums ${
            stop.counted ? "text-emerald-700" : "text-gray-400"
          }`}
        >
          {legLabel}
        </span>
        {legHint && <span>({legHint})</span>}
      </div>

      <div className="flex gap-2">
        <MapPin
          size={14}
          className={`mt-0.5 shrink-0 ${
            stop.flags.length > 0 ? "text-amber-500" : "text-blue-500"
          }`}
        />
        <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-start justify-between gap-x-3">
            <p className="text-sm font-medium text-gray-800">{placeName(stop)}</p>
            <p className="text-xs text-gray-500 tabular-nums">
              {formatTime(stop.startTime)}–{formatTime(stop.endTime)} ·{" "}
              {stop.periods} tiết
            </p>
          </div>

          <p className="mt-0.5 text-[11px] text-gray-500">
            {stop.sessions
              .map((s) => [s.className, s.subjectName].filter(Boolean).join(" "))
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            <span>
              Phụ cấp:{" "}
              <b className="text-gray-800">
                {stop.gasAllowance == null ? "—" : formatMoney(stop.gasAllowance)}
              </b>
            </span>
            {stop.checkin && (
              <span>
                Check-in {formatCheckedAt(stop.checkin.at)}
                {stop.checkin.distanceM != null &&
                  ` · cách trường ${stop.checkin.distanceM.toLocaleString("vi-VN")} m`}
                {stop.checkin.latitude != null && stop.checkin.longitude != null && (
                  <>
                    {" "}
                    <a
                      href={`https://www.google.com/maps?q=${stop.checkin.latitude},${stop.checkin.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      (bản đồ)
                    </a>
                  </>
                )}
              </span>
            )}
          </div>

          {stop.flags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {stop.flags.map((flag) =>
                flag === "NOT_COUNTED" ? (
                  <NotCountedChips key={flag} stop={stop} />
                ) : (
                <span
                  key={flag}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${FLAG_META[flag].className}`}
                >
                  <AlertTriangle size={10} />
                  {FLAG_META[flag].label}
                  {flag === "UNCHECKED" &&
                    stop.uncheckedSessions < stop.sessions.length &&
                    ` (${stop.uncheckedSessions}/${stop.sessions.length} tiết)`}
                </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Lượt không có phụ cấp: nói rõ thiếu gì (nhà, trường, bậc) thay vì một nhãn
 * chung — người xem biết ngay phải bổ sung ở đâu.
 */
function NotCountedChips({ stop }: { stop: TravelStop }) {
  const chip = (text: string, key: string, tone = FLAG_META.NOT_COUNTED.className) => (
    <span
      key={key}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      <AlertTriangle size={10} />
      {text}
    </span>
  );

  const reasons = stop.missingReasons ?? [];
  if (reasons.length === 0) {
    return chip(
      "Không có phụ cấp · đủ dữ liệu, cần tính lại",
      "recompute",
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    );
  }
  return (
    <>
      {reasons.map((reason) =>
        chip(
          `Không có phụ cấp · ${missingReasonLabel(reason, stop.diagnosedDistanceKm)}`,
          reason,
        ),
      )}
    </>
  );
}
