import {
  type ManagementStatRow,
  paidPercentOf,
  summarizeManagementRows,
} from "../../utils/managementStats";

export type ManagementOtherCostStat = {
  key: string;
  name: string;
  expense: number;
};

type Props = {
  ql1Expense: number;
  ql2Expense: number;
  otherCosts?: ManagementOtherCostStat[];
  totalOutside: number;
  paidAmount: number;
  remaining: number;
  rows: ManagementStatRow[];
  /** false: ẩn 3 ô Chi ngoài, Đã chi, Còn chi khi nơi đặt đã hiện sẵn. */
  showTotals?: boolean;
};

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`whitespace-nowrap text-sm font-bold tabular-nums ${tone}`}>
        {money(value)}
      </p>
    </div>
  );
}

/** Thống kê của bảng Chi Ngoài, đặt trên bảng để đọc được mà không phải cuộn ngang. */
export default function ManagementExpenseStats({
  ql1Expense,
  ql2Expense,
  otherCosts = [],
  totalOutside,
  paidAmount,
  remaining,
  rows,
  showTotals = true,
}: Props) {
  const stats = summarizeManagementRows(rows);
  const percent = paidPercentOf(totalOutside, paidAmount);
  const otherCostTotal = otherCosts.reduce(
    (sum, cost) => sum + Number(cost.expense || 0),
    0,
  );

  return (
    <section
      aria-label="Thống kê Chi Ngoài"
      className="space-y-2 bg-slate-50 p-3 text-slate-700 sm:p-4"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        {showTotals && (
          <>
            <StatCard label="Tổng chi ngoài" value={totalOutside} tone="text-red-600" />
            <StatCard label="Đã chi" value={paidAmount} tone="text-orange-600" />
            <StatCard
              label="Còn chi"
              value={remaining}
              tone={remaining < 0 ? "text-red-600" : "text-purple-600"}
            />
          </>
        )}
        <StatCard label="Chi QL1" value={ql1Expense} tone="text-emerald-700" />
        <StatCard label="Chi QL2" value={ql2Expense} tone="text-cyan-700" />
        {otherCosts.length > 0 && (
          <StatCard label="Chi khác" value={otherCostTotal} tone="text-fuchsia-700" />
        )}
      </div>

      {otherCosts.length > 1 && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {otherCosts.map((cost) => (
            <li
              key={cost.key}
              className="max-w-full break-words rounded-full bg-fuchsia-50 px-2.5 py-1 text-fuchsia-800"
            >
              {cost.name}: <span className="font-semibold">{money(cost.expense)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
          <span className="font-semibold text-slate-700">
            Đã chi {percent.toLocaleString("vi-VN")}%
          </span>
          <span className="text-slate-500">
            {stats.rowCount} dòng có số tiền · {stats.paidRows} đã chi đủ ·{" "}
            {stats.partialRows} đang chi · {stats.unpaidRows} chưa chi
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ đã chi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        {stats.overpaidRows > 0 && (
          <p className="text-xs font-semibold text-red-600">
            ⚠️ Chi vượt {money(stats.overpaidAmount)} đ ở {stats.overpaidRows} dòng
          </p>
        )}
      </div>
    </section>
  );
}
