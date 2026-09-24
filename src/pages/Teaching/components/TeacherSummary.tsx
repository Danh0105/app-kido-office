import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { teacherApi, teachingSessionApi } from "@/service/teaching";
import {
  type AttendanceSummaryRow,
  SESSION_STATUS_META,
  type SessionStatus,
  type Teacher,
  type TeachingSession,
} from "@/types/teaching";

import {
  formatDayMonth,
  formatMinutes,
  formatMoney,
  hasGasAllowance,
  hasDeclaredPeriods,
  MINUTES_PER_PERIOD,
  periodsOf,
  schoolWithClass,
  sessionMinutes,
  startOfWeek,
  TEACHING_MONEY_FEATURES_ENABLED,
} from "../lib";

type Props = {
  /** Buổi dạy trong khoảng đang xem (đã lọc sẵn theo giáo viên đăng nhập). */
  sessions: TeachingSession[];
  /** Nhãn khoảng thời gian, ví dụ "Tháng 8, 2026". */
  rangeLabel: string;
};

/** Màu cột (blue-500) và màu ngưỡng định mức (amber-500). */
const BAR_COLOR = "#3b82f6";
const QUOTA_COLOR = "#f59e0b";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

/** Dòng phân bổ công dạy: tên + thanh tỷ trọng + số liệu. */
function ShareRow({
  title,
  subtitle,
  periods,
  sessions,
  max,
}: {
  title: string;
  subtitle: string;
  periods: number;
  sessions: number;
  max: number;
}) {
  return (
    <div className="px-3 py-2 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-500 shrink-0">
          <b className="text-gray-800">{periods}</b> tiết · {sessions} buổi
        </p>
      </div>
      <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${max > 0 ? Math.round((periods / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

/** Tổng hợp công dạy của giáo viên trong khoảng đang xem. */
export default function TeacherSummary({ sessions, rangeLabel }: Props) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [payroll, setPayroll] = useState<AttendanceSummaryRow | null>(null);

  // Định mức tuần để vẽ ngưỡng trên biểu đồ.
  useEffect(() => {
    let active = true;
    teacherApi.me().then(async (currentTeacher) => {
      if (!active) return;
      setTeacher(currentTeacher);
      if (!TEACHING_MONEY_FEATURES_ENABLED || sessions.length === 0) return;
      const dates = sessions.map((item) => item.date).sort();
      try {
        const summary = await teachingSessionApi.summary({
          fromDate: dates[0],
          toDate: dates[dates.length - 1],
          teacherId: currentTeacher.id,
        });
        if (active) setPayroll(summary.data?.[0] || null);
      } catch {
        if (active) setPayroll(null);
      }
    }).catch(() => active && setTeacher(null));
    return () => { active = false; };
  }, [sessions]);

  const stats = useMemo(() => {
    const byStatus = {} as Record<SessionStatus, number>;
    const weeks = new Map<string, number>();
    const groups = new Map<
      string,
      {
        schoolName: string;
        className: string | null;
        subjectName: string;
        sessions: number;
        periods: number;
      }
    >();

    let periods = 0;
    let minutes = 0;
    // Tiền công cộng từ `amount` của từng buổi (backend đã tính theo giá đã chốt).
    let pay = 0;
    let missingRate = 0;
    let undeclared = 0;
    let makeup = 0;
    let flagged = 0;
    let checkedIn = 0;
    let missingCheckout = 0;
    // Buổi huỷ không cần check-in nên không tính vào mẫu số.
    let markable = 0;

    sessions.forEach((session) => {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;

      if (session.status !== "CANCELLED") markable += 1;
      if (session.checkinOutOfRange || session.checkoutOutOfRange) flagged += 1;
      if (session.checkinAt) checkedIn += 1;
      if (session.checkinAt && !session.checkoutAt) missingCheckout += 1;

      // Chỉ buổi đã chấm "Có dạy" mới tính công.
      if (session.status !== "PRESENT") return;

      const sessionPeriods = periodsOf(session);
      periods += sessionPeriods;
      minutes += sessionMinutes(session);
      // `null` = Nhân sự chưa khai đơn giá, không phải 0 đồng.
      if (session.amount == null && !hasGasAllowance(session)) missingRate += 1;
      else if (session.amount != null) pay += session.amount;
      if (!hasDeclaredPeriods(session)) undeclared += 1;
      if (session.isMakeup) makeup += 1;

      const weekKey = startOfWeek(session.date);
      weeks.set(weekKey, (weeks.get(weekKey) || 0) + sessionPeriods);

      // Tách theo lớp: cùng trường + cùng môn nhưng khác lớp là hai đầu việc khác nhau.
      const key = `${session.schoolId}|${session.classId ?? 0}|${session.subjectId}`;
      const group = groups.get(key) || {
        schoolName: session.schoolName,
        className: session.className,
        subjectName: session.subjectName,
        sessions: 0,
        periods: 0,
      };
      group.sessions += 1;
      group.periods += sessionPeriods;
      groups.set(key, group);
    });

    const taught = byStatus.PRESENT || 0;

    return {
      byStatus,
      taught,
      periods,
      minutes,
      pay,
      missingRate,
      undeclared,
      makeup,
      flagged,
      checkedIn,
      markable,
      missingCheckout,
      weekly: Array.from(weeks.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, value]) => ({ week: formatDayMonth(week), periods: value })),
      rows: Array.from(groups.values()).sort((a, b) => b.periods - a.periods),
    };
  }, [sessions]);

  const quota = teacher?.maxPeriodsPerWeek ?? null;
  const weeksCount = stats.weekly.length;
  const avgPerWeek = weeksCount > 0 ? Math.round(stats.periods / weeksCount) : 0;
  const maxRowPeriods = stats.rows[0]?.periods || 0;

  return (
    <div className="space-y-3">
      {/* Con số chính của kỳ */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs text-blue-700">Tiết đã dạy · {rangeLabel}</p>
        <p className="text-4xl font-bold text-blue-600 leading-tight">
          {stats.periods}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {stats.taught} buổi · {formatMinutes(stats.minutes)}
          {stats.makeup > 0 ? ` · ${stats.makeup} buổi dạy bù` : ""}
        </p>
        {weeksCount > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">
            Trung bình {avgPerWeek} tiết/tuần
            {quota == null ? " · không giới hạn" : ` · định mức ${quota} tiết/tuần`}
          </p>
        )}

        {/* Chỉ buổi đã chấm "Có dạy" mới được tính tiền. */}
        {TEACHING_MONEY_FEATURES_ENABLED && (
          <>
            <p className="text-sm font-semibold text-emerald-700 mt-2">
              Tổng tạm tính: {formatMoney(payroll?.totalPayableAmount ?? stats.pay)}
            </p>
            {(payroll?.fuelAllowanceAmount ?? 0) > 0 && (
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Tiền theo tiết {formatMoney(payroll?.payableAmount ?? 0)} · Phụ cấp xăng {formatMoney(payroll?.fuelAllowanceAmount ?? 0)}
              </p>
            )}
            {(payroll?.missingRateSessions ?? stats.missingRate) > 0 && (
              <p className="text-[11px] text-amber-700 mt-0.5">
                {payroll?.missingRateSessions ?? stats.missingRate} buổi thiếu cấu hình thanh toán nên chưa vào số này.
              </p>
            )}
          </>
        )}
      </div>

      {/* Số tiết theo tuần */}
      {stats.weekly.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3">
          <p className="text-sm font-semibold text-gray-800">Số tiết theo tuần</p>
          <p className="text-[11px] text-gray-400 mb-2">
            Trục ngang là ngày đầu tuần
            {quota != null ? ` · vạch cam là định mức ${quota} tiết` : ""}
          </p>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={stats.weekly}
              margin={{ top: 18, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                formatter={(value: number) => [`${value} tiết`, "Đã dạy"]}
                labelFormatter={(label) => `Tuần từ ${label}`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              {quota != null && (
                <ReferenceLine
                  y={quota}
                  stroke={QUOTA_COLOR}
                  strokeDasharray="4 4"
                  label={{
                    value: `Định mức ${quota}`,
                    position: "insideTopRight",
                    fill: "#b45309",
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                dataKey="periods"
                fill={BAR_COLOR}
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  dataKey="periods"
                  position="top"
                  fill="#374151"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Buổi đã dạy" value={String(stats.taught)} />
        <StatTile label="Tổng giờ dạy" value={formatMinutes(stats.minutes)} />
        <StatTile
          label="Chưa chấm công"
          value={String(stats.byStatus.SCHEDULED || 0)}
          hint="Nhân sự chấm sau buổi dạy"
        />
        <StatTile
          label="Đã check-in"
          value={`${stats.checkedIn}/${stats.markable}`}
          hint={
            stats.missingCheckout > 0
              ? `${stats.missingCheckout} buổi chưa check-out`
              : "Đủ check-in / check-out"
          }
        />
      </div>

      {/* Các trạng thái còn lại */}
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
        {(["ABSENT", "CANCELLED"] as SessionStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${SESSION_STATUS_META[status].dot}`}
            />
            <span className="text-gray-500">
              {SESSION_STATUS_META[status].label}
            </span>
            <b className="text-gray-800">{stats.byStatus[status] || 0}</b>
          </span>
        ))}
      </div>

      {stats.undeclared > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
          {stats.undeclared} buổi chưa được khai báo số tiết — đang tạm quy đổi{" "}
          {MINUTES_PER_PERIOD} phút/tiết theo khung giờ. Nhờ Nhân sự khai báo số
          tiết để con số chính xác.
        </p>
      )}

      {stats.flagged > 0 && (
        <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          {stats.flagged} buổi chấm vị trí ngoài bán kính cho phép.
        </p>
      )}

      {/* Công dạy rơi vào trường / môn nào */}
      {stats.rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <p className="text-sm font-semibold text-gray-800 px-3 pt-3">
            Phân bổ theo trường
          </p>
          <div className="divide-y divide-gray-50 mt-1">
            {stats.rows.map((row) => (
              <ShareRow
                key={`${row.schoolName}-${row.className}-${row.subjectName}`}
                title={schoolWithClass(row)}
                subtitle={`Môn ${row.subjectName}`}
                periods={row.periods}
                sessions={row.sessions}
                max={maxRowPeriods}
              />
            ))}
          </div>
        </div>
      )}

      {stats.taught === 0 && (
        <p className="text-xs text-gray-400 text-center px-4">
          Chưa có buổi nào được chấm “Có dạy” trong {rangeLabel.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
