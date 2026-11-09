import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Scale,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { employeeApi } from "@/service/employee";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasRole } from "@/utils/auth";
import {
  buildEmployeeCashflow,
  CASHFLOW_SUMMARY_ROLES,
  fromCashflowSummaryItem,
  fromSchoolExpenseSummary,
  getPeriodLabel,
  matchesPeriodFilter,
  toPeriod,
  type CashflowFigures,
  type CashflowRow,
  type ExpensePeriodInfo,
} from "../expenseStats";

type Props = {
  policies: any[];
  restrictToPolicySchools: boolean;
  subjectId?: number | null;
  employeeId?: number;
  /** Năm học đang lọc ở trang ("" = mọi năm học). */
  schoolYear?: string;
  /** Kỳ thu chi đang chọn ở bộ lọc trang. */
  period?: any | null;
};

const listFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

/** Chạy tối đa `limit` request cùng lúc để không dồn hàng trăm request. */
const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) => {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
};

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });

type FigureKey = keyof CashflowFigures;

const summaryCards: Array<{
  key: FigureKey;
  label: string;
  icon: typeof TrendingUp;
  className: string;
  detail?: (totals: CashflowFigures) => string;
}> = [
  {
    key: "revenue",
    label: "Tổng doanh thu",
    icon: TrendingUp,
    className: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "revenuePaid",
    label: "Đã thu",
    icon: CircleDollarSign,
    className: "bg-blue-50 text-blue-700",
  },
  {
    key: "revenueRemaining",
    label: "Còn phải thu",
    icon: WalletCards,
    className: "bg-amber-50 text-amber-700",
  },
  {
    key: "cashPolicy",
    label: "Chính sách tiền mặt",
    icon: Banknote,
    className: "bg-fuchsia-50 text-fuchsia-700",
  },
  {
    key: "balance",
    label: "Chênh lệch",
    icon: Scale,
    className: "bg-sky-50 text-sky-800",
    detail: () => "Doanh thu − Tổng chi − CS tiền mặt",
  },
  {
    key: "schoolExpense",
    label: "Chi nhà trường",
    icon: Building2,
    className: "bg-violet-50 text-violet-700",
    detail: (totals) =>
      `Đã chi ${formatMoney(totals.schoolExpensePaid)}đ · Còn ${formatMoney(
        totals.schoolExpenseRemaining,
      )}đ`,
  },
  {
    key: "managementExpense",
    label: "Chi ngoài HĐ",
    icon: Landmark,
    className: "bg-cyan-50 text-cyan-700",
    detail: (totals) =>
      `Đã chi ${formatMoney(totals.managementExpensePaid)}đ · Còn ${formatMoney(
        totals.managementExpenseRemaining,
      )}đ`,
  },
  {
    key: "totalExpense",
    label: "Tổng chi",
    icon: ReceiptText,
    className: "bg-slate-100 text-slate-800",
    detail: () => "Chi nhà trường + Chi ngoài HĐ",
  },
  {
    key: "expensePaid",
    label: "Đã chi",
    icon: ReceiptText,
    className: "bg-rose-50 text-rose-700",
  },
  {
    key: "expenseRemaining",
    label: "Còn phải chi",
    icon: WalletCards,
    className: "bg-orange-50 text-orange-700",
  },
];

const figureColumns: Array<{
  key: FigureKey;
  label: string;
  className: string;
}> = [
  { key: "revenue", label: "Doanh thu", className: "text-emerald-700" },
  { key: "revenuePaid", label: "Đã thu", className: "text-blue-700" },
  {
    key: "revenueRemaining",
    label: "Còn phải thu",
    className: "font-bold text-amber-700",
  },
  { key: "schoolExpense", label: "Chi nhà trường", className: "text-violet-700" },
  { key: "managementExpense", label: "Chi ngoài HĐ", className: "text-cyan-700" },
  { key: "totalExpense", label: "Tổng chi", className: "font-bold text-slate-800" },
  { key: "expensePaid", label: "Đã chi", className: "text-rose-700" },
  {
    key: "expenseRemaining",
    label: "Còn phải chi",
    className: "font-bold text-orange-700",
  },
  { key: "cashPolicy", label: "CS tiền mặt", className: "text-fuchsia-700" },
  { key: "balance", label: "Chênh lệch", className: "font-bold" },
];

