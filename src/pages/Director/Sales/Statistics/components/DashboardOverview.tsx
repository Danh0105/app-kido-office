import type { ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  GraduationCap,
  MapPinned,
  School,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatisticsDashboardModel } from "../statisticsDashboard";

type Props = {
  model: StatisticsDashboardModel;
  isDirectorView: boolean;
  onOpenPolicies: () => void;
};

const compactNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatMoney = (value: number) => `${compactNumber(value)}đ`;

export default function DashboardOverview({
  model,
  isDirectorView,
  onOpenPolicies,
}: Props) {
  const { summary, alerts } = model;
  const totalWarnings =
    alerts.missingContract.length +
    alerts.missingStudentCount.length +
    alerts.missingPeriods.length +
    alerts.nonPositiveCompanyUnit.length;

  const cards = [
    {
      label: "Trường đang phụ trách",
      value: formatNumber(summary.schools),
      note: `${summary.provinces} tỉnh/thành`,
      icon: School,
      tone: "blue",
    },
    {
      label: "Chính sách hiệu lực",
      value: formatNumber(summary.policies),
      note: `${summary.subjects} môn học`,
      icon: FileCheck2,
      tone: "indigo",
    },
    {
      label: "Quy mô học sinh",
      value: formatNumber(summary.students),
      note: `${formatNumber(summary.periods)} tiết`,
      icon: GraduationCap,
      tone: "emerald",
    },
    {
      label: "Hồ sơ có hợp đồng",
      value: `${summary.contractCoverage}%`,
      note:
        summary.contractCoverage >= 90
          ? "Mức độ hoàn thiện tốt"
          : "Cần bổ sung hồ sơ",
      icon: CheckCircle2,
      tone: summary.contractCoverage >= 90 ? "teal" : "amber",
    },
    {
      label: "Đơn giá CTY thu BQ",
      value: formatMoney(summary.averageCompanyUnit),
      note: "Theo chính sách đã duyệt",
      icon: Banknote,
      tone: "violet",
    },
    {
      label: "Thiết bị đã phân bổ",
      value: formatNumber(summary.devices),
      note: `${model.devices.length} nhóm thiết bị`,
      icon: Building2,
      tone: "slate",
    },
  ];

  const topSchools = model.schools.slice(0, 8).map((row) => ({
    ...row,
    shortName: row.name.length > 28 ? `${row.name.slice(0, 28)}…` : row.name,
  }));
  const topSubjects = model.subjects.slice(0, 7).map((row) => ({
    ...row,
    shortName: row.name.length > 22 ? `${row.name.slice(0, 22)}…` : row.name,
  }));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
        <Panel
          eyebrow="Diễn biến danh mục"
          title="Quy mô theo năm học"
          description="So sánh số học sinh và số tiết trong các chính sách đã duyệt."
          icon={<TrendingUp size={20} />}
        >
          {model.years.length ? (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={model.years}
                  margin={{ top: 20, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="studentsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#0f766e"
                        stopOpacity={0.34}
                      />
                      <stop
                        offset="100%"
                        stopColor="#0f766e"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="periodsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#2563eb"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="#2563eb"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={compactNumber}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip content={<OverviewTooltip />} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  />
                  <Area
                    name="Học sinh"
                    type="monotone"
                    dataKey="students"
                    stroke="#0f766e"
                    strokeWidth={3}
                    fill="url(#studentsGradient)"
                  />
                  <Area
                    name="Số tiết"
                    type="monotone"
                    dataKey="periods"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#periodsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </Panel>

        <Panel
          eyebrow="Kiểm soát dữ liệu"
          title="Điểm cần chú ý"
          description="Các thiếu sót nên xử lý trước khi dùng số liệu để ra quyết định."
          icon={<AlertTriangle size={20} />}
        >
          <div className="space-y-3">
            <AlertRow
              label="Thiếu tệp/số hợp đồng"
              count={alerts.missingContract.length}
              tone="amber"
            />
            <AlertRow
              label="Chưa có số học sinh"
              count={alerts.missingStudentCount.length}
              tone="rose"
            />
            <AlertRow
              label="Chưa có số tiết"
              count={alerts.missingPeriods.length}
              tone="orange"
            />
            <AlertRow
              label="Đơn giá CTY thu không dương"
              count={alerts.nonPositiveCompanyUnit.length}
              tone="violet"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Chất lượng dữ liệu
                </p>
                <p className="mt-1 text-2xl font-black">
                  {totalWarnings === 0
                    ? "Sẵn sàng"
                    : `${totalWarnings} cảnh báo`}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  totalWarnings === 0
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-amber-400/20 text-amber-200"
                }`}
              >
                {totalWarnings === 0 ? "Tốt" : "Cần rà soát"}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenPolicies}
              className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
            >
              Mở danh sách chi tiết
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel
          eyebrow="Xếp hạng"
          title="Top trường theo quy mô"
          description="Ưu tiên các trường có số học sinh lớn trong phạm vi lọc."
          icon={<School size={20} />}
        >
          {topSchools.length ? (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSchools}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 16, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={compactNumber}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={155}
                    tick={{ fill: "#334155", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<OverviewTooltip />} />
                  <Bar
                    name="Học sinh"
                    dataKey="students"
                    fill="#0f766e"
                    radius={[0, 7, 7, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </Panel>

        <Panel
          eyebrow="Cơ cấu"
          title="Quy mô theo môn học"
          description="Nhìn nhanh nhóm môn đóng góp lớn vào danh mục hiện tại."
          icon={<GraduationCap size={20} />}
        >
          {topSubjects.length ? (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSubjects}
                  margin={{ top: 20, right: 12, left: 0, bottom: 42 }}
                >
                  <CartesianGrid
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={compactNumber}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip content={<OverviewTooltip />} />
                  <Bar
                    name="Học sinh"
                    dataKey="students"
                    fill="#2563eb"
                    radius={[7, 7, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </Panel>
      </section>

      {isDirectorView && model.provinces.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <MapPinned size={21} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Địa bàn
              </p>
              <h3 className="text-lg font-black text-slate-900">
                Tổng hợp theo tỉnh/thành
              </h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.provinces.slice(0, 8).map((province) => (
              <div
                key={province.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="truncate font-bold text-slate-900">
                  {province.name}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniMetric label="Trường" value={province.schools} />
                  <MiniMetric label="HS" value={province.students} />
                  <MiniMetric label="CS" value={province.policies} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const KPI_TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  teal: "bg-teal-50 text-teal-700 ring-teal-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof School;
  tone: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p
            className="mt-2 truncate text-2xl font-black text-slate-950"
            title={value}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${KPI_TONES[tone]}`}
        >
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Clock3 size={13} />
        {note}
      </p>
    </article>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {icon}
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function AlertRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) {
  const toneClasses: Record<string, string> = {
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
    orange: "bg-orange-50 text-orange-800 ring-orange-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ${toneClasses[tone]}`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="rounded-full bg-white px-2.5 py-1 text-sm font-black shadow-sm">
        {count}
      </span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">
        {compactNumber(value)}
      </p>
    </div>
  );
}

function OverviewTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-bold text-slate-900">{label}</p>
      {payload.map((item: any) => (
        <div
          key={item.dataKey}
          className="flex min-w-[140px] items-center justify-between gap-4 py-0.5"
        >
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="font-bold text-slate-900">
            {formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      Chưa có dữ liệu phù hợp với bộ lọc.
    </div>
  );
}
