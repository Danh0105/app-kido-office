import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CircleDollarSign,
  Landmark,
  Loader2,
  ReceiptText,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { employeeApi } from "@/service/employee";
import { getApiErrorMessage } from "@/utils/apiError";

type Props = {
  policies: any[];
  restrictToPolicySchools: boolean;
  subjectId?: number | null;
  employeeId?: number;
};

type ExpenseRecord = {
  id: number;
  schoolId: number;
  schoolName: string;
  employeeId: number;
  employeeName: string;
  periodName?: string;
  revenue: number;
  revenuePaid: number;
  revenueRemaining: number;
  schoolExpense: number;
  managementExpense: number;
  totalExpense: number;
  expensePaid: number;
  expenseRemaining: number;
};

type SchoolExpenseStats = Omit<ExpenseRecord, "id" | "periodName"> & {
  periodNames: string[];
  recordCount: number;
};

type EmployeeExpenseGroup = {
  key: string;
  employeeId: number;
  employeeName: string;
  schools: SchoolExpenseStats[];
  revenue: number;
  revenueRemaining: number;
  expenseRemaining: number;
};

const listFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const unwrapPayload = (payload: any) =>
  payload?.data && !Array.isArray(payload.data) ? payload.data : payload;

const firstNumber = (
  sources: any[],
  keys: string[],
): number | undefined => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value === null || value === undefined || value === "") continue;

      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
};

const firstArray = (sources: any[], keys: string[]) => {
  for (const source of sources) {
    for (const key of keys) {
      if (Array.isArray(source?.[key])) return source[key];
    }
  }

  return [];
};

const sumBy = (items: any[], getter: (item: any) => number) =>
  items.reduce((total, item) => total + getter(item), 0);

const calculateRevenueAmount = (item: any) =>
  firstNumber([item], ["invoiceAmount", "totalAmount", "amount"]) ??
  Number(item?.unitPrice || 0) *
    Number(item?.studentCount || 0) *
    Number(item?.monthsCount || 0);

const calculateSchoolExpenseAmount = (item: any) => {
  const explicit = firstNumber([item], [
    "schoolExpenseAmount",
    "totalSchoolExpense",
    "totalAmount",
    "amount",
  ]);
  if (explicit !== undefined) return explicit;

  const students = Number(item?.studentCount || 0);
  const months = Number(item?.monthsCount || 0);
  const teacher = Number(item?.teacherUnitPrice ?? item?.giaovien ?? 0);
  const tax = Number(item?.taxUnitPrice ?? item?.thue ?? item?.tax ?? 0);
  const csvc = Number(item?.csvcUnitPrice ?? item?.csvc ?? 0);

  return (teacher + tax + csvc) * students * months;
};

const calculateManagementExpenseAmount = (item: any) => {
  const explicit = firstNumber([item], [
    "totalOutside",
    "totalOutsideExpense",
    "totalManagementExpense",
    "totalAmount",
    "amount",
  ]);
  if (explicit !== undefined) return explicit;

  const students = Number(item?.studentCount || 0);
  const months = Number(item?.monthsCount || 0);
  const ql1 = Number(item?.ql1UnitPrice || 0);
  const ql2 = Number(item?.ql2UnitPrice || 0);

  return (ql1 + ql2) * students * months;
};

const hasFinancialData = (record: any) => {
  const source = unwrapPayload(record?.summary) || record;
  return [
    "totalRevenue",
    "totalExpense",
    "totalSchoolExpense",
    "totalSchool",
    "totalManagementExpense",
    "totalManagement",
    "totalOutsideExpense",
    "revenueItems",
    "schoolExpenseItems",
    "managementExpenseItems",
  ].some((key) => source?.[key] !== undefined);
};

