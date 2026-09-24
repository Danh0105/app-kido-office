import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { schoolApi } from "@/service/school.api";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { getSalesEmployees } from "@/service/employee";
import { subjectApi } from "@/service/subject.api";
import SearchableSelect from "@/components/SearchableSelect";
import {
  arrayFrom,
  formatCurrency,
  toNumber,
  unwrap,
} from "../RealExpenseDetail/components/ExpenseSummary";

const listFrom = (value: any) =>
  Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

const sum = (items: any[], getter: (item: any) => number) =>
  items.reduce((total, item) => total + getter(item), 0);

const getSchoolYear = (month: number, year: number) => {
  if (!month || !year) return "";
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const getSchoolYearMonths = (schoolYear: string) => {
  const startYear = Number(schoolYear.match(/\d{4}/)?.[0] || 0);
  if (!startYear) return [];

  return [
    ...Array.from({ length: 5 }, (_, index) => ({
      month: index + 8,
      year: startYear,
    })),
    ...Array.from({ length: 7 }, (_, index) => ({
      month: index + 1,
      year: startYear + 1,
    })),
  ];
};

const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    sales: "Nhân viên KD",
    employee: "Kinh doanh",
    probation: "Thử việc",
    employee_la: "Long An",
    saleadmin: "Sale Admin",
    salesadmin_la: "Sale Admin LA",
    director: "Giám đốc",
    director_la: "Giám đốc LA",
  };
  return labels[role] || role;
};

const roleColor = (role: string) => {
  if (role === "sales" || role === "employee")
    return "bg-blue-100 text-blue-600";
  if (role === "probation") return "bg-yellow-100 text-yellow-700";
  if (role === "employee_la") return "bg-green-100 text-green-600";
  if (role === "director" || role === "director_la")
    return "bg-purple-100 text-purple-700";
  if (role === "saleadmin" || role === "salesadmin_la")
    return "bg-indigo-100 text-indigo-700";
  return "bg-gray-100 text-gray-600";
};

const getSummaryValues = (
  response: any,
  subjectMap: Map<number, any>,
) => {
  const payload = unwrap(response);
  const sources = [payload?.summary, payload].filter(Boolean);
  const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
  const schoolItems = arrayFrom(sources, ["schoolExpenseItems", "schoolItems"]);
  const managementItems = arrayFrom(sources, [
    "managementExpenseItems",
    "managementItems",
  ]);
  const cashItems = arrayFrom(sources, ["cashPolicyItems", "cashPolicies"]);
  const summaryItems = [...revenues, ...schoolItems, ...managementItems];
  const matchedSubjectNames = [
    ...new Set(
      summaryItems
        .map(
          (item) => {
            const subject = subjectMap.get(
              Number(item.subjectId ?? item.subject?.id),
            );
            return (
            subject?.name ||
            subject?.code ||
            item.subject?.name ||
            item.subject?.code ||
            item.subjectName ||
            item.subjectCode
            );
          },
        )
        .filter(Boolean),
    ),
  ];
  const subjectNames = matchedSubjectNames.length
    ? matchedSubjectNames
    : [
        ...new Set(
          [...subjectMap.values()]
            .map((subject) => subject.name || subject.code)
            .filter(Boolean),
        ),
      ];
  console.debug("[GlobalExpenseReport] Đối chiếu môn học", {
    summarySubjectIds: summaryItems.map((item) =>
      Number(item.subjectId ?? item.subject?.id),
    ),
    databaseSubjects: [...subjectMap.values()].map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      schoolId: subject.schoolId ?? subject.school?.id,
    })),
    resolvedSubjectNames: subjectNames,
    usedSchoolSubjectFallback: matchedSubjectNames.length === 0,
  });
  const revenue = sum(revenues, (item) =>
    toNumber(
      item.invoiceAmount ??
        toNumber(item.unitPrice) *
          toNumber(item.studentCount) *
          toNumber(item.monthsCount),
    ),
  );
  const schoolExpense = sum(schoolItems, (item) =>
    toNumber(
      item.schoolExpenseAmount ??
        (toNumber(item.teacherUnitPrice) +
          toNumber(item.taxUnitPrice) +
          toNumber(item.csvcUnitPrice)) *
          toNumber(item.studentCount) *
          toNumber(item.monthsCount),
    ),
  );
  const managementExpense = sum(managementItems, (item) =>
    toNumber(item.totalOutside ?? item.totalOutsideExpense),
  );
  const paid = sum(schoolItems, (item) => toNumber(item.paidAmount)) +
    sum(managementItems, (item) => toNumber(item.paidAmount));
  const totalExpense = schoolExpense + managementExpense;

  return {
    revenue,
    schoolExpense,
    managementExpense,
    totalExpense,
    paid,
    remaining: Math.max(0, totalExpense - paid),
    cashPolicy: sum(
      cashItems,
      (item) => toNumber(item.cashPolicyAmount) + toNumber(item.otherAmount),
    ),
    subjectNames,
  };
};

