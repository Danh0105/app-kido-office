import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, WalletCards } from "lucide-react";

type Props = {
  data: any;
  loading: boolean;
  error: string;
  onRetry: () => void;
};

export const unwrap = (value: any) =>
  value?.data && !Array.isArray(value.data) ? value.data : value || {};

const numberFrom = (sources: any[], keys: string[]) => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value === undefined || value === null || value === "") continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export const arrayFrom = (sources: any[], keys: string[]) => {
  for (const source of sources) {
    for (const key of keys) {
      if (Array.isArray(source?.[key])) return source[key];
    }
  }
  return [];
};

const sum = (items: any[], getValue: (item: any) => number) =>
  items.reduce((total, item) => total + getValue(item), 0);

const amount = (value: number) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export default function ExpenseSummary({ data, loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-3xl bg-white text-slate-500 shadow-sm">
        <Loader2 className="mr-2 animate-spin" size={22} /> Đang tải tổng hợp...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto text-rose-500" size={34} />
        <p className="mt-3 font-bold text-rose-700">Không thể tải dữ liệu tổng hợp</p>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
        <button onClick={onRetry} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">
          Thử lại
        </button>
      </div>
    );
  }

  const payload = unwrap(data);
  const sources = [payload?.summary, payload].filter(Boolean);
  const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
  const schoolItems = arrayFrom(sources, ["schoolExpenseItems", "schoolItems"]);
  const managementItems = arrayFrom(sources, ["managementExpenseItems", "managementItems"]);

  const calculatedRevenue = sum(revenues, (item) =>
    Number(item.invoiceAmount ?? item.totalAmount ??
      Number(item.unitPrice || 0) * Number(item.studentCount || 0) * Number(item.monthsCount || 0)),
  );
  const calculatedRevenuePaid = sum(revenues, (item) => Number(item.paidAmount || 0));
  const calculatedSchool = sum(schoolItems, (item) =>
    Number(item.schoolExpenseAmount ?? item.totalAmount ??
      (Number(item.teacherUnitPrice ?? item.giaovien ?? 0) +
        Number(item.taxUnitPrice ?? item.thue ?? item.tax ?? 0) +
        Number(item.csvcUnitPrice ?? item.csvc ?? 0)) *
        Number(item.studentCount || 0) * Number(item.monthsCount || 0)),
  );
  const calculatedManagement = sum(managementItems, (item) =>
    Number(item.totalOutside ?? item.totalOutsideExpense ?? item.totalAmount ??
      (Number(item.ql1UnitPrice || 0) + Number(item.ql2UnitPrice || 0)) *
        Number(item.studentCount || 0) * Number(item.monthsCount || 0)),
  );
  const calculatedExpensePaid =
    sum(schoolItems, (item) => Number(item.paidAmount || 0)) +
    sum(managementItems, (item) => Number(item.paidAmount || 0));

  const totalRevenue = numberFrom(sources, ["totalRevenue", "revenueTotal", "totalInvoice"]) ?? calculatedRevenue;
  const revenueRemaining = numberFrom(sources, ["remainingRevenue", "revenueRemaining", "totalReceivable"]);
  const revenuePaid = numberFrom(sources, ["totalRevenuePaid", "revenuePaid", "totalCollected", "collectedAmount"])
    ?? (revenueRemaining === undefined ? calculatedRevenuePaid : totalRevenue - revenueRemaining);
  const totalSchool = numberFrom(sources, ["totalSchoolExpense", "totalSchool", "schoolExpenseTotal"]) ?? calculatedSchool;
  const totalManagement = numberFrom(sources, ["totalManagementExpense", "totalManagement", "totalOutsideExpense", "totalOutside"]) ?? calculatedManagement;
  const totalExpense = numberFrom(sources, ["totalExpense", "expenseTotal"]) ?? totalSchool + totalManagement;
  const expenseRemaining = numberFrom(sources, ["remainingExpense", "expenseRemaining", "totalPayable"]);
  const expensePaid = numberFrom(sources, ["totalExpensePaid", "expensePaid", "totalPaidExpense"])
    ?? (expenseRemaining === undefined ? calculatedExpensePaid : totalExpense - expenseRemaining);
  const netCashFlow = revenuePaid - expensePaid;

  const cards = [
    ["Tổng doanh thu", totalRevenue, "text-emerald-700", "bg-emerald-50"],
    ["Đã thu", revenuePaid, "text-blue-700", "bg-blue-50"],
    ["Còn phải thu", totalRevenue - revenuePaid, "text-amber-700", "bg-amber-50"],
    ["Tổng chi dự kiến", totalExpense, "text-rose-700", "bg-rose-50"],
    ["Đã chi", expensePaid, "text-violet-700", "bg-violet-50"],
    ["Còn phải chi", totalExpense - expensePaid, "text-orange-700", "bg-orange-50"],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-emerald-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Tổng hợp thu chi</p>
            <h2 className="mt-2 text-2xl font-black">Tình hình tài chính hiện tại</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-3">
            <p className="text-xs font-bold text-emerald-100">Dòng tiền ròng</p>
            <p className={`mt-1 text-2xl font-black ${netCashFlow < 0 ? "text-rose-300" : "text-white"}`}>
              {amount(netCashFlow)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, color, background]) => (
          <div key={label} className={`rounded-3xl border border-slate-100 p-5 shadow-sm ${background}`}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-black ${color}`}>{amount(value)}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-black text-slate-900">Cơ cấu thu chi</h3>
        </div>
        <div className="divide-y divide-slate-100">
          <SummaryRow icon={<ArrowUpRight size={18} />} label="Doanh thu" value={totalRevenue} tone="emerald" />
          <SummaryRow icon={<ArrowDownRight size={18} />} label="Chi trường" value={totalSchool} tone="rose" />
          <SummaryRow icon={<ArrowDownRight size={18} />} label="Chi quản lý / chi ngoài" value={totalManagement} tone="orange" />
          <SummaryRow icon={<WalletCards size={18} />} label="Chênh lệch dự kiến" value={totalRevenue - totalExpense} tone="blue" strong />
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ icon, label, value, tone, strong = false }: any) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className={`flex items-center gap-3 px-5 py-4 ${strong ? "bg-blue-50/50" : ""}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</span>
      <span className="flex-1 font-bold text-slate-600">{label}</span>
      <span className={`text-right font-black ${strong ? "text-blue-700" : "text-slate-900"}`}>{amount(value)}</span>
    </div>
  );
}
