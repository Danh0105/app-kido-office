import {
  AlertCircle,
  Banknote,
  Building2,
  CircleDollarSign,
  Clock3,
  Loader2,
  ReceiptText,
  WalletCards,
} from "lucide-react";

type Props = {
  data: any;
  loading: boolean;
  error: string;
  onRetry: () => void;
  school?: any;
};

export const unwrap = (value: any) =>
  value?.data && !Array.isArray(value.data) ? value.data : value || {};

export const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

export const formatCurrency = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return `${new Intl.NumberFormat("vi-VN").format(parsed)} đ`;
};

const sum = (items: any[], getValue: (item: any) => number) =>
  items.reduce((total, item) => total + getValue(item), 0);

export default function ExpenseSummary({
  data,
  loading,
  error,
  onRetry,
  school,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-3xl bg-white text-slate-500 shadow-sm">
        <Loader2 className="mr-2 animate-spin" size={22} />
        Đang tải tổng hợp...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto text-rose-500" size={34} />
        <p className="mt-3 font-bold text-rose-700">
          Không thể tải dữ liệu tổng hợp
        </p>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const payload = unwrap(data);
  const sources = [payload?.summary, payload].filter(Boolean);
  const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
  const schoolItems = arrayFrom(sources, ["schoolExpenseItems", "schoolItems"]);
  const managementItems = arrayFrom(sources, [
    "managementExpenseItems",
    "managementItems",
  ]);
  const cashPolicyItems = arrayFrom(sources, [
    "cashPolicyItems",
    "cashPolicies",
  ]);

  const calculatedRevenue = sum(revenues, (item) =>
    toNumber(
      item.invoiceAmount ??
        item.totalAmount ??
        toNumber(item.unitPrice) *
          toNumber(item.studentCount) *
          toNumber(item.monthsCount)
    )
  );
  const calculatedRevenuePaid = sum(revenues, (item) =>
    toNumber(item.paidAmount)
  );
  const calculatedSchool = sum(schoolItems, (item) =>
    toNumber(
      item.schoolExpenseAmount ??
        item.totalAmount ??
        (toNumber(item.teacherUnitPrice ?? item.giaovien) +
          toNumber(item.taxUnitPrice ?? item.thue ?? item.tax) +
          toNumber(item.csvcUnitPrice ?? item.csvc)) *
          toNumber(item.studentCount) *
          toNumber(item.monthsCount)
    )
  );
  const calculatedManagement = sum(managementItems, (item) =>
    toNumber(
      item.totalOutside ??
        item.totalOutsideExpense ??
        item.totalAmount ??
        (Math.max(0, toNumber(item.ql1UnitPrice) - toNumber(item.ql1Tax)) +
          Math.max(0, toNumber(item.ql2UnitPrice) - toNumber(item.ql2Tax))) *
          toNumber(item.studentCount) *
          toNumber(item.monthsCount) +
          (Array.isArray(item.otherCosts) ? item.otherCosts : []).reduce(
            (total: number, cost: any) =>
              total +
              Math.max(
                0,
                toNumber(cost.unitPrice ?? cost.percent ?? cost.value) -
                  toNumber(cost.tax),
              ),
            0,
          )
    )
  );
  const calculatedExpensePaid =
    sum(schoolItems, (item) => toNumber(item.paidAmount)) +
    sum(managementItems, (item) => toNumber(item.paidAmount));
  const calculatedCashPolicy = sum(
    cashPolicyItems,
    (item) => toNumber(item.cashPolicyAmount) + toNumber(item.otherAmount)
  );

  const totalRevenue =
    numberFrom(sources, ["totalRevenue", "revenueTotal", "totalInvoice"]) ??
    calculatedRevenue;
  const totalExpense =
    numberFrom(sources, ["totalExpense", "expenseTotal"]) ??
    calculatedSchool + calculatedManagement;
  const totalCashPolicy =
    numberFrom(sources, ["totalCashPolicy", "cashPolicyTotal"]) ??
    calculatedCashPolicy;
  const explicitRevenueRemaining = numberFrom(sources, [
    "remainingRevenue",
    "revenueRemaining",
    "totalReceivable",
  ]);
  const revenuePaid =
    numberFrom(sources, [
      "totalRevenuePaid",
      "revenuePaid",
      "totalCollected",
      "collectedAmount",
    ]) ??
    (explicitRevenueRemaining === undefined
      ? calculatedRevenuePaid
      : totalRevenue - explicitRevenueRemaining);
  const remainingRevenue =
    explicitRevenueRemaining ?? totalRevenue - revenuePaid;
  const explicitExpenseRemaining = numberFrom(sources, [
    "remainingExpense",
    "expenseRemaining",
    "totalPayable",
  ]);
  const expensePaid =
    numberFrom(sources, [
      "totalExpensePaid",
      "expensePaid",
      "totalPaidExpense",
    ]) ??
    (explicitExpenseRemaining === undefined
      ? calculatedExpensePaid
      : totalExpense - explicitExpenseRemaining);
  const remainingExpense =
    explicitExpenseRemaining ?? totalExpense - expensePaid;
  const expenseItems = arrayFrom(sources, ["expenseItems", "items"]);
  const incompleteCount =
    numberFrom(sources, ["incompleteCount", "pendingItemsCount"]) ??
    (expenseItems.length
      ? expenseItems.filter(
          (item) => toNumber(item.remainingOutsideExpense ?? item.remaining) > 0
        ).length
      : revenues.filter(
          (item) =>
            toNumber(
              item.remainingAmount ??
                toNumber(item.invoiceAmount) - toNumber(item.paidAmount)
            ) > 0
        ).length +
        schoolItems.filter(
          (item) =>
            toNumber(
              item.remaining ??
                toNumber(item.schoolExpenseAmount) - toNumber(item.paidAmount)
            ) > 0
        ).length +
        managementItems.filter(
          (item) =>
            toNumber(
              item.remaining ??
                toNumber(item.totalOutside ?? item.totalOutsideExpense) -
                  toNumber(item.paidAmount)
            ) > 0
        ).length);

  const summarySource = sources[0] || {};
  const period = summarySource.period || summarySource.expensePeriod || {};
  const schoolName =
    school?.name || summarySource.school?.name || summarySource.schoolName;
  const periodName =
    period.name ||
    summarySource.periodName ||
    (period.month && period.year
      ? `Tháng ${period.month}/${period.year}`
      : "Kỳ thu chi hiện tại");

  const cards = [
    {
      label: "Tổng doanh thu",
      value: totalRevenue,
      icon: CircleDollarSign,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Tổng chi",
      value: totalExpense,
      icon: ReceiptText,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Chính sách tiền mặt",
      value: totalCashPolicy,
      icon: Banknote,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Còn phải thu",
      value: remainingRevenue,
      icon: WalletCards,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Còn phải chi",
      value: remainingExpense,
      icon: WalletCards,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-blue-200">
              <Building2 size={18} />
              {schoolName || "Chi tiết thu chi trường học"}
            </div>
            <h2 className="mt-2 text-2xl font-black">{periodName}</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-3">
            <p className="text-sm font-bold text-blue-100">Còn lại dự kiến</p>
            <p className="mt-1 text-2xl font-black">
              {formatCurrency(totalRevenue - totalExpense - totalCashPolicy)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {formatCurrency(value)}
                </p>
              </div>
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}
              >
                <Icon size={23} />
              </span>
            </div>
          </div>
        ))}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-500">
                Dòng chưa hoàn thành
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {incompleteCount}
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Clock3 size={23} />
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
