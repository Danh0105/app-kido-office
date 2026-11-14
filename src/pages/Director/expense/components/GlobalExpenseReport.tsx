import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { schoolApi } from "@/service/school.api";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { getSalesEmployees } from "@/service/employee";
import SearchableSelect from "@/components/SearchableSelect";
import { formatCurrency } from "../RealExpenseDetail/components/ExpenseSummary";
import {
  DEFAULT_SCHOOL_YEAR,
  includeDefaultSchoolYear,
} from "@/constants/schoolYear";

const listFrom = (value: any) =>
  Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

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

/** Các số của một dòng môn học — cũng dùng cho header/footer tổng. */
type ReportNumbers = {
  students: number;
  periods: number;
  revenue: number;
  schoolExpense: number;
  schoolPaid: number;
  invoice: number;
  collected: number;
  outsideExpense: number;
  outsidePaid: number;
  schoolTeacher: number;
  companyTeacher: number;
  annualPolicy: number;
  otherExpense: number;
  profit: number;
};

type ReportRow = ReportNumbers & {
  key: string;
  employee: any;
  school: any;
  period: any;
  subjectName: string;
};

const EMPTY_NUMBERS: ReportNumbers = {
  students: 0,
  periods: 0,
  revenue: 0,
  schoolExpense: 0,
  schoolPaid: 0,
  invoice: 0,
  collected: 0,
  outsideExpense: 0,
  outsidePaid: 0,
  schoolTeacher: 0,
  companyTeacher: 0,
  annualPolicy: 0,
  otherExpense: 0,
  profit: 0,
};

const sumRows = (rows: ReportNumbers[]): ReportNumbers =>
  rows.reduce(
    (total, row) =>
      Object.fromEntries(
        (Object.keys(EMPTY_NUMBERS) as (keyof ReportNumbers)[]).map((key) => [
          key,
          Math.round((total[key] + row[key]) * 100) / 100,
        ])
      ) as ReportNumbers,
    { ...EMPTY_NUMBERS }
  );

const numbersFrom = (item: any): ReportNumbers => ({
  students: Number(item.quantity?.students || 0),
  periods: Number(item.quantity?.periods || 0),
  revenue: Number(item.revenue?.expected || 0),
  schoolExpense: Number(item.breakdown?.school?.expected || 0),
  schoolPaid: Number(item.breakdown?.school?.paid || 0),
  invoice: Number(item.invoice?.total || 0),
  // Đã thu = Số tiền thu/chi của các dòng Hóa Đơn chọn "Thu" (như sổ thu chi);
  // server cũ chưa trả trường này thì giữ số Đã thu của bảng Doanh Thu.
  collected: Number(
    typeof item.invoice?.collected === "number"
      ? item.invoice.collected
      : item.revenue?.collected || 0
  ),
  outsideExpense: Number(item.breakdown?.outside?.expected || 0),
  outsidePaid: Number(item.breakdown?.outside?.paid || 0),
  schoolTeacher: Number(item.breakdown?.schoolTeacher || 0),
  companyTeacher: Number(item.breakdown?.companyTeacher || 0),
  annualPolicy: Number(item.breakdown?.annualPolicy || 0),
  otherExpense: Number(item.breakdown?.other || 0),
  profit: Number(item.breakdown?.profit || 0),
});

const periodLabel = (period: any) =>
  period?.name || `${period?.month || "--"}/${period?.year || "--"}`;

const money = (value: number) => formatCurrency(value);

const quantity = (row: Pick<ReportNumbers, "students" | "periods">) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
    row.students
  )} HS / ${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(row.periods)} tiết`;

/** Ô số: số 0 hiện nhạt để mắt dừng ở ô có tiền. */
function MoneyCell({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <td
      className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${
        value ? className : "text-slate-300"
      }`}
    >
      {money(value)}
    </td>
  );
}