const normalizeExpenseRecord = (record: any): ExpenseRecord => {
  const summary = unwrapPayload(record?.summary) || {};
  const sources = [summary?.summary, summary, record].filter(Boolean);
  const revenueItems = firstArray(sources, ["revenueItems", "revenues"]);
  const schoolExpenseItems = firstArray(sources, [
    "schoolExpenseItems",
    "schoolItems",
  ]);
  const managementExpenseItems = firstArray(sources, [
    "managementExpenseItems",
    "managementItems",
  ]);

  const calculatedRevenue = sumBy(revenueItems, calculateRevenueAmount);
  const calculatedRevenuePaid = sumBy(revenueItems, (item) =>
    Number(item?.paidAmount || 0),
  );
  const calculatedSchoolExpense = sumBy(
    schoolExpenseItems,
    calculateSchoolExpenseAmount,
  );
  const calculatedSchoolPaid = sumBy(schoolExpenseItems, (item) =>
    Number(item?.paidAmount || 0),
  );
  const calculatedManagementExpense = sumBy(
    managementExpenseItems,
    calculateManagementExpenseAmount,
  );
  const calculatedManagementPaid = sumBy(managementExpenseItems, (item) =>
    Number(item?.paidAmount || 0),
  );

  const revenue =
    firstNumber(sources, ["totalRevenue", "revenueTotal", "totalInvoice"]) ??
    calculatedRevenue;
  const explicitRevenueRemaining = firstNumber(sources, [
    "remainingRevenue",
    "revenueRemaining",
    "totalReceivable",
  ]);
  const revenuePaid =
    firstNumber(sources, [
      "totalRevenuePaid",
      "revenuePaid",
      "totalCollected",
      "collectedAmount",
    ]) ??
    (explicitRevenueRemaining !== undefined
      ? revenue - explicitRevenueRemaining
      : calculatedRevenuePaid);
  const revenueRemaining =
    explicitRevenueRemaining ?? revenue - revenuePaid;

  const schoolExpense =
    firstNumber(sources, [
      "totalSchoolExpense",
      "totalSchool",
      "schoolExpenseTotal",
      "schoolExpense",
    ]) ?? calculatedSchoolExpense;
  const managementExpense =
    firstNumber(sources, [
      "totalManagementExpense",
      "totalManagement",
      "managementExpenseTotal",
      "totalOutsideExpense",
      "totalOutside",
    ]) ?? calculatedManagementExpense;
  const totalExpense =
    firstNumber(sources, ["totalExpense", "expenseTotal"]) ??
    schoolExpense + managementExpense;
  const explicitExpenseRemaining = firstNumber(sources, [
    "remainingExpense",
    "expenseRemaining",
    "totalPayable",
  ]);
  const expensePaid =
    firstNumber(sources, [
      "totalExpensePaid",
      "expensePaid",
      "totalPaidExpense",
    ]) ??
    (explicitExpenseRemaining !== undefined
      ? totalExpense - explicitExpenseRemaining
      : calculatedSchoolPaid + calculatedManagementPaid);
  const expenseRemaining =
    explicitExpenseRemaining ?? totalExpense - expensePaid;

  const school = record?.school || summary?.school || {};
  const employee =
    record?.employee ||
    school?.employee ||
    summary?.employee ||
    summary?.school?.employee ||
    {};
  const period =
    record?.period ||
    record?.expensePeriod ||
    summary?.period ||
    summary?.expensePeriod ||
    {};

  return {
    id: Number(record?.id || summary?.id || 0),
    schoolId: Number(record?.schoolId || school?.id || summary?.schoolId || 0),
    schoolName:
      record?.schoolName ||
      school?.name ||
      summary?.schoolName ||
      "Chưa xác định trường",
    employeeId: Number(
      record?.employeeId ||
        school?.employeeId ||
        employee?.id ||
        summary?.employeeId ||
        0,
    ),
    employeeName:
      record?.employeeName ||
      employee?.name ||
      summary?.employeeName ||
      "",
    periodName:
      period?.name ||
      record?.periodName ||
      (period?.month && period?.year
        ? `${String(period.month).padStart(2, "0")}/${period.year}`
        : undefined),
    revenue,
    revenuePaid,
    revenueRemaining,
    schoolExpense,
    managementExpense,
    totalExpense,
    expensePaid,
    expenseRemaining,
  };
};

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });

const summaryCards = [
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
    label: "Công nợ phải thu",
    icon: WalletCards,
    className: "bg-amber-50 text-amber-700",
  },
  {
    key: "schoolExpense",
    label: "Chi trường",
    icon: Building2,
    className: "bg-violet-50 text-violet-700",
  },
  {
    key: "managementExpense",
    label: "Chi ngoài",
    icon: Landmark,
    className: "bg-cyan-50 text-cyan-700",
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
] as const;

