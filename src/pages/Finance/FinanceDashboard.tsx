import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlarmClock,
  Bell,
  CircleDollarSign,
  ClipboardCheck,
  HandCoins,
  Hourglass,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react";

import { financeApi } from "@/service/finance";
import type { FinanceRequestType } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { Card, ErrorState, Kpi, LoadingState } from "./components/FinanceUi";
import { useFinanceMeta } from "./FinanceRoutes";
import {
  TYPE_LABELS,
  formatDateTime,
  formatMoney,
  inputClass,
  labelClass,
  todayVN,
  useFinanceBase,
} from "./lib";

const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const VIOLET = "#8b5cf6";

const axis = {
  tickLine: false,
  axisLine: { stroke: "#e5e7eb" },
  tick: { fill: "#9ca3af", fontSize: 11 },
} as const;

const tooltipStyle = { borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 };
const compact = (value: number) =>
  value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`
    : value >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`
      : formatMoney(value);
const moneyTooltip = (value: number) => `${formatMoney(value)} đ`;

const firstOfYear = () => `${todayVN().slice(0, 4)}-01-01`;

export default function FinanceDashboard() {
  const meta = useFinanceMeta();
  const base = useFinanceBase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    companyId: "",
    departmentId: "",
    type: "",
    dateFrom: firstOfYear(),
    dateTo: todayVN(),
  });
  const set = (key: keyof typeof filters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  const summary = useQuery({
    queryKey: ["finance-summary", filters],
    queryFn: () => financeApi.summary(filters),
  });
  const notifications = useQuery({
    queryKey: ["finance-notifications"],
    queryFn: () => financeApi.notifications(1, 8),
  });
  const notificationRows = useMemo(() => {
    const raw = notifications.data as any;
    return (Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? []) as any[];
  }, [notifications.data]);

  const k = summary.data?.kpis;
  const charts = summary.data?.charts;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className={labelClass}>
          Công ty
          <select className={inputClass} value={filters.companyId} onChange={(e) => set("companyId", e.target.value)}>
            <option value="">Tất cả</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
        {meta.capabilities.canViewAll && (
          <label className={labelClass}>
            Phòng ban
            <select className={inputClass} value={filters.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
              <option value="">Tất cả</option>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={labelClass}>
          Loại chứng từ
          <select className={inputClass} value={filters.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(TYPE_LABELS) as FinanceRequestType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Từ ngày
          <input type="date" className={inputClass} value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
        </label>
        <label className={labelClass}>
          Đến ngày
          <input type="date" className={inputClass} value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
        </label>
        {!meta.capabilities.canViewAll && (
          <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-5">Số liệu chỉ gồm các đề nghị của bạn.</p>
        )}
      </section>

      {summary.isError && (
        <ErrorState message={getApiErrorMessage(summary.error, "Không tải được số liệu.")} onRetry={() => void summary.refetch()} />
      )}
      {summary.isLoading && <LoadingState text="Đang tính số liệu…" />}

      {k && charts && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Tổng đề nghị trong kỳ" value={`${formatMoney(k.totalRequested)} đ`} icon={<Receipt size={15} />} />
            <Kpi label="Tổng được duyệt" value={`${formatMoney(k.totalApproved)} đ`} tone="emerald" icon={<ClipboardCheck size={15} />} />
            <Kpi label="Tổng đã thanh toán" value={`${formatMoney(k.totalPaid)} đ`} tone="emerald" icon={<CircleDollarSign size={15} />} />
            <Kpi label="Tạm ứng chưa hoàn ứng" value={`${formatMoney(k.advanceOutstanding)} đ`} tone="amber" hint="Số dư hiện tại" icon={<Wallet size={15} />} />
            <Kpi label="Hoàn ứng trong kỳ" value={`${formatMoney(k.settledInPeriod)} đ`} tone="sky" icon={<Undo2 size={15} />} />
            <Kpi label="Công nợ phải trả nhân viên" value={`${formatMoney(k.payableToEmployees)} đ`} tone="amber" hint="Đã duyệt, chưa chi" icon={<HandCoins size={15} />} />
            <Kpi label="Tiền cần thu hồi" value={`${formatMoney(k.receivable)} đ`} tone="violet" icon={<Undo2 size={15} />} />
            <Kpi label="Ứng lương chưa khấu trừ" value={`${formatMoney(k.salaryAdvanceOutstanding)} đ`} tone="violet" icon={<Wallet size={15} />} />
            <Kpi label="Phiếu đang chờ duyệt" value={k.pendingCount} tone="amber" icon={<Hourglass size={15} />} />
            <Kpi label="Tạm ứng quá hạn" value={k.overdueAdvanceCount} tone="rose" icon={<AlarmClock size={15} />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Chi phí theo tháng">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" {...axis} />
                  <YAxis {...axis} tickFormatter={compact} width={56} />
                  <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="requested" name="Đề nghị" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="approved" name="Được duyệt" fill={EMERALD} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="paid" name="Đã chi" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Tạm ứng và hoàn ứng theo tháng">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.advanceVsSettlement} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" {...axis} />
                  <YAxis {...axis} tickFormatter={compact} width={56} />
                  <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="advancePaid" name="Tạm ứng đã chi" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="settled" name="Hoàn ứng đã duyệt" fill={VIOLET} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <HorizontalBars title="Chi phí theo công ty" data={charts.byCompany} />
            <HorizontalBars title="Chi phí theo phòng ban" data={charts.byDepartment} />
            <HorizontalBars title="Chi phí theo danh mục" data={charts.byCategory} color={EMERALD} />
            <Card title="Trạng thái phê duyệt">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.statusCounts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} allowDecimals={false} width={32} />
                  <Tooltip formatter={(value: number) => `${value} phiếu`} contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="count" name="Số phiếu" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      <Card title="Thông báo tài chính" icon={<Bell size={16} />}>
        {notifications.isLoading && <p className="text-sm text-slate-400">Đang tải…</p>}
        {!notifications.isLoading && notificationRows.length === 0 && (
          <p className="text-sm text-slate-400">Chưa có thông báo.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {notificationRows.map((noti) => (
            <li key={noti.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 py-2.5 text-left"
                onClick={async () => {
                  if (!noti.isRead) {
                    await financeApi.markNotificationRead(noti.id).catch(() => undefined);
                    void queryClient.invalidateQueries({ queryKey: ["finance-notifications"] });
                  }
                  if (noti.entityId) navigate(`${base}/requests/${noti.entityId}`);
                }}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${noti.isRead ? "bg-slate-200" : "bg-blue-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${noti.isRead ? "text-slate-500" : "font-semibold text-slate-800"}`}>{noti.message}</span>
                  <span className="text-[11px] text-slate-400">{formatDateTime(noti.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function HorizontalBars({
  title,
  data,
  color = BLUE,
}: {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
}) {
  const rows = data.slice(0, 8);
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Chưa có số liệu đã duyệt.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
            <XAxis type="number" {...axis} tickFormatter={compact} />
            <YAxis type="category" dataKey="name" {...axis} width={120} />
            <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
            <Bar dataKey="value" name="Được duyệt" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