function FigureCells({
  figures,
  strong = false,
}: {
  figures: CashflowFigures;
  strong?: boolean;
}) {
  return (
    <>
      {figureColumns.map((column) => {
        const value = figures[column.key];
        const tone =
          column.key === "balance"
            ? value < 0
              ? "font-bold text-rose-700"
              : "font-bold text-sky-800"
            : column.className;
        return (
          <td
            key={column.key}
            className={`whitespace-nowrap px-4 py-3 text-right ${tone} ${
              strong ? "font-black" : ""
            }`}
          >
            {formatMoney(value)}
          </td>
        );
      })}
    </>
  );
}

export default function ExpenseStatsSection({
  policies,
  restrictToPolicySchools,
  subjectId,
  employeeId,
  schoolYear = "",
  period,
}: Props) {
  // Cùng nguồn với "Báo cáo tổng hợp" của QL thu chi. Sales admin không được
  // gọi API này (403 kèm thông báo lỗi) nên đọc từng bảng qua /summary.
  const canUseCashflowSummary = hasRole(...CASHFLOW_SUMMARY_ROLES);
  const [rows, setRows] = useState<CashflowRow[]>([]);
  const [records, setRecords] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failedCount, setFailedCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [reloadKey, setReloadKey] = useState(0);
  const [routeEmployee, setRouteEmployee] = useState<any>(null);
  const [expandedSchools, setExpandedSchools] = useState<Set<number>>(
    () => new Set(),
  );
  const summaryCache = useRef(new Map<string, CashflowRow>());

  const periodId = Number(period?.id || 0);
  const periodMonth = Number(period?.month || 0);
  const periodYear = Number(period?.year || 0);
  const periodName = period?.name ?? null;
  const selectedPeriod = useMemo<ExpensePeriodInfo | null>(
    () =>
      periodId
        ? toPeriod({
            id: periodId,
            month: periodMonth,
            year: periodYear,
            name: periodName,
          })
        : null,
    [periodId, periodMonth, periodYear, periodName],
  );

  useEffect(() => {
    let active = true;

    if (!employeeId) {
      setRouteEmployee(null);
      return;
    }

    employeeApi
      .getById(employeeId)
      .then((employee) => {
        if (active) setRouteEmployee(employee);
      })
      .catch(() => {
        if (active) setRouteEmployee(null);
      });

    return () => {
      active = false;
    };
  }, [employeeId]);

  // Kế toán / Giám đốc: một lần gọi cho mọi trường, mọi kỳ.
  useEffect(() => {
    if (!canUseCashflowSummary) return;
    let active = true;

    setLoading(true);
    setError("");
    setFailedCount(0);
    schoolExpenseApi
      .getCashflowSummary(subjectId ? { subjectId } : undefined)
      .then((response) => {
        if (!active) return;
        const items = Array.isArray(response?.items) ? response.items : [];
        setRows(items.map(fromCashflowSummaryItem));
      })
      .catch((fetchError: any) => {
        if (!active) return;
        setRows([]);
        setError(
          getApiErrorMessage(
            fetchError,
            "Không thể tải dữ liệu thống kê thu chi",
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canUseCashflowSummary, subjectId, reloadKey]);

  // Sales admin: lấy danh sách bảng thu chi, số liệu từng bảng tải ở dưới.
  useEffect(() => {
    if (canUseCashflowSummary) return;
    let active = true;

    setLoading(true);
    setError("");
    setRecords(null);
    summaryCache.current.clear();
    schoolExpenseApi
      .getAll()
      .then((response) => {
        if (active) setRecords(listFromResponse(response));
      })
      .catch((fetchError: any) => {
        if (!active) return;
        setRows([]);
        setLoading(false);
        setError(
          getApiErrorMessage(
            fetchError,
            "Không thể tải dữ liệu thống kê thu chi",
          ),
        );
      });

    return () => {
      active = false;
    };
  }, [canUseCashflowSummary, reloadKey]);

  const policySchoolKey = useMemo(
    () =>
      [
        ...new Set(
          policies
            .map((policy: any) => Number(policy?.schoolId || 0))
            .filter(Boolean),
        ),
      ]
        .sort((left, right) => left - right)
        .join(","),
    [policies],
  );

  // Chỉ tải /summary cho bảng nằm trong bộ lọc hiện tại, bảng đã tải thì dùng lại.
  useEffect(() => {
    if (canUseCashflowSummary || !records) return;
    let active = true;
    const policySchoolIds = new Set(
      policySchoolKey ? policySchoolKey.split(",").map(Number) : [],
    );
    const scoped = records.filter(
      (record: any) =>
        record?.id &&
        (!restrictToPolicySchools ||
          policySchoolIds.has(Number(record?.school?.id ?? record?.schoolId))) &&
        matchesPeriodFilter(
          { period: toPeriod(record?.period) },
          schoolYear,
          selectedPeriod,
        ),
    );
    const cacheKey = (record: any) => `${record.id}:${subjectId || 0}`;
    const missing = scoped.filter(
      (record) => !summaryCache.current.has(cacheKey(record)),
    );

    const run = async () => {
      setLoading(true);
      setError("");
      let failed = 0;
      let done = 0;
      setProgress({ done, total: missing.length });

      await mapWithConcurrency(missing, 6, async (record: any) => {
        try {
          const summary = await schoolExpenseApi.getSummary(
            Number(record.id),
            subjectId || undefined,
          );
          summaryCache.current.set(
            cacheKey(record),
            fromSchoolExpenseSummary(record, summary),
          );
        } catch {
          failed += 1;
        }
        done += 1;
        if (active) setProgress({ done, total: missing.length });
      });

      if (!active) return;
      setFailedCount(failed);
      setRows(
        scoped
          .map((record) => summaryCache.current.get(cacheKey(record)))
          .filter((row): row is CashflowRow => Boolean(row)),
      );
      setProgress(undefined);
      setLoading(false);
    };

    run();
    return () => {
      active = false;
    };
  }, [
    canUseCashflowSummary,
    records,
    policySchoolKey,
    restrictToPolicySchools,
    schoolYear,
    selectedPeriod,
    subjectId,
  ]);

  const report = useMemo(
    () =>
      buildEmployeeCashflow(rows, {
        policies,
        restrictToPolicySchools,
        schoolYear,
        selectedPeriod,
        fallbackEmployee: routeEmployee?.id
          ? { id: Number(routeEmployee.id), name: routeEmployee.name || "" }
          : null,
      }),
    [
      policies,
      restrictToPolicySchools,
      routeEmployee,
      rows,
      schoolYear,
      selectedPeriod,
    ],
  );

  const allSchoolIds = useMemo(
    () =>
      report.employees.flatMap((group) =>
        group.schools.map((school) => school.schoolId),
      ),
    [report.employees],
  );
  const allExpanded =
    allSchoolIds.length > 0 &&
    allSchoolIds.every((schoolId) => expandedSchools.has(schoolId));

  const toggleSchool = (schoolId: number) =>
    setExpandedSchools((current) => {
      const next = new Set(current);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 bg-gradient-to-r from-emerald-700 to-teal-700 px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Thống kê tài chính
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
            <WalletCards size={22} />
            Thu chi
          </h2>
          <p className="mt-1 text-base text-emerald-100">
            Cùng số liệu với Báo cáo tổng hợp của Quản lý thu chi
            {schoolYear ? ` · Năm học ${schoolYear}` : " · Mọi năm học"}
            {selectedPeriod ? ` · Kỳ ${getPeriodLabel(selectedPeriod)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
              <p className="text-sm text-emerald-100">Nhân viên</p>
              <p className="text-3xl font-black">{report.employees.length}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
              <p className="text-sm text-emerald-100">Trường</p>
              <p className="text-3xl font-black">{report.schoolCount}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
              <p className="text-sm text-emerald-100">Kỳ</p>
              <p className="text-3xl font-black">{report.periodCount}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-base font-semibold text-slate-500">
          <Loader2 size={20} className="animate-spin text-emerald-600" />
          Đang tải thống kê thu chi
          {progress?.total
            ? ` (${progress.done}/${progress.total} bảng)...`
            : "..."}
        </div>
      ) : error ? (
        <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {failedCount > 0 && (
            <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <span>
                Không tải được {failedCount} bảng thu chi, số liệu dưới đây
                chưa gồm các bảng đó. Bấm Làm mới để thử lại.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const value = report.totals[card.key];
              return (
                <div
                  key={card.key}
                  className={`rounded-2xl p-4 ${card.className}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={17} />
                    <p className="text-sm font-bold uppercase">
                      {card.label}
                    </p>
                  </div>
                  <p
                    className={`mt-2 break-words text-xl font-black tabular-nums sm:text-2xl 2xl:text-xl ${
                      card.key === "balance" && value < 0 ? "text-rose-700" : ""
                    }`}
                  >
                    {formatMoney(value)}đ
                  </p>
                  {card.detail && (
                    <p className="mt-1 text-sm font-semibold opacity-80">
                      {card.detail(report.totals)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {report.employees.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <p className="text-base text-slate-500">
                  Bấm vào trường để xem số liệu từng kỳ.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSchools(
                      allExpanded ? new Set() : new Set(allSchoolIds),
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {allExpanded ? "Thu gọn tất cả" : "Mở tất cả theo kỳ"}
                </button>
              </div>
              <div className="overflow-x-auto border-t border-slate-100 [&_table]:text-xl [&_table]:leading-8 [&_th]:!px-5 [&_th]:!py-4 [&_th]:!text-xl [&_td]:!px-5 [&_td]:!py-4 [&_td]:!text-xl">
                <table className="w-full min-w-[2300px]">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="sm:sticky sm:left-0 sm:z-10 min-w-[240px] bg-slate-900 sm:min-w-[320px] px-4 py-3 text-left">
                        Trường / Kỳ
                      </th>
                      <th className="min-w-[220px] px-4 py-3 text-left">
                        Môn học
                      </th>
                      {figureColumns.map((column) => (
                        <th
                          key={column.key}
                          className="whitespace-nowrap px-4 py-3 text-right"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.employees.map((group) => (
                      <Fragment key={group.key}>
                        <tr className="bg-emerald-100/80">
                          <td className="sm:sticky sm:left-0 sm:z-10 bg-emerald-100 px-4 py-3">
                            <div className="flex items-center gap-2 font-black text-emerald-900">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                                <UserRound size={18} />
                              </span>
                              <span>{group.employeeName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-white px-3 py-1.5 text-base font-bold text-emerald-700">
                              {group.schools.length} trường
                            </span>
                          </td>
                          <FigureCells figures={group} strong />
                        </tr>
                        {group.schools.map((school) => {
                          const expanded = expandedSchools.has(
                            school.schoolId,
                          );
                          const Chevron = expanded ? ChevronDown : ChevronRight;
                          return (
                            <Fragment key={school.schoolId}>
                              <tr
                                onClick={() => toggleSchool(school.schoolId)}
                                className="cursor-pointer transition hover:bg-emerald-50/50"
                              >
                                <td className="sm:sticky sm:left-0 sm:z-10 bg-white px-4 py-3 font-bold text-slate-800">
                                  <span className="flex items-center gap-2">
                                    <Chevron
                                      size={20}
                                      className="shrink-0 text-emerald-600"
                                    />
                                    <span>
                                      {school.schoolName}
                                      <span className="ml-2 text-base font-semibold text-slate-400">
                                        ({school.periods.length} kỳ)
                                      </span>
                                    </span>
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {school.subjectNames.length
                                    ? school.subjectNames.join(", ")
                                    : "--"}
                                </td>
                                <FigureCells figures={school} />
                              </tr>
                              {expanded &&
                                school.periods.map((item) => (
                                  <tr
                                    key={item.key}
                                    className="bg-slate-50/70"
                                  >
                                    <td className="sm:sticky sm:left-0 sm:z-10 bg-slate-50 px-4 py-3 text-slate-600">
                                      <span className="ml-7 mr-2 text-emerald-500">
                                        └
                                      </span>
                                      {getPeriodLabel(item.period)}
                                    </td>
                                    <td className="px-4 py-3" />
                                    <FigureCells figures={item} />
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100">
                    <tr>
                      <td className="sm:sticky sm:left-0 sm:z-10 bg-slate-100 px-4 py-3 font-black text-slate-900">
                        Tổng cộng
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {report.schoolCount} trường · {report.periodCount} kỳ
                      </td>
                      <FigureCells figures={report.totals} strong />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-base text-slate-500">
              Chưa có dữ liệu thu chi phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </>
      )}
    </section>
  );
}
