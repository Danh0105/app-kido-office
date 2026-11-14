import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link2Off, RefreshCw, Search, UserCheck, Users, UserX } from "lucide-react";

import { attendanceApi, attendanceError, type TodayRow } from "@/service/attendance";
import { EmployeeDayModal } from "./PunchesPanel";
import { fmtDay, fmtTime, normalizeText, todayVN } from "./lib";
import { Badge, Empty, ErrorBox, Spinner, StatCard, inputClass, secondaryBtn } from "./ui";

type Filter = "all" | "present" | "absent";

export default function TodayPanel({
  isAdmin,
  onShowUnmatched,
}: {
  isAdmin: boolean;
  onShowUnmatched: () => void;
}) {
  const [date, setDate] = useState(todayVN());
  const [department, setDepartment] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TodayRow | null>(null);
  const isToday = date === todayVN();

  const q = useQuery({
    queryKey: ["attendance", "today", date, department],
    queryFn: () => attendanceApi.today(date, department),
    placeholderData: keepPreviousData,
    // "Thời gian thực": màn hôm nay tự hỏi lại máy chủ mỗi 15 giây.
    refetchInterval: isToday ? 15_000 : false,
  });

  const rows = useMemo(() => {
    const term = normalizeText(search);
    return (q.data?.rows ?? []).filter((r) => {
      if (filter === "present" && !r.punch_count) return false;
      if (filter === "absent" && r.punch_count) return false;
      if (!term) return true;
      return normalizeText(`${r.full_name} ${r.employee_no}`).includes(term);
    });
  }, [q.data, filter, search]);

  const s = q.data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-40">
          <span className="text-xs font-bold text-slate-600">Ngày</span>
          <input
            type="date"
            value={date}
            max={todayVN()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="w-48">
          <span className="text-xs font-bold text-slate-600">Phòng ban</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            <option value="">Tất cả phòng ban</option>
            {(q.data?.departments ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => q.refetch()} className={secondaryBtn} disabled={q.isFetching}>
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Làm mới
        </button>
        {q.data && (
          <span className="pb-3 text-xs text-slate-500">
            Cập nhật lúc {fmtTime(q.data.generated_at, true)}
            {isToday ? " · tự cập nhật mỗi 15 giây" : ""}
          </span>
        )}
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBox message={attendanceError(q.error)} onRetry={() => q.refetch()} />}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Nhân viên đang làm" value={s.employees} icon={<Users className="h-3.5 w-3.5" />} />
            <StatCard
              label={isToday ? "Đã chấm công" : "Có chấm công"}
              value={s.present}
              tone="green"
              icon={<UserCheck className="h-3.5 w-3.5" />}
            />
            <StatCard
              label={isToday ? "Chưa chấm" : "Không chấm"}
              value={s.absent_so_far}
              tone={s.absent_so_far ? "amber" : "slate"}
              icon={<UserX className="h-3.5 w-3.5" />}
            />
            <StatCard
              label="Mã NV chưa khớp"
              value={s.unmatched_codes}
              tone={s.unmatched_codes ? "red" : "slate"}
              icon={<Link2Off className="h-3.5 w-3.5" />}
            />
          </div>

          {s.unmatched_codes > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                Có {s.unmatched_codes} mã NV chấm công ngày {fmtDay(date)} nhưng chưa có trong danh sách nhân viên — các
                lần chấm này chưa được gắn cho ai.
              </span>
              <button type="button" onClick={onShowUnmatched} className="text-xs font-bold underline">
                Xem mã chưa khớp
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Tất cả"],
                ["present", isToday ? "Đã chấm" : "Có chấm"],
                ["absent", isToday ? "Chưa chấm" : "Không chấm"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`h-8 rounded-full px-3 text-xs font-bold transition ${
                  filter === key ? "bg-[#005BEA] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="relative ml-auto w-full md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên hoặc mã NV"
                className={`${inputClass} pl-9`}
              />
            </span>
          </div>

          {q.data && q.data.rows.length === 0 ? (
            <Empty>Chưa có nhân viên nào. Vào tab "Nhân viên" để nhập danh sách từ Excel.</Empty>
          ) : rows.length === 0 ? (
            <Empty>Không có nhân viên phù hợp bộ lọc.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white">
              {/* Điện thoại: Giờ vào/ra ngay sau tên, phòng ban hiện dưới tên, ẩn cột phụ. */}
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="hidden px-4 py-3 md:table-cell">Mã NV</th>
                    <th className="px-3 py-3 md:px-4">Họ tên</th>
                    <th className="px-3 py-3 md:px-4">Giờ vào</th>
                    <th className="px-3 py-3 md:px-4">Giờ ra</th>
                    <th className="hidden px-4 py-3 md:table-cell">Phòng ban</th>
                    <th className="hidden px-4 py-3 text-right md:table-cell">Số lần</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => r.punch_count && setSelected(r)}
                      className={r.punch_count ? "cursor-pointer hover:bg-blue-50/50" : ""}
                    >
                      <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 md:table-cell">{r.employee_no}</td>
                      <td className="px-3 py-3 md:px-4">
                        <span className="block font-bold text-slate-800">{r.full_name}</span>
                        <span className="block text-[11px] text-slate-500 md:hidden">
                          {r.employee_no}
                          {r.department ? ` · ${r.department}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3 md:px-4">
                        {r.first_in ? (
                          <span className="font-mono font-bold text-emerald-700">{fmtTime(r.first_in)}</span>
                        ) : (
                          <Badge tone="amber">{isToday ? "Chưa chấm" : "Không chấm"}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-700 md:px-4">
                        {r.last_out ? fmtTime(r.last_out) : r.first_in ? <span className="text-slate-400">—</span> : ""}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{r.department || "—"}</td>
                      <td className="hidden px-4 py-3 text-right text-slate-600 md:table-cell">{r.punch_count || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Giờ vào = lần chấm đầu tiên, giờ ra = lần chấm cuối cùng trong ngày. Đi trễ, về sớm, số công sẽ có sau khi
            hoàn thành phần tính công.
          </p>
        </>
      )}

      {selected && (
        <EmployeeDayModal
          employeeNo={selected.employee_no}
          name={selected.full_name}
          date={date}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
