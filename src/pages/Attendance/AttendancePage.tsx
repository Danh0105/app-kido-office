import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Link2Off, ScanFace, TriangleAlert, Users, Wifi, WifiOff } from "lucide-react";

import {
  attendanceApi,
  attendanceConfigured,
  attendanceError,
  attendanceStatus,
  type DevicesResponse,
} from "@/service/attendance";
import EmployeesPanel from "./EmployeesPanel";
import PunchesPanel from "./PunchesPanel";
import TodayPanel from "./TodayPanel";
import UnmatchedPanel from "./UnmatchedPanel";
import { timeAgo } from "./lib";
import { ErrorBox, Spinner } from "./ui";

type Tab = "today" | "punches" | "employees" | "unmatched";

function DeviceStatus({ data }: { data?: DevicesResponse }) {
  if (!data) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {data.devices.map((d) => (
        <span
          key={d.id}
          title={`Lần cuối nhận tín hiệu: ${timeAgo(d.last_seen_at)}`}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
            d.online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {d.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {d.name}: {d.online ? "đang kết nối" : `mất kết nối (${timeAgo(d.last_seen_at)})`}
        </span>
      ))}
      {data.clock_drift.warn && data.clock_drift.median_seconds !== null && (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5" />
          Đồng hồ máy lệch {Math.abs(data.clock_drift.median_seconds)} giây — kiểm tra NTP trên máy
        </span>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const [tab, setTab] = useState<Tab>("today");

  const me = useQuery({
    queryKey: ["attendance", "me"],
    queryFn: attendanceApi.me,
    enabled: attendanceConfigured,
    retry: (count, error) => ![401, 403].includes(attendanceStatus(error) ?? 0) && count < 2,
    staleTime: 5 * 60_000,
  });
  const devices = useQuery({
    queryKey: ["attendance", "devices"],
    queryFn: attendanceApi.devices,
    enabled: me.isSuccess,
    refetchInterval: 30_000,
  });
  const unmatchedCount = useQuery({
    queryKey: ["attendance", "unmatched"],
    queryFn: attendanceApi.unmatched,
    enabled: me.isSuccess,
  }).data?.unmatched.length;

  const isAdmin = me.data?.access === "admin";

  const tabs: { key: Tab; label: string; icon: ReactNode; badge?: number }[] = [
    { key: "today", label: "Hôm nay", icon: <ScanFace className="h-4 w-4" /> },
    { key: "punches", label: "Lần chấm", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "employees", label: "Nhân viên", icon: <Users className="h-4 w-4" /> },
    { key: "unmatched", label: "Mã chưa khớp", icon: <Link2Off className="h-4 w-4" />, badge: unmatchedCount },
  ];

  let body: ReactNode;
  if (!attendanceConfigured) {
    body = (
      <ErrorBox message="Chưa cấu hình địa chỉ máy chủ chấm công (VITE_ATTENDANCE_API_URL). Báo bộ phận kỹ thuật." />
    );
  } else if (me.isLoading) {
    body = <Spinner />;
  } else if (me.isError) {
    body = (
      <ErrorBox
        message={
          attendanceStatus(me.error) === 403
            ? "Tài khoản của bạn không có quyền xem chấm công."
            : attendanceError(me.error)
        }
        onRetry={attendanceStatus(me.error) === 403 ? undefined : () => me.refetch()}
      />
    );
  } else {
    body = (
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                  tab === t.key ? "bg-white text-[#005BEA] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.icon}
                {t.label}
                {Boolean(t.badge) && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#FFFDF6] p-4 md:p-5">
          {tab === "today" && <TodayPanel isAdmin={isAdmin} onShowUnmatched={() => setTab("unmatched")} />}
          {tab === "punches" && <PunchesPanel isAdmin={isAdmin} />}
          {tab === "employees" && <EmployeesPanel isAdmin={isAdmin} />}
          {tab === "unmatched" && <UnmatchedPanel isAdmin={isAdmin} />}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8E6] pb-12 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-blue-100/80 bg-white/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#005BEA]">Nhân sự</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 md:text-2xl">Máy chấm công</h1>
          </div>
          {me.data && (
            <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500">
              {isAdmin ? "Quyền: Quản trị" : "Quyền: Chỉ xem"}
            </span>
          )}
        </div>
        <div className="mt-3">
          <DeviceStatus data={devices.data} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-5 md:px-8">{body}</main>
    </div>
  );
}
