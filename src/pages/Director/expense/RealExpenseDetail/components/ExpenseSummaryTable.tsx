import { useMemo, useState } from "react";
import { arrayFrom, formatCurrency, toNumber, unwrap } from "./ExpenseSummary";

type Props = {
  data: any;
  subjects: any[];
  school?: any;
};

const formatDate = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "--";
  const raw =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("vi-VN");
};

export default function ExpenseSummaryTable({ data, subjects }: Props) {
  const [onlyRemaining, setOnlyRemaining] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const payload = unwrap(data);
  const sources = [payload?.summary, payload].filter(Boolean);

  const rows = useMemo(() => {
    const expenseItems = arrayFrom(sources, ["expenseItems", "items"]);
    if (expenseItems.length) {
      return expenseItems.map((item, index) => ({
        key: item.id ?? `${item.subjectId || "subject"}-${index}`,
        subjectId: toNumber(item.subjectId ?? item.subject?.id),
        subjectName: item.subject?.name || item.subject?.code,
        totalPeriods: item.totalPeriods,
        studentCount: item.studentCount,
        invoiceAmount: toNumber(item.invoiceAmount),
        collectedDate: item.collectedDate,
        totalOutsideExpense: toNumber(item.totalOutsideExpense),
        paidAmount: toNumber(item.paidAmount),
        remainingOutsideExpense: toNumber(
          item.remainingOutsideExpense ??
            toNumber(item.totalOutsideExpense) - toNumber(item.paidAmount)
        ),
        paymentDate: item.paymentDate,
        payer: item.payer,
        revenueAmount: toNumber(item.revenueAmount),
        expenseAmount: toNumber(item.expenseAmount),
        note: item.note,
        period: item.summaryPeriod || item.period || item.expensePeriod,
      }));
    }

    const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
    const schoolItems = arrayFrom(sources, [
      "schoolExpenseItems",
      "schoolItems",
    ]);
    const managementItems = arrayFrom(sources, [
      "managementExpenseItems",
      "managementItems",
    ]);
    const rowMap = new Map<string, any>();

    const addItems = (
      items: any[],
      field: "revenue" | "schoolItem" | "managementItem"
    ) => {
      items.forEach((item, index) => {
        const subjectId = toNumber(item.subjectId ?? item.subject?.id);
        const rowIndex = toNumber(item.rowIndex, index);
        const period = item.summaryPeriod || item.period || item.expensePeriod;
        const periodKey =
          period?.id ?? `${period?.year || "year"}-${period?.month || "month"}`;
        const key = `${periodKey}:${subjectId}:${rowIndex}`;
        rowMap.set(key, {
          ...(rowMap.get(key) || { key, subjectId, rowIndex }),
          [field]: item,
        });
      });
    };

    addItems(revenues, "revenue");
    addItems(schoolItems, "schoolItem");
    addItems(managementItems, "managementItem");

    return [...rowMap.values()]
      .sort((a, b) => a.subjectId - b.subjectId || a.rowIndex - b.rowIndex)
      .map(({ key, subjectId, revenue, schoolItem, managementItem }) => {
        const sourceItem = revenue || schoolItem || managementItem || {};
        const invoiceAmount = toNumber(
          revenue?.invoiceAmount ??
            toNumber(revenue?.unitPrice) *
              toNumber(revenue?.studentCount) *
              toNumber(revenue?.monthsCount)
        );
        const schoolExpenseAmount = toNumber(
          schoolItem?.schoolExpenseAmount ??
            (toNumber(schoolItem?.teacherUnitPrice ?? schoolItem?.giaovien) +
              toNumber(schoolItem?.taxUnitPrice ?? schoolItem?.thue) +
              toNumber(schoolItem?.csvcUnitPrice ?? schoolItem?.csvc)) *
              toNumber(schoolItem?.studentCount) *
              toNumber(schoolItem?.monthsCount)
        );
        const managementExpenseAmount = toNumber(
          managementItem?.totalOutside ??
            managementItem?.totalOutsideExpense ??
            (Math.max(
              0,
              toNumber(managementItem?.ql1UnitPrice) -
                toNumber(managementItem?.ql1Tax)
            ) +
              Math.max(
                0,
                toNumber(managementItem?.ql2UnitPrice) -
                  toNumber(managementItem?.ql2Tax)
              )) *
              toNumber(managementItem?.studentCount) *
              toNumber(managementItem?.monthsCount) +
              (Array.isArray(managementItem?.otherCosts)
                ? managementItem.otherCosts
                : []
              ).reduce(
                (total: number, cost: any) =>
                  total +
                  Math.max(
                    0,
                    toNumber(cost.unitPrice ?? cost.percent ?? cost.value) -
                      toNumber(cost.tax),
                  ),
                0,
              )
        );
        const totalOutsideExpense =
          schoolExpenseAmount + managementExpenseAmount;
        const paidAmount =
          toNumber(schoolItem?.paidAmount) +
          toNumber(managementItem?.paidAmount);

        return {
          key,
          subjectId,
          subjectName:
            revenue?.subject?.name ||
            schoolItem?.subject?.name ||
            managementItem?.subject?.name,
          totalPeriods: sourceItem.totalPeriods,
          studentCount: sourceItem.studentCount,
          invoiceAmount,
          collectedDate: revenue?.collectedDate || revenue?.paymentDate,
          totalOutsideExpense,
          paidAmount,
          remainingOutsideExpense: totalOutsideExpense - paidAmount,
          paymentDate:
            schoolItem?.paymentDate ||
            managementItem?.paymentDate ||
            schoolItem?.expenseDate ||
            managementItem?.expenseDate,
          payer: schoolItem?.payer || managementItem?.payer,
          revenueAmount: toNumber(revenue?.revenueAmount ?? invoiceAmount),
          expenseAmount: toNumber(
            schoolItem?.expenseAmount ??
              managementItem?.expenseAmount ??
              totalOutsideExpense
          ),
          note: schoolItem?.note || managementItem?.note || revenue?.note || "",
          period:
            sourceItem.summaryPeriod ||
            sourceItem.period ||
            sourceItem.expensePeriod,
        };
      });
  }, [data]);

  const subjectLabel = (row: any) => {
    if (row.subjectName) return row.subjectName;
    const subject = subjects.find(
      (item: any) => toNumber(item.id) === row.subjectId
    );
    return subject?.name || subject?.code || "--";
  };

  const monthOptions = useMemo(() => {
    const options = new Map<string, string>();
    rows.forEach((row) => {
      const month = Number(row.period?.month || 0);
      const year = Number(row.period?.year || 0);
      if (!month) return;
      const value = `${year || ""}-${month}`;
      options.set(
        value,
        row.period?.name ||
          `Tháng ${String(month).padStart(2, "0")}${year ? `/${year}` : ""}`,
      );
    });
    return [...options.entries()].sort(([left], [right]) =>
      right.localeCompare(left),
    );
  }, [rows]);

  const subjectOptions = useMemo(() => {
    const options = new Map<string, string>();
    rows.forEach((row) => {
      const value = String(row.subjectId || "");
      if (value) options.set(value, subjectLabel(row));
    });
    return [...options.entries()].sort(([, left], [, right]) =>
      left.localeCompare(right, "vi"),
    );
  }, [rows, subjects]);

  const visibleRows = rows.filter((row) => {
    const rowMonth = `${Number(row.period?.year || 0) || ""}-${Number(
      row.period?.month || 0,
    )}`;
    if (selectedMonth && rowMonth !== selectedMonth) return false;
    if (selectedSubject && String(row.subjectId) !== selectedSubject) {
      return false;
    }
    return !onlyRemaining || row.remainingOutsideExpense > 0;
  });
  const columnTotals = visibleRows.reduce(
    (totals, row) => ({
      totalPeriods: totals.totalPeriods + toNumber(row.totalPeriods),
      invoiceAmount: totals.invoiceAmount + toNumber(row.invoiceAmount),
      totalOutsideExpense:
        totals.totalOutsideExpense + toNumber(row.totalOutsideExpense),
      paidAmount: totals.paidAmount + toNumber(row.paidAmount),
      remainingOutsideExpense:
        totals.remainingOutsideExpense +
        toNumber(row.remainingOutsideExpense),
      revenueAmount: totals.revenueAmount + toNumber(row.revenueAmount),
      expenseAmount: totals.expenseAmount + toNumber(row.expenseAmount),
    }),
    {
      totalPeriods: 0,
      invoiceAmount: 0,
      totalOutsideExpense: 0,
      paidAmount: 0,
      remainingOutsideExpense: 0,
      revenueAmount: 0,
      expenseAmount: 0,
    },
  );

  const periodLabel = (row: any) =>
    row.period?.name ||
    (row.period?.month
      ? `${String(row.period.month).padStart(2, "0")}${
          row.period?.year ? `/${row.period.year}` : ""
        }`
      : "--");

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900 sm:text-2xl">
            Tổng hợp công nợ
          </h3>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Theo dõi nhanh doanh thu và các khoản còn phải chi
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:w-auto md:flex-wrap md:items-center">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            aria-label="Lọc theo tháng"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-auto"
          >
            <option value="">Tất cả tháng</option>
            {monthOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
            aria-label="Lọc theo môn học"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-auto"
          >
            <option value="">Tất cả môn học</option>
            {subjectOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-700 sm:col-span-2 md:bg-transparent md:px-0 md:text-base">
            <input
              type="checkbox"
              checked={onlyRemaining}
              onChange={(event) => setOnlyRemaining(event.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
            />
            Chỉ còn phải chi
          </label>
        </div>
      </div>

      {!visibleRows.length ? (
        <div className="p-10 text-center text-slate-500">
          <p className="font-bold text-slate-700">
            {onlyRemaining
              ? "Không có khoản chi nào đang tồn đọng."
              : "Chưa có dữ liệu thu chi trong kỳ này."}
          </p>
          {onlyRemaining && rows.length > 0 && (
            <button
              type="button"
              onClick={() => setOnlyRemaining(false)}
              className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Hiển thị tất cả dữ liệu
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 bg-slate-50 p-3 md:hidden">
            <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-300">Tổng cộng</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                  {visibleRows.length} khoản
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-xs text-slate-400">Doanh thu</p>
                  <p className="mt-1 break-words text-base font-black text-emerald-300">
                    {formatCurrency(columnTotals.revenueAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Chi phí</p>
                  <p className="mt-1 break-words text-base font-black text-orange-300">
                    {formatCurrency(columnTotals.expenseAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Đã chi</p>
                  <p className="mt-1 break-words text-base font-black text-blue-200">
                    {formatCurrency(columnTotals.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Còn phải chi</p>
                  <p className="mt-1 break-words text-base font-black text-rose-300">
                    {formatCurrency(columnTotals.remainingOutsideExpense)}
                  </p>
                </div>
              </div>
            </div>

            {visibleRows.map((row, index) => (
              <article
                key={row.key}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Khoản {index + 1} · {periodLabel(row)}
                    </p>
                    <h4 className="mt-1 break-words text-base font-black text-slate-900">
                      {subjectLabel(row)}
                    </h4>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                      row.remainingOutsideExpense > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {row.remainingOutsideExpense > 0 ? "Còn nợ" : "Đã đủ"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3">
                  <div>
                    <p className="text-xs text-slate-500">Tiền hóa đơn</p>
                    <p className="mt-0.5 break-words text-sm font-black text-blue-700">
                      {formatCurrency(row.invoiceAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tổng chi ngoài HĐ</p>
                    <p className="mt-0.5 break-words text-sm font-black text-rose-700">
                      {formatCurrency(row.totalOutsideExpense)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Đã chi</p>
                    <p className="mt-0.5 break-words text-sm font-bold text-slate-800">
                      {formatCurrency(row.paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Còn phải chi</p>
                    <p className="mt-0.5 break-words text-sm font-black text-orange-700">
                      {row.remainingOutsideExpense > 0
                        ? formatCurrency(row.remainingOutsideExpense)
                        : "0 ₫"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-sm">
                  <p className="text-slate-500">Số tiết</p>
                  <p className="text-right font-bold text-slate-800">
                    {row.totalPeriods ?? "--"}
                  </p>
                  <p className="text-slate-500">Số học sinh</p>
                  <p className="text-right font-bold text-slate-800">
                    {row.studentCount ?? "--"}
                  </p>
                  <p className="text-slate-500">Ngày thu</p>
                  <p className="text-right font-bold text-slate-800">
                    {formatDate(row.collectedDate)}
                  </p>
                  <p className="text-slate-500">Ngày chi</p>
                  <p className="text-right font-bold text-slate-800">
                    {formatDate(row.paymentDate)}
                  </p>
                  <p className="text-slate-500">Người chi</p>
                  <p className="break-words text-right font-bold text-slate-800">
                    {row.payer || "--"}
                  </p>
                  {row.note && (
                    <div className="col-span-2 mt-1 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold text-slate-500">Ghi chú</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                        {row.note}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

        <div className="hidden max-h-[620px] overflow-auto md:block">
          <table className="min-w-[2200px] whitespace-nowrap text-xl">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white">
              <tr>
                <th className="sticky left-0 z-30 w-20 bg-slate-900 px-4 py-3 text-center">
                  STT
                </th>
                <th className="sticky left-20 z-30 min-w-[180px] bg-slate-900 px-4 py-3 text-left">
                  Môn học
                </th>
                <th className="px-4 py-3 text-left">Tháng</th>
                <th className="px-4 py-3 text-right">Số tiết</th>
                <th className="px-4 py-3 text-right">Số học sinh</th>
                <th className="px-4 py-3 text-right">Số tiền hóa đơn</th>
                <th className="px-4 py-3 text-left">Ngày thu</th>
                <th className="px-4 py-3 text-right">Tổng chi ngoài HĐ</th>
                <th className="px-4 py-3 text-right">Đã chi</th>
                <th className="px-4 py-3 text-right">Còn phải chi</th>
                <th className="px-4 py-3 text-left">Ngày chi</th>
                <th className="px-4 py-3 text-left">Người chi</th>
                <th className="px-4 py-3 text-right">Doanh thu</th>
                <th className="px-4 py-3 text-right">Chi phí</th>
                <th className="min-w-[260px] px-4 py-3 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-blue-200 bg-blue-50 font-black text-slate-900">
                <td
                  colSpan={3}
                  className="sticky left-0 z-10 bg-blue-50 px-4 py-4 text-center text-blue-800"
                >
                  TỔNG CỘNG
                </td>
                <td className="px-4 py-4 text-right">
                  {new Intl.NumberFormat("vi-VN").format(
                    columnTotals.totalPeriods,
                  )}
                </td>
                <td className="px-4 py-4 text-center">--</td>
                <td className="px-4 py-4 text-right text-blue-800">
                  {formatCurrency(columnTotals.invoiceAmount)}
                </td>
                <td className="px-4 py-4 text-center">--</td>
                <td className="px-4 py-4 text-right text-rose-700">
                  {formatCurrency(columnTotals.totalOutsideExpense)}
                </td>
                <td className="px-4 py-4 text-right text-emerald-700">
                  {formatCurrency(columnTotals.paidAmount)}
                </td>
                <td className="px-4 py-4 text-right text-orange-700">
                  {formatCurrency(columnTotals.remainingOutsideExpense)}
                </td>
                <td className="px-4 py-4 text-center">--</td>
                <td className="px-4 py-4 text-center">--</td>
                <td className="px-4 py-4 text-right text-emerald-700">
                  {formatCurrency(columnTotals.revenueAmount)}
                </td>
                <td className="px-4 py-4 text-right text-orange-700">
                  {formatCurrency(columnTotals.expenseAmount)}
                </td>
                <td className="px-4 py-4 text-center">--</td>
              </tr>
              {visibleRows.map((row, index) => (
                <tr
                  key={row.key}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-center font-semibold group-hover:bg-slate-50">
                    {index + 1}
                  </td>
                  <td className="sticky left-20 z-10 bg-white px-4 py-3 font-semibold">
                    {subjectLabel(row)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {periodLabel(row)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.totalPeriods ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.studentCount ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">
                    {formatCurrency(row.invoiceAmount)}
                  </td>
                  <td className="px-4 py-3">{formatDate(row.collectedDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-700">
                    {formatCurrency(row.totalOutsideExpense)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(row.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-black ${
                        row.remainingOutsideExpense > 0
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {row.remainingOutsideExpense > 0
                        ? formatCurrency(row.remainingOutsideExpense)
                        : "Đã chi đủ"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.paymentDate)}</td>
                  <td className="px-4 py-3">{row.payer || "--"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatCurrency(row.revenueAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-700">
                    {formatCurrency(row.expenseAmount)}
                  </td>
                  <td
                    title={row.note || ""}
                    className="max-w-[320px] whitespace-normal px-4 py-3 text-slate-600"
                  >
                    <span className="line-clamp-2">{row.note || "--"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