export default function ExpenseStatsSection({
  policies,
  restrictToPolicySchools,
  subjectId,
  employeeId,
}: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [routeEmployee, setRouteEmployee] = useState<any>(null);

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

  useEffect(() => {
    let active = true;

    const fetchExpenseStats = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await schoolExpenseApi.getAll({
          page: 1,
          limit: 500,
        });
        const list = listFromResponse(response);
        const enriched = await Promise.all(
          list.map(async (record: any) => {
            if (
              !record?.id ||
              (!subjectId && hasFinancialData(record))
            ) {
              return record;
            }

            let summary: any = null;

            try {
              summary = await schoolExpenseApi.getSummary(
                Number(record.id),
                subjectId || undefined,
              );
            } catch {
              // Some backend versions expose only the combined items endpoint.
            }

            if (!hasFinancialData({ summary })) {
              try {
                const items = await schoolExpenseApi.getItems(
                  Number(record.id),
                  subjectId || undefined,
                );
                summary = {
                  ...(unwrapPayload(summary) || {}),
                  ...(unwrapPayload(items) || {}),
                };
              } catch {
                // Keep the base list record so one unavailable detail does not
                // hide the remaining schools from the statistics page.
              }
            }

            return summary ? { ...record, summary } : record;
          }),
        );

        if (active) setRecords(enriched);
      } catch (fetchError: any) {
        if (active) {
          setError(
            getApiErrorMessage(
              fetchError,
              "Không thể tải dữ liệu thống kê thu chi",
            ),
          );
          setRecords([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchExpenseStats();
    return () => {
      active = false;
    };
  }, [subjectId]);

  const policySchoolMap = useMemo(() => {
    const map = new Map<number, any>();
    policies.forEach((policy: any) => {
      const schoolId = Number(policy?.schoolId || 0);
      if (schoolId && !map.has(schoolId)) map.set(schoolId, policy);
    });
    return map;
  }, [policies]);

  const schoolRows = useMemo<SchoolExpenseStats[]>(() => {
    const schoolMap = new Map<number, SchoolExpenseStats>();

    records.map(normalizeExpenseRecord).forEach((record) => {
      if (
        restrictToPolicySchools &&
        !policySchoolMap.has(record.schoolId)
      ) {
        return;
      }

      const policySchool = policySchoolMap.get(record.schoolId);
      const policyEmployee =
        policySchool?.employee ||
        policySchool?.createdBy ||
        {};
      let current = schoolMap.get(record.schoolId);

      if (!current) {
        const resolvedEmployeeId = Number(
          record.employeeId ||
            policySchool?.employeeId ||
            (typeof policyEmployee === "object" ? policyEmployee?.id : 0) ||
            employeeId ||
            0,
        );
        const resolvedEmployeeName =
          record.employeeName ||
          policySchool?.employeeName ||
          policySchool?.consultantName ||
          (typeof policyEmployee === "object" ? policyEmployee?.name : "") ||
          routeEmployee?.name ||
          (resolvedEmployeeId
            ? `Nhân viên #${resolvedEmployeeId}`
            : "Chưa phân công");

        current = {
          schoolId: record.schoolId,
          schoolName:
            policySchool?.schoolName ||
            record.schoolName ||
            `Trường #${record.schoolId}`,
          employeeId: resolvedEmployeeId,
          employeeName: resolvedEmployeeName,
          periodNames: [],
          recordCount: 0,
          revenue: 0,
          revenuePaid: 0,
          revenueRemaining: 0,
          schoolExpense: 0,
          managementExpense: 0,
          totalExpense: 0,
          expensePaid: 0,
          expenseRemaining: 0,
        };
      }

      current.recordCount += 1;
      if (
        record.periodName &&
        !current.periodNames.includes(record.periodName)
      ) {
        current.periodNames.push(record.periodName);
      }
      current.revenue += record.revenue;
      current.revenuePaid += record.revenuePaid;
      current.revenueRemaining += record.revenueRemaining;
      current.schoolExpense += record.schoolExpense;
      current.managementExpense += record.managementExpense;
      current.totalExpense += record.totalExpense;
      current.expensePaid += record.expensePaid;
      current.expenseRemaining += record.expenseRemaining;
      schoolMap.set(record.schoolId, current);
    });

    return Array.from(schoolMap.values()).sort(
      (left, right) =>
        right.revenueRemaining - left.revenueRemaining ||
        left.schoolName.localeCompare(right.schoolName, "vi"),
    );
  }, [
    employeeId,
    policySchoolMap,
    records,
    restrictToPolicySchools,
    routeEmployee,
  ]);

  const employeeGroups = useMemo<EmployeeExpenseGroup[]>(() => {
    const groups = new Map<string, EmployeeExpenseGroup>();

    schoolRows.forEach((school) => {
      const key = school.employeeId
        ? `employee-${school.employeeId}`
        : `employee-name-${school.employeeName}`;
      const group =
        groups.get(key) ||
        ({
          key,
          employeeId: school.employeeId,
          employeeName: school.employeeName,
          schools: [],
          revenue: 0,
          revenueRemaining: 0,
          expenseRemaining: 0,
        } satisfies EmployeeExpenseGroup);

      group.schools.push(school);
      group.revenue += school.revenue;
      group.revenueRemaining += school.revenueRemaining;
      group.expenseRemaining += school.expenseRemaining;
      groups.set(key, group);
    });

    return Array.from(groups.values()).sort((left, right) =>
      left.employeeName.localeCompare(right.employeeName, "vi"),
    );
  }, [schoolRows]);

  const totals = useMemo(
    () =>
      schoolRows.reduce(
        (result, school) => ({
          revenue: result.revenue + school.revenue,
          revenuePaid: result.revenuePaid + school.revenuePaid,
          revenueRemaining:
            result.revenueRemaining + school.revenueRemaining,
          schoolExpense: result.schoolExpense + school.schoolExpense,
          managementExpense:
            result.managementExpense + school.managementExpense,
          totalExpense: result.totalExpense + school.totalExpense,
          expensePaid: result.expensePaid + school.expensePaid,
          expenseRemaining:
            result.expenseRemaining + school.expenseRemaining,
        }),
        {
          revenue: 0,
          revenuePaid: 0,
          revenueRemaining: 0,
          schoolExpense: 0,
          managementExpense: 0,
          totalExpense: 0,
          expensePaid: 0,
          expenseRemaining: 0,
        },
      ),
    [schoolRows],
  );

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 bg-gradient-to-r from-emerald-700 to-teal-700 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Thống kê tài chính
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-black">
            <WalletCards size={22} />
            Thu chi
          </h2>
          <p className="mt-1 text-sm text-emerald-100">
            Tổng hợp theo các kỳ thu chi của từng trường
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-emerald-100">Nhân viên</p>
            <p className="text-2xl font-black">{employeeGroups.length}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-emerald-100">Trường</p>
            <p className="text-2xl font-black">{schoolRows.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm font-semibold text-slate-500">
          <Loader2 size={20} className="animate-spin text-emerald-600" />
          Đang tải thống kê thu chi...
        </div>
      ) : error ? (
        <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-7">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={`rounded-2xl p-4 ${card.className}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={17} />
                    <p className="text-xs font-bold uppercase">
                      {card.label}
                    </p>
                  </div>
                  <p className="mt-2 break-words text-lg font-black">
                    {formatMoney(totals[card.key])}đ
                  </p>
                </div>
              );
            })}
          </div>

          {schoolRows.length > 0 ? (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="min-w-[1180px] w-full text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Trường</th>
                    <th className="px-4 py-3 text-center">Kỳ thu chi</th>
                    <th className="px-4 py-3 text-right">Doanh thu</th>
                    <th className="px-4 py-3 text-right">Đã thu</th>
                    <th className="px-4 py-3 text-right">Công nợ</th>
                    <th className="px-4 py-3 text-right">Chi trường</th>
                    <th className="px-4 py-3 text-right">Chi ngoài</th>
                    <th className="px-4 py-3 text-right">Đã chi</th>
                    <th className="px-4 py-3 text-right">Còn chi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="bg-emerald-100/80">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 font-black text-emerald-900">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
                                <UserRound size={18} />
                              </span>
                              <span>{group.employeeName}</span>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                                {group.schools.length} trường
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-white px-3 py-1.5 text-emerald-700">
                                Doanh thu: {formatMoney(group.revenue)}đ
                              </span>
                              <span className="rounded-full bg-white px-3 py-1.5 text-amber-700">
                                Công nợ: {formatMoney(group.revenueRemaining)}đ
                              </span>
                              <span className="rounded-full bg-white px-3 py-1.5 text-orange-700">
                                Còn chi: {formatMoney(group.expenseRemaining)}đ
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.schools.map((school) => (
                        <tr
                          key={school.schoolId}
                          className="transition hover:bg-emerald-50/50"
                        >
                          <td className="px-4 py-3 font-bold text-slate-800">
                            <span className="mr-2 text-emerald-500">└</span>
                            {school.schoolName}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {school.periodNames.length
                              ? school.periodNames.join(", ")
                              : `${school.recordCount} kỳ`}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                            {formatMoney(school.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-700">
                            {formatMoney(school.revenuePaid)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">
                            {formatMoney(school.revenueRemaining)}
                          </td>
                          <td className="px-4 py-3 text-right text-violet-700">
                            {formatMoney(school.schoolExpense)}
                          </td>
                          <td className="px-4 py-3 text-right text-cyan-700">
                            {formatMoney(school.managementExpense)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-700">
                            {formatMoney(school.expensePaid)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-orange-700">
                            {formatMoney(school.expenseRemaining)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              Chưa có dữ liệu thu chi phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </>
      )}
    </section>
  );
}
