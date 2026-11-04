import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CircleDollarSign,
  MapPin,
  PackageSearch,
  School,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DeviceBreakdown } from "../statisticsDashboard";

type Props = {
  devices: DeviceBreakdown[];
};

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const compactNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

export default function DeviceAnalytics({ devices }: Props) {
  const [selectedKey, setSelectedKey] = useState(devices[0]?.key || "");

  useEffect(() => {
    if (!devices.some((device) => device.key === selectedKey)) {
      setSelectedKey(devices[0]?.key || "");
    }
  }, [devices, selectedKey]);

  const selected =
    devices.find((device) => device.key === selectedKey) || devices[0];
  const chartRows = useMemo(
    () =>
      devices.slice(0, 10).map((device) => ({
        ...device,
        shortName:
          device.name.length > 20
            ? `${device.name.slice(0, 20)}…`
            : device.name,
      })),
    [devices]
  );
  const totals = devices.reduce(
    (result, device) => ({
      quantity: result.quantity + device.quantity,
      estimatedValue: result.estimatedValue + device.estimatedValue,
    }),
    { quantity: 0, estimatedValue: 0 }
  );

  if (!devices.length) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <PackageSearch size={42} className="mx-auto text-slate-400" />
        <h2 className="mt-4 text-xl font-black text-slate-900">
          Chưa có dữ liệu thiết bị
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Không tìm thấy thiết bị trong các chính sách thuộc bộ lọc hiện tại.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Boxes}
          label="Tổng số lượng"
          value={formatNumber(totals.quantity)}
          tone="blue"
        />
        <MetricCard
          icon={PackageSearch}
          label="Nhóm thiết bị"
          value={formatNumber(devices.length)}
          tone="indigo"
        />
        <MetricCard
          icon={School}
          label="Trường có thiết bị"
          value={formatNumber(
            new Set(
              devices.flatMap((device) =>
                device.allocations.map((row) => row.schoolId)
              )
            ).size
          )}
          tone="emerald"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Giá trị tham chiếu"
          value={
            totals.estimatedValue
              ? `${compactNumber(totals.estimatedValue)}đ`
              : "Chưa có đơn giá"
          }
          tone="amber"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Phân bổ thiết bị
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              10 nhóm có số lượng cao nhất
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Chọn trực tiếp một cột để xem danh sách trường được phân bổ.
            </p>
          </div>
          <div className="mt-4 h-[390px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 8, right: 26, left: 24, bottom: 4 }}
                onClick={(state: any) => {
                  const key = state?.activePayload?.[0]?.payload?.key;
                  if (key) setSelectedKey(key);
                }}
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
                  width={145}
                  tick={{ fill: "#334155", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatNumber(Number(value)),
                    "Số lượng",
                  ]}
                  cursor={{ fill: "#eff6ff" }}
                />
                <Bar
                  dataKey="quantity"
                  fill="#2563eb"
                  radius={[0, 7, 7, 0]}
                  maxBarSize={26}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Thiết bị đang xem
          </label>
          <select
            value={selected?.key || ""}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {devices.map((device) => (
              <option key={device.key} value={device.key}>
                {device.name}
              </option>
            ))}
          </select>

          {selected && (
            <div className="mt-5">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-300">{selected.name}</p>
                    <p className="mt-1 text-3xl font-black">
                      {formatNumber(selected.quantity)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      tổng số lượng đã phân bổ
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Boxes size={22} />
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-xs text-slate-400">Số trường</p>
                    <p className="mt-1 font-black">{selected.schools}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-xs text-slate-400">Giá trị</p>
                    <p className="mt-1 font-black">
                      {selected.estimatedValue
                        ? `${compactNumber(selected.estimatedValue)}đ`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 max-h-[270px] space-y-2 overflow-y-auto pr-1">
                {selected.allocations.map((allocation, index) => (
                  <button
                    key={allocation.schoolId}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">
                        {allocation.schoolName}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} /> {allocation.provinceName}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-black text-blue-700">
                        {formatNumber(allocation.quantity)}
                      </span>
                      <span className="text-[10px] uppercase text-slate-400">
                        số lượng
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Building2 size={20} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Danh mục
            </p>
            <h2 className="text-lg font-black text-slate-950">
              Toàn bộ thiết bị
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Thiết bị</th>
                <th className="px-5 py-3 text-right">Số lượng</th>
                <th className="px-5 py-3 text-right">Số trường</th>
                <th className="px-5 py-3 text-right">Giá trị tham chiếu</th>
                <th className="px-5 py-3 text-right">Tỷ trọng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((device) => (
                <tr
                  key={device.key}
                  className="cursor-pointer transition hover:bg-blue-50/50"
                  onClick={() => setSelectedKey(device.key)}
                >
                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    {device.name}
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-blue-700">
                    {formatNumber(device.quantity)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {device.schools}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {device.estimatedValue
                      ? `${formatNumber(device.estimatedValue)}đ`
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {totals.quantity
                      ? `${((device.quantity / totals.quantity) * 100).toFixed(
                          1
                        )}%`
                      : "0%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  indigo: "bg-indigo-50 text-indigo-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

function MetricCard({ icon: Icon, label, value, tone }: any) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONES[tone]}`}
        >
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className="mt-1 truncate text-xl font-black text-slate-950"
            title={value}
          >
            {value}
          </p>
        </div>
      </div>
    </article>
  );
}