/** Các cột số theo đúng thứ tự tiêu đề — dùng chung cho dòng trường và dòng tổng. */
function NumberCells({
  row,
  strong = false,
}: {
  row: ReportNumbers;
  strong?: boolean;
}) {
  const bold = strong ? "font-black" : "";
  return (
    <>
      <td
        className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${bold} text-slate-700`}
      >
        {quantity(row)}
      </td>
      <MoneyCell value={row.revenue} className={`${bold} text-slate-900`} />
      <MoneyCell
        value={row.schoolExpense}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.schoolPaid}
        className={`${bold} text-emerald-700`}
      />
      <MoneyCell
        value={row.invoice}
        className={`${bold || "font-bold"} text-amber-800`}
      />
      <MoneyCell value={row.collected} className={`${bold} text-emerald-700`} />
      <MoneyCell
        value={row.outsideExpense}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.outsidePaid}
        className={`${bold} text-emerald-700`}
      />
      <MoneyCell
        value={row.schoolTeacher}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.companyTeacher}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.annualPolicy}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.otherExpense}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.profit}
        className={`${bold || "font-bold"} ${
          row.profit < 0 ? "text-rose-700" : "text-blue-700"
        }`}
      />
    </>
  );
}

const GROUP_HEADERS = [
  { label: "Số lượng", span: 1, className: "bg-slate-100 text-slate-700" },
  { label: "Doanh thu", span: 1, className: "bg-slate-200 text-slate-700" },
  { label: "Chi trường", span: 2, className: "bg-sky-100 text-sky-800" },
  { label: "Hóa đơn / Thu", span: 2, className: "bg-amber-100 text-amber-800" },
  { label: "Chi ngoài", span: 2, className: "bg-cyan-100 text-cyan-800" },
  {
    label: "Chi phí khác",
    span: 4,
    className: "bg-violet-100 text-violet-800",
  },
  { label: "Kết quả", span: 1, className: "bg-blue-100 text-blue-800" },
];

const COLUMN_HEADERS: { label: string; title?: string }[] = [
  { label: "Số HS / số tiết" },
  { label: "Doanh thu", title: "Thành tiền bảng Doanh Thu" },
  { label: "Chi trường", title: "Chi trường, không gồm Giáo viên trường" },
  { label: "Đã chi", title: "Đã chi trường" },
  { label: "Hóa đơn", title: "Tổng thanh toán công ty của bảng Hóa Đơn" },
  {
    label: "Đã thu",
    title: 'Số tiền thu/chi của các dòng Hóa Đơn chọn "Thu"',
  },
  { label: "Chi ngoài", title: "Chi Ngoài" },
  { label: "Đã chi", title: "Đã chi ngoài" },
  { label: "Giáo viên trường" },
  { label: "Giáo viên Cty" },
  { label: "CS năm", title: "Phần chi chính sách năm của tháng, đã trừ thuế" },
  { label: "Chi khác" },
  {
    label: "Lợi nhuận",
    title:
      "Doanh thu − Chi trường − Chi ngoài − Giáo viên trường − Giáo viên Cty − CS năm − Chi khác",
  },
];

const rowGroupSpan = (
  rows: ReportRow[],
  index: number,
  getKey: (row: ReportRow) => string
) => {
  const key = getKey(rows[index]);
  if (index > 0 && getKey(rows[index - 1]) === key) return 0;
  let span = 1;
  while (index + span < rows.length && getKey(rows[index + span]) === key) {
    span += 1;
  }
  return span;
};

/**
 * Báo cáo tổng hợp thu chi theo môn, nhóm theo nhân viên kinh doanh. Header và
 * footer của mỗi bảng cùng dùng một phép cộng để luôn khớp nhau.
 */
export default function GlobalExpenseReport() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [year, setYear] = useState(DEFAULT_SCHOOL_YEAR);
  const [month, setMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [schoolResponse, summaryResponse, employeeResponse] =
        await Promise.all([
          schoolApi.getAll({ page: 1, limit: 1000 }),
          schoolExpenseApi.getCashflowSummary(),
          getSalesEmployees(),
        ]);
      const schools = listFrom(schoolResponse);
      const schoolMap = new Map(
        schools.map((school: any) => [Number(school.id), school])
      );
      const employeeMap = new Map(
        employeeResponse.map((employee) => [Number(employee.id), employee])
      );
      const summaryItems = Array.isArray(summaryResponse?.items)
        ? summaryResponse.items
        : [];
      const results: ReportRow[] = summaryItems.flatMap((item) => {
        const schoolId = Number(item.school?.id);
        const school: any = {
          ...(schoolMap.get(schoolId) || {}),
          ...(item.school || {}),
        };
        const employee =
          school.employee ||
          employeeMap.get(
            Number(school.employeeId ?? school.employee?.id ?? 0)
          ) ||
          {};
        const base = {
          employee,
          school,
          period: item.period,
        };
        return (item.subjects || []).map((subjectItem: any) => ({
          ...base,
          ...numbersFrom(subjectItem),
          key: `${item.schoolExpenseId}-subject-${subjectItem.subject?.id}`,
          subjectName: subjectItem.subject?.name || "Chưa đặt tên môn",
        }));
      });
      setRows(results);
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message ||
          "Không thể tải báo cáo tổng hợp thu chi"
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
      includeDefaultSchoolYear(
        rows
          .map((row) =>
            getSchoolYear(Number(row.period?.month), Number(row.period?.year))
          )
          .filter(Boolean)
      )
        .sort()
        .reverse(),
    [rows]
  );
  const schoolYearMonths = useMemo(() => getSchoolYearMonths(year), [year]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const search = keyword.trim().toLocaleLowerCase("vi");
        if (
          search &&
          !`${row.employee?.name || ""} ${row.school?.name || ""} ${
            row.school?.taxCode || ""
          } ${row.subjectName}`
            .toLocaleLowerCase("vi")
            .includes(search)
        ) {
          return false;
        }
        if (employeeId && String(row.employee?.id) !== employeeId) return false;
        if (schoolId && String(row.school?.id) !== schoolId) return false;
        if (
          year &&
          getSchoolYear(Number(row.period?.month), Number(row.period?.year)) !==
            year
        ) {
          return false;
        }
        if (
          month &&
          `${Number(row.period?.year)}-${Number(row.period?.month)}` !== month
        ) {
          return false;
        }
        return true;
      }),
    [rows, keyword, employeeId, schoolId, year, month]
  );

  // Sắp theo nhân viên → trường → kỳ (mới nhất trước) để một nhân viên nằm liền nhau qua các trang.
  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort(
        (a, b) =>
          (a.employee?.name || "Chưa phân công").localeCompare(
            b.employee?.name || "Chưa phân công",
            "vi"
          ) ||
          (a.school?.name || "").localeCompare(b.school?.name || "", "vi") ||
          Number(b.period?.year) - Number(a.period?.year) ||
          Number(b.period?.month) - Number(a.period?.month) ||
          a.subjectName.localeCompare(b.subjectName, "vi")
      ),
    [filteredRows]
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, employeeId, schoolId, year, month]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Tổng của từng nhân viên tính trên mọi dòng khớp lọc (kể cả trang khác).
  const employeeTotals = useMemo(() => {
    const map = new Map<string, { rows: ReportRow[]; total: ReportNumbers }>();
    filteredRows.forEach((row) => {
      const name = row.employee?.name || "Chưa phân công";
      const current = map.get(name) ?? { rows: [], total: EMPTY_NUMBERS };
      current.rows.push(row);
      map.set(name, current);
    });
    map.forEach((value) => {
      value.total = sumRows(value.rows);
    });
    return map;
  }, [filteredRows]);

  const groups = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    paginatedRows.forEach((row) => {
      const name = row.employee?.name || "Chưa phân công";
      map.set(name, [...(map.get(name) || []), row]);
    });
    return [...map.entries()];
  }, [paginatedRows]);

  const totals = useMemo(() => sumRows(filteredRows), [filteredRows]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-white text-lg font-bold text-slate-500">
        <Loader2 className="mr-3 animate-spin" /> Đang tải báo cáo...
      </div>
    );
  }

  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Doanh thu", value: totals.revenue, tone: "text-slate-900" },
    { label: "Hóa đơn", value: totals.invoice, tone: "text-amber-800" },
    { label: "Đã thu", value: totals.collected, tone: "text-emerald-700" },
    {
      label: "Chi trường",
      value: totals.schoolExpense,
      tone: "text-slate-900",
    },
    {
      label: "Chi ngoài",
      value: totals.outsideExpense,
      tone: "text-slate-900",
    },
    {
      label: "Lợi nhuận",
      value: totals.profit,
      tone: totals.profit < 0 ? "text-rose-700" : "text-blue-700",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Báo cáo tổng hợp thu chi
            </h2>
            <p className="mt-1 text-base text-slate-500">
              Mỗi dòng là một môn trong một kỳ; lợi nhuận tính theo đúng các
              khoản chi hiển thị trên bảng
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
            placeholder="Tên NV, trường, MST, môn..."
            className="rounded-xl border border-slate-200 px-4 py-3 text-base"
          />
          <SearchableSelect
            value={employeeId}
            onChange={(value) => {
              setEmployeeId(value);
              setSchoolId("");
            }}
            options={employees.map(([value, label]) => ({
              id: value,
              name: label,
            }))}
            placeholder="Tất cả nhân viên"
            searchPlaceholder="Tìm nhân viên…"
          />
          <SearchableSelect
            value={schoolId}
            onChange={setSchoolId}
            options={schools.map(([value, label]) => ({
              id: value,
              name: label,
            }))}
            placeholder="Tất cả trường"
            searchPlaceholder="Tìm trường…"
          />
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setMonth("");
            }}
            className="rounded-xl border border-slate-200 px-4 py-3 text-base"
          >
            <option value="">Tất cả năm học</option>
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={!year}
            className="rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-100 disabled:text-slate-400"
          >
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
        </div>
      </section>

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-auto border border-slate-300 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              {cards.map((card) => (
                <th
                  key={card.label}
                  className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-600"
                >
                  {card.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cards.map((card) => (
                <td
                  key={card.label}
                  className={`border border-slate-300 px-3 py-2 text-right font-black tabular-nums ${card.tone}`}
                >
                  {money(card.value)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      {groups.map(([employeeName, employeeRows]) => {
        const employee = employeeRows[0]?.employee || {};
        const roles = Array.isArray(employee.roles) ? employee.roles : [];
        const all = employeeTotals.get(employeeName);
        const schoolOrder = new Map<string, number>();
        employeeRows.forEach((row) => {
          const key = String(row.school?.id || row.school?.name || "unknown");
          if (!schoolOrder.has(key)) schoolOrder.set(key, schoolOrder.size);
        });

        return (
          <section
            key={employeeName}
            className="overflow-hidden border border-slate-300 bg-white"
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-300 bg-slate-100 px-3 py-2 text-sm">
              <strong className="text-slate-900">{employeeName}</strong>
              <span className="text-slate-500">
                {employee.phone || employee.email || "Chưa có liên hệ"}
              </span>
              <span className="text-slate-500">
                {roles.length
                  ? roles.map(roleLabel).join(", ")
                  : "Chưa có vai trò"}
              </span>
              <span className="ml-auto font-semibold text-slate-700">
                {new Set(all?.rows.map((row) => row.school?.id)).size} trường
              </span>
              <span
                className={`font-black tabular-nums ${
                  (all?.total.profit ?? 0) < 0
                    ? "text-rose-700"
                    : "text-blue-700"
                }`}
              >
                Lợi nhuận: {money(all?.total.profit ?? 0)}
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[2200px] border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="font-black uppercase tracking-wide">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-10 min-w-[260px] border border-slate-400 bg-slate-200 px-2 py-1.5 text-left text-slate-700"
                    >
                      Trường
                    </th>
                    <th
                      rowSpan={2}
                      className="min-w-[130px] border border-slate-400 bg-slate-200 px-2 py-1.5 text-left text-slate-700"
                    >
                      Kỳ
                    </th>
                    <th
                      rowSpan={2}
                      className="min-w-[220px] border border-slate-400 bg-slate-200 px-2 py-1.5 text-left text-slate-700"
                    >
                      Môn học
                    </th>
                    {GROUP_HEADERS.map((group, index) => (
                      <th
                        key={index}
                        colSpan={group.span}
                        className={`border border-slate-400 px-2 py-1.5 text-center ${group.className}`}
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-100 font-bold text-slate-600">
                    {COLUMN_HEADERS.map((column, index) => (
                      <th
                        key={`${column.label}-${index}`}
                        title={column.title}
                        className="border border-slate-400 px-2 py-1.5 text-right"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  {all && (
                    <tr className="bg-yellow-50">
                      <th
                        colSpan={3}
                        className="sticky left-0 z-10 border border-slate-400 bg-yellow-50 px-2 py-1.5 text-left font-black text-slate-800"
                      >
                        TỔNG {employeeName.toLocaleUpperCase("vi")}
                      </th>
                      <NumberCells row={all.total} strong />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {employeeRows.map((row, index) => {
                    const schoolKeyOf = (item: ReportRow) =>
                      String(item.school?.id || item.school?.name || "unknown");
                    const periodKeyOf = (item: ReportRow) =>
                      `${schoolKeyOf(item)}-${String(item.period?.id || "")}`;
                    const schoolKey = schoolKeyOf(row);
                    const schoolSpan = rowGroupSpan(
                      employeeRows,
                      index,
                      schoolKeyOf
                    );
                    const periodSpan = rowGroupSpan(
                      employeeRows,
                      index,
                      periodKeyOf
                    );
                    const order = schoolOrder.get(schoolKey) || 0;
                    const rowBackground =
                      order % 2 === 0 ? "bg-white" : "bg-slate-50";

                    return (
                      <tr
                        key={row.key}
                        className={`${rowBackground} hover:bg-yellow-50`}
                      >
                        {schoolSpan > 0 && (
                          <td
                            rowSpan={schoolSpan}
                            className={`sticky left-0 z-[1] max-w-[280px] border border-slate-400 px-2 py-1.5 align-top font-bold text-slate-900 ${rowBackground}`}
                          >
                            <p className="whitespace-normal leading-5">
                              {row.school?.name || "--"}
                            </p>
                          </td>
                        )}
                        {periodSpan > 0 && (
                          <td
                            rowSpan={periodSpan}
                            className={`border border-slate-300 px-2 py-1.5 align-top font-semibold text-slate-600 ${rowBackground}`}
                          >
                            {periodLabel(row.period)}
                          </td>
                        )}
                        <td
                          className="max-w-[240px] truncate border border-slate-300 px-2 py-1.5 font-semibold text-slate-700"
                          title={row.subjectName}
                        >
                          {row.subjectName}
                        </td>
                        <NumberCells row={row} />
                      </tr>
                    );
                  })}
                </tbody>
                {all && (
                  <tfoot>
                    <tr className="bg-yellow-50">
                      <td
                        colSpan={3}
                        className="sticky left-0 z-[1] border border-slate-400 bg-yellow-50 px-2 py-1.5 font-black text-slate-800"
                      >
                        Tổng {employeeName}
                        <span className="ml-1 text-xs font-semibold text-slate-400">
                          ({all.rows.length} dòng)
                        </span>
                      </td>
                      <NumberCells row={all.total} strong />
                    </tr>
                  </tfoot>
                )}
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
      {sortedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-600">
            Hiển thị {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedRows.length)} trong tổng{" "}
            {sortedRows.length} dòng
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