export default function GlobalExpenseReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        schoolResponse,
        expenseResponse,
        employeeResponse,
        subjectResponse,
      ] =
        await Promise.all([
        schoolApi.getAll({ page: 1, limit: 1000 }),
        schoolExpenseApi.getAll({ page: 1, limit: 1000 }),
        getSalesEmployees(),
        subjectApi.getAll(),
      ]);
      const schools = listFrom(schoolResponse);
      const schoolMap = new Map(
        schools.map((school: any) => [Number(school.id), school]),
      );
      const employeeMap = new Map(
        employeeResponse.map((employee) => [Number(employee.id), employee]),
      );
      const subjectsBySchool = new Map<number, any[]>();
      subjectResponse.forEach((subject) => {
        const subjectSchoolId = Number(
          subject.schoolId ?? subject.school?.id,
        );
        subjectsBySchool.set(subjectSchoolId, [
          ...(subjectsBySchool.get(subjectSchoolId) || []),
          subject,
        ]);
      });
      const expenses = listFrom(expenseResponse);
      console.debug("[GlobalExpenseReport] Dữ liệu nguồn", {
        schools: schools.map((school: any) => ({
          id: school.id,
          name: school.name,
          employeeId: school.employeeId ?? school.employee?.id,
        })),
        expenses: expenses.map((expense: any) => ({
          id: expense.id,
          schoolId: expense.schoolId ?? expense.school?.id,
          period: expense.period || expense.expensePeriod,
        })),
        subjects: subjectResponse.map((subject) => ({
          id: subject.id,
          name: subject.name,
          code: subject.code,
          schoolId: subject.schoolId ?? subject.school?.id,
          schoolYear: subject.schoolYear,
        })),
        subjectsBySchool: [...subjectsBySchool.entries()].map(
          ([mappedSchoolId, mappedSubjects]) => ({
            schoolId: mappedSchoolId,
            subjectIds: mappedSubjects.map((subject) => subject.id),
          }),
        ),
      });
      const results = await Promise.allSettled(
        expenses.map(async (expense: any) => {
          const schoolId = Number(
            expense.schoolId ?? expense.school?.id,
          );
          const school = {
            ...(schoolMap.get(schoolId) || {}),
            ...(expense.school || {}),
          };
          const employee =
            school.employee ||
            employeeMap.get(
              Number(
                school.employeeId ??
                  school.employee?.id ??
                  expense.employeeId ??
                  expense.employee?.id,
              ),
            ) ||
            expense.employee ||
            {};
          const period = expense.period || expense.expensePeriod || {};
          const summary = await schoolExpenseApi.getSummary(
            Number(expense.id),
          );
          const subjects = subjectsBySchool.get(schoolId) || [];
          const subjectMap = new Map(
            subjects.map((subject: any) => [Number(subject.id), subject]),
          );
          console.debug("[GlobalExpenseReport] Phiếu thu chi", {
            schoolExpenseId: expense.id,
            schoolId,
            schoolName: school.name,
            availableSubjectIds: [...subjectMap.keys()],
            summary,
          });
          return {
            key: expense.id,
            employee,
            school,
            period,
            ...getSummaryValues(summary, subjectMap),
          };
        }),
      );
      setRows(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      );
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message ||
          "Không thể tải báo cáo tổng hợp thu chi",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.employee?.id) map.set(String(row.employee.id), row.employee.name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows]);
  const schools = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (
        row.school?.id &&
        (!employeeId || String(row.employee?.id) === employeeId)
      ) {
        map.set(String(row.school.id), row.school.name);
      }
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows, employeeId]);
  const years = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) =>
              getSchoolYear(
                Number(row.period?.month),
                Number(row.period?.year),
              ),
            )
            .filter(Boolean),
        ),
      ]
        .sort()
        .reverse(),
    [rows],
  );
  const schoolYearMonths = useMemo(
    () => getSchoolYearMonths(year),
    [year],
  );

  const filteredRows = rows.filter((row) => {
    const search = keyword.trim().toLocaleLowerCase("vi");
    if (
      search &&
      !`${row.employee?.name || ""} ${row.school?.name || ""} ${
        row.school?.taxCode || ""
      } ${(row.subjectNames || []).join(" ")}`
        .toLocaleLowerCase("vi")
        .includes(search)
    ) {
      return false;
    }
    if (employeeId && String(row.employee?.id) !== employeeId) return false;
    if (schoolId && String(row.school?.id) !== schoolId) return false;
    if (
      year &&
      getSchoolYear(
        Number(row.period?.month),
        Number(row.period?.year),
      ) !== year
    ) {
      return false;
    }
    if (
      month &&
      `${Number(row.period?.year)}-${Number(row.period?.month)}` !== month
    ) {
      return false;
    }
    return !onlyRemaining || row.remaining > 0;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, employeeId, schoolId, year, month, onlyRemaining]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    paginatedRows.forEach((row) => {
      const name = row.employee?.name || "Chưa phân công";
      map.set(name, [...(map.get(name) || []), row]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [paginatedRows]);

  const totals = filteredRows.reduce(
    (result, row) => ({
      revenue: result.revenue + row.revenue,
      totalExpense: result.totalExpense + row.totalExpense,
      paid: result.paid + row.paid,
      remaining: result.remaining + row.remaining,
      cashPolicy: result.cashPolicy + row.cashPolicy,
    }),
    { revenue: 0, totalExpense: 0, paid: 0, remaining: 0, cashPolicy: 0 },
  );

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-white text-lg font-bold text-slate-500">
        <Loader2 className="mr-3 animate-spin" /> Đang tải báo cáo...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Báo cáo tổng hợp thu chi
            </h2>
            <p className="mt-1 text-base text-slate-500">
              Nhóm theo nhân viên kinh doanh và từng trường phụ trách
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white"
          >
            <RefreshCw size={18} /> Làm mới
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tên NV, trường, MST..."
            className="rounded-xl border border-slate-200 px-4 py-3 text-base"
          />
          <SearchableSelect value={employeeId} onChange={(value) => {
            setEmployeeId(value);
            setSchoolId("");
          }} options={employees.map(([value, label]) => ({ id: value, name: label }))} placeholder="Tất cả nhân viên" searchPlaceholder="Tìm nhân viên…" />
          <SearchableSelect value={schoolId} onChange={setSchoolId} options={schools.map(([value, label]) => ({ id: value, name: label }))} placeholder="Tất cả trường" searchPlaceholder="Tìm trường…" />
          <select value={year} onChange={(e) => {
            setYear(e.target.value);
            setMonth("");
          }} className="rounded-xl border border-slate-200 px-4 py-3 text-base">
            <option value="">Tất cả năm học</option>
            {years.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={!year} className="rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-100 disabled:text-slate-400">
            <option value="">Tất cả tháng</option>
            {schoolYearMonths.map((item) => (
              <option
                key={`${item.year}-${item.month}`}
                value={`${item.year}-${item.month}`}
              >
                {String(item.month).padStart(2, "0")}/{item.year}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-base font-bold">
            <input type="checkbox" checked={onlyRemaining} onChange={(e) => setOnlyRemaining(e.target.checked)} />
            Còn phải chi
          </label>
        </div>
      </section>

      {error && <div className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Tổng doanh thu", totals.revenue],
          ["Tổng chi", totals.totalExpense],
          ["Đã chi", totals.paid],
          ["Còn phải chi", totals.remaining],
          ["Chính sách tiền mặt", totals.cashPolicy],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-base font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(value)}</p>
          </div>
        ))}
      </section>

      {groups.map(([employeeName, employeeRows]) => {
        const employee = employeeRows[0]?.employee || {};
        const roles = Array.isArray(employee.roles) ? employee.roles : [];

        return (
        <section key={employeeName} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-2 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-3xl">
              👤
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-lg font-black text-slate-800">
                {employeeName}
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                {employee.phone || employee.email || "Chưa có thông tin liên hệ"}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
                {roles.length ? (
                  roles.map((role: string) => (
                    <span
                      key={role}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${roleColor(
                        role,
                      )}`}
                    >
                      {roleLabel(role)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-slate-300">
                    Chưa có vai trò
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Trường phụ trách
              </p>
              <p className="mt-1 text-xl font-black text-slate-800">
                {new Set(employeeRows.map((row) => row.school?.id)).size}
              </p>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[1500px] whitespace-nowrap text-lg">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Nhân viên kinh doanh
                  </th>
                  <th className="px-4 py-3 text-left">Trường</th>
                  <th className="px-4 py-3 text-left">Tên môn học</th>
                  <th className="px-4 py-3 text-left">Tháng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                  <th className="px-4 py-3 text-right">Chi nhà trường</th>
                  <th className="px-4 py-3 text-right">Chi ngoài HĐ</th>
                  <th className="px-4 py-3 text-right">Tổng chi</th>
                  <th className="px-4 py-3 text-right">Đã chi</th>
                  <th className="px-4 py-3 text-right">Còn phải chi</th>
                  <th className="px-4 py-3 text-right">CS tiền mặt</th>
                  <th className="px-4 py-3 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows
                  .sort((a, b) => (a.school?.name || "").localeCompare(b.school?.name || "", "vi"))
                  .map((row) => (
                    <tr key={row.key} className="border-t border-slate-100 hover:bg-blue-50">
                      <td className="px-4 py-3 font-bold text-blue-700">
                        {row.employee?.name || "Chưa phân công"}
                      </td>
                      <td className="px-4 py-3 font-bold">{row.school?.name || "--"}</td>
                      <td className="px-4 py-3">
                        {row.subjectNames?.length
                          ? row.subjectNames.join(", ")
                          : "--"}
                      </td>
                      <td className="px-4 py-3">{row.period?.name || `${row.period?.month || "--"}/${row.period?.year || "--"}`}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.schoolExpense)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.managementExpense)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(row.totalExpense)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(row.paid)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700">{formatCurrency(row.remaining)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.cashPolicy)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(row.revenue - row.totalExpense - row.cashPolicy)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        );
      })}
      {!groups.length && (
        <div className="rounded-3xl bg-white p-12 text-center text-lg font-bold text-slate-500">
          Không có dữ liệu phù hợp với bộ lọc.
        </div>
      )}
      {filteredRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-600">
            Hiển thị {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filteredRows.length)} trong tổng{" "}
            {filteredRows.length} dòng
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-base font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <span className="min-w-24 rounded-xl bg-blue-50 px-4 py-2.5 text-center text-base font-black text-blue-700">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tiếp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
