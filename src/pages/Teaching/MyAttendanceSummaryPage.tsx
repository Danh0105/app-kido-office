import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Building2, Home, MapPin } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type {
  GasAllowanceMissingReason,
  MyAttendanceSummary,
  MyTravelStop,
  TravelFlag,
} from "@/types/teaching";

import TeachingLayout from "./components/TeachingLayout";
import TeacherTabs from "./components/TeacherTabs";
import { EmptyState, FilterCard, Loading, selectClass } from "./components/Shared";
import {
  addDays,
  endOfMonth,
  formatDate,
  formatMoney,
  formatTime,
  isDateOrderValid,
  startOfMonth,
  todayISO,
} from "./lib";

/** Cùng giới hạn với backend: xem tối đa ~một quý mỗi lần. */
const MAX_DAYS = 93;

/** 12 tháng gần nhất để chọn nhanh, mới nhất trước. */
const RECENT_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { value, label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` };
});

/** Nhãn điểm cần lưu ý — lời cho giáo viên, không phải cho Nhân sự rà soát. */
const FLAG_META: Record<TravelFlag, { label: string; className: string }> = {
  UNCHECKED: { label: "Chưa chấm công", className: "bg-slate-100 text-slate-700 border-slate-200" },
  NOT_COUNTED: { label: "Chưa tính phụ cấp", className: "bg-red-50 text-red-700 border-red-200" },
  NO_DISTANCE: { label: "Chưa tính được km", className: "bg-amber-50 text-amber-700 border-amber-200" },
  NO_CHECKIN: { label: "Không check-in", className: "bg-amber-50 text-amber-700 border-amber-200" },
  CHECKIN_OUT_OF_RANGE: { label: "Check-in ngoài bán kính", className: "bg-red-50 text-red-700 border-red-200" },
  CHECKOUT_OUT_OF_RANGE: { label: "Check-out ngoài bán kính", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

const MISSING_REASON_LABELS: Record<GasAllowanceMissingReason, string> = {
  NO_TEACHER_LOCATION: "chưa có vị trí nhà của bạn — báo phòng Nhân sự",
  NO_SCHOOL_LOCATION: "trường chưa có toạ độ — báo phòng Nhân sự",
  NO_MATCHING_TIER: "quãng đường không khớp bậc phụ cấp — báo phòng Nhân sự",
  INVALID_DISTANCE: "toạ độ nhà/trường sai — báo phòng Nhân sự",
  ROUTE_UNAVAILABLE: "chưa tính được tuyến đường — phòng Nhân sự sẽ tính lại",
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

const km = (value: number) => `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`;

const placeName = (stop: MyTravelStop) =>
  [stop.schoolName, stop.locationName].filter(Boolean).join(" · ") || "Trường chưa rõ";

function Tile({ label, value, tone = "text-gray-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * Tổng hợp chấm công + quãng đường của chính giáo viên công ty: số buổi theo
 * trạng thái, số tiết, km và phụ cấp xăng (phần đã chấm công — khớp bảng công
 * của Nhân sự), kèm lộ trình từng ngày. Mọi con số do backend tính.
 */
export default function MyAttendanceSummaryPage() {
  const today = todayISO();
  const [fromDate, setFromDate] = useState(startOfMonth(today));
  const [toDate, setToDate] = useState(endOfMonth(today));
  const [data, setData] = useState<MyAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const rangeValid = isDateOrderValid(fromDate, toDate);
  const rangeTooLong = rangeValid && !!fromDate && !!toDate && addDays(fromDate, MAX_DAYS - 1) < toDate;

  const load = useCallback(async () => {
    if (!fromDate || !toDate || !rangeValid || rangeTooLong) return;
    setLoading(true);
    try {
      setData(await teachingSessionApi.mySummary({ fromDate, toDate }));
      setNotFound(false);
    } catch (error: any) {
      // 404 = tài khoản chưa gắn hồ sơ giáo viên.
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error(getApiErrorMessage(error, "Không tải được bản tổng hợp"));
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, rangeValid, rangeTooLong]);

  useEffect(() => {
    load();
  }, [load]);

  const changeMonth = (value: string) => {
    if (!value) return;
    setFromDate(startOfMonth(`${value}-01`));
    setToDate(endOfMonth(`${value}-01`));
  };

  const a = data?.attendance;

  return (
    <TeachingLayout title="Tổng hợp chấm công & quãng đường">
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
            {!rangeValid && (
              <p className="text-xs text-red-500 md:col-span-4">Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc</p>
            )}
            {rangeTooLong && (
              <p className="text-xs text-red-500 md:col-span-4">Chỉ xem tối đa {MAX_DAYS} ngày mỗi lần</p>
            )}
          </FilterCard>

          {loading && !data ? (
            <Loading />
          ) : data && a ? (
            <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 space-y-2">
                <p className="text-xs text-emerald-900">
                  {formatDate(data.fromDate)} → {formatDate(data.toDate)}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile label="Quãng đường (đã chấm công)" value={km(data.totalDistanceKm)} tone="text-emerald-700" />
                  <Tile label="Phụ cấp xăng (đã chấm công)" value={formatMoney(data.fuelAllowanceAmount)} tone="text-emerald-700" />
                  <Tile label="Tiết có dạy" value={`${a.presentPeriods.toLocaleString("vi-VN")} / ${a.totalPeriods.toLocaleString("vi-VN")}`} />
                  <Tile label="Buổi có dạy" value={`${a.present.toLocaleString("vi-VN")} / ${a.totalSessions.toLocaleString("vi-VN")}`} />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <Tile label="Tổng buổi" value={a.totalSessions.toLocaleString("vi-VN")} />
                  <Tile label="Có dạy" value={a.present.toLocaleString("vi-VN")} tone="text-green-700" />
                  <Tile label="Vắng" value={(a.absent + a.excused).toLocaleString("vi-VN")} tone="text-red-600" />
                  <Tile label="Huỷ" value={a.cancelled.toLocaleString("vi-VN")} tone="text-gray-600" />
                  <Tile label="Chưa chấm" value={a.unchecked.toLocaleString("vi-VN")} tone="text-blue-700" />
                  <Tile label="Dạy bù" value={a.makeup.toLocaleString("vi-VN")} tone="text-purple-700" />
                </div>
              </section>

              {data.uncheckedSessions > 0 && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <b>{data.uncheckedSessions}</b> tiết đã tới ngày dạy nhưng chưa được chấm công — km và phụ cấp
                    của các lượt đó chưa tính vào tổng ở trên.
                  </span>
                </p>
              )}

              <h3 className="px-1 text-sm font-bold text-gray-800">Lộ trình từng ngày</h3>
              {data.days.length === 0 ? (
                <EmptyState
                  icon="🛵"
                  title="Chưa có lượt đi dạy nào trong khoảng này"
                  description="Chọn tháng khác để xem lại quãng đường đã đi."
                />
              ) : (
                <ul className="space-y-2">
                  {[...data.days].reverse().map((day) => (
                    <li key={day.date} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-800">
                          {weekdayOf(day.date)}, {formatDate(day.date)}
                        </p>
                        <p className="text-sm tabular-nums">
                          <b className="text-emerald-700">{km(day.totalDistanceKm)}</b>
                          <span className="text-gray-400"> · </span>
                          <b className="text-gray-800">{formatMoney(day.fuelAllowanceAmount)}</b>
                        </p>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        {day.fromOffice ? <Building2 size={13} /> : <Home size={13} />}
                        Xuất phát từ {day.fromOffice ? "văn phòng (trường khu vực TP.HCM)" : "nhà"}
                      </p>
                      <ol className="mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                        {day.stops.map((stop, index) => (
                          <li key={`${stop.startTime}-${index}`} className="text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="min-w-0 text-gray-800">
                                <MapPin size={13} className="mr-1 inline text-gray-400" />
                                <span className="font-medium">{placeName(stop)}</span>
                                <span className="text-gray-500">
                                  {" "}
                                  · {formatTime(stop.startTime)}–{formatTime(stop.endTime)} · {stop.periods} tiết
                                </span>
                              </p>
                              <p className="shrink-0 text-xs tabular-nums text-gray-600">
                                {stop.distanceKm != null ? km(stop.distanceKm) : "— km"}
                                {stop.gasAllowance != null && ` · ${formatMoney(stop.gasAllowance)}`}
                              </p>
                            </div>
                            {stop.sessions.some((s) => s.subjectName || s.className) && (
                              <p className="text-xs text-gray-500">
                                {stop.sessions
                                  .map((s) => [s.subjectName, s.className].filter(Boolean).join(" "))
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            )}
                            {stop.flags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {stop.flags.map((flag) => (
                                  <span
                                    key={flag}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${FLAG_META[flag].className}`}
                                  >
                                    {FLAG_META[flag].label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {stop.missingReasons && stop.missingReasons.length > 0 && (
                              <p className="mt-0.5 text-xs text-red-600">
                                Chưa tính phụ cấp vì {stop.missingReasons.map((r) => MISSING_REASON_LABELS[r]).join("; ")}.
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </TeachingLayout>
  );
}
