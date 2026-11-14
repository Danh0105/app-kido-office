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

/** Các số của một dòng (trường × kỳ) — cũng dùng cho dòng tổng. */
type ReportNumbers = {
  revenue: number;
  invoiceTotal: number;
  invoiceIssued: number;
  invoiceNotIssued: number;
  invoiceNone: number;
  schoolExpense: number;
  managementExpense: number;
  totalExpense: number;
  paid: number;
  remaining: number;
  cashPolicy: number;
};

type ReportRow = ReportNumbers & {
  key: string;
  employee: any;
  school: any;
  period: any;
  subjectName: string;
};

const EMPTY_NUMBERS: ReportNumbers = {
  revenue: 0,
  invoiceTotal: 0,
  invoiceIssued: 0,
  invoiceNotIssued: 0,
  invoiceNone: 0,
  schoolExpense: 0,
  managementExpense: 0,
  totalExpense: 0,
  paid: 0,
  remaining: 0,
  cashPolicy: 0,
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

const subtractNumbers = (
  total: ReportNumbers,
  detail: ReportNumbers
): ReportNumbers =>
  Object.fromEntries(
    (Object.keys(EMPTY_NUMBERS) as (keyof ReportNumbers)[]).map((key) => [
      key,
      Math.round((total[key] - detail[key]) * 100) / 100,
    ])
  ) as ReportNumbers;

const hasMoney = (row: ReportNumbers) =>
  (Object.keys(EMPTY_NUMBERS) as (keyof ReportNumbers)[]).some(
    (key) => Math.abs(row[key]) >= 0.01
  );

const numbersFrom = (item: any, cashPolicy = 0): ReportNumbers => ({
  revenue: Number(item.revenue?.expected || 0),
  invoiceTotal: Number(item.invoice?.total || 0),
  invoiceIssued: Number(item.invoice?.issued || 0),
  invoiceNotIssued: Number(item.invoice?.notIssued || 0),
  invoiceNone: Number(item.invoice?.noInvoice || 0),
  schoolExpense: Number(item.expense?.school?.expected || 0),
  managementExpense: Number(item.expense?.management?.expected || 0),
  totalExpense: Number(item.expense?.expected || 0),
  paid: Number(item.expense?.paid || 0),
  remaining: Number(item.expense?.payable || 0),
  cashPolicy,
});

/** Doanh thu − Tổng chi − Chính sách tiền mặt (như trước). */
const differenceOf = (row: ReportNumbers) =>
  row.revenue - row.totalExpense - row.cashPolicy;

const periodLabel = (period: any) =>
  period?.name || `${period?.month || "--"}/${period?.year || "--"}`;

const money = (value: number) => formatCurrency(value);

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
      className={`px-3 py-2.5 text-right tabular-nums ${
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
      <MoneyCell value={row.revenue} className={`${bold} text-slate-900`} />
      <MoneyCell
        value={row.invoiceTotal}
        className={`border-l border-amber-100 ${
          bold || "font-bold"
        } text-amber-800`}
      />
      <MoneyCell value={row.invoiceNone} className={`${bold} text-slate-500`} />
      <MoneyCell
        value={row.schoolExpense}
        className={`border-l border-sky-100 ${bold} text-slate-800`}
      />
      <MoneyCell
        value={row.managementExpense}
        className={`${bold} text-slate-800`}
      />
      <MoneyCell value={row.paid} className={`${bold} text-emerald-700`} />
      <MoneyCell
        value={row.remaining}
        className={`${bold || "font-bold"} text-orange-700`}
      />
      <MoneyCell
        value={row.cashPolicy}
        className={`border-l border-slate-100 ${bold} text-slate-700`}
      />
      <MoneyCell
        value={differenceOf(row)}
        className={`${bold || "font-bold"} text-blue-700`}
      />
    </>
  );
}

const GROUP_HEADERS = [
  { label: "Doanh thu", span: 1, className: "bg-slate-200 text-slate-700" },
  { label: "Hóa đơn", span: 2, className: "bg-amber-100 text-amber-800" },
  { label: "Chi", span: 4, className: "bg-sky-100 text-sky-800" },
  { label: "", span: 2, className: "bg-slate-100" },
];

const COLUMN_HEADERS: { label: string; title?: string }[] = [
  { label: "Doanh thu", title: "Thành tiền bảng Doanh Thu" },
  {
    label: "Tổng tiền HĐ",
    title:
      "Tổng thanh toán công ty của bảng Hóa Đơn = Số lượng × (Đơn giá − GV − Thuế − CSVC)",
  },
  {
    label: "Tiền không xuất HĐ",
    title: "Số tiền của các dòng chọn loại Không xuất HĐ",
  },
  { label: "Chi trường", title: "Chi Trường + Giáo viên trường" },
  { label: "Chi ngoài", title: "Chi Ngoài" },
  { label: "Đã chi" },
  { label: "Còn phải chi" },
  { label: "CS tiền mặt", title: "Chính sách tiền mặt" },
  { label: "Chênh lệch", title: "Doanh thu − Tổng chi − CS tiền mặt" },
];

const HEADER_TOTALS: {
  label: string;
  value: (row: ReportNumbers) => number;
  tone?: string;
}[] = [
  { label: "Doanh thu", value: (row) => row.revenue },
  {
    label: "Tổng tiền HĐ",
    value: (row) => row.invoiceTotal,
    tone: "text-amber-800",
  },
  { label: "Tiền không xuất HĐ", value: (row) => row.invoiceNone },
  { label: "Chi trường", value: (row) => row.schoolExpense },
  { label: "Chi ngoài", value: (row) => row.managementExpense },
  { label: "Đã chi", value: (row) => row.paid, tone: "text-emerald-700" },
  {
    label: "Còn phải chi",
    value: (row) => row.remaining,
    tone: "text-orange-700",
  },
  { label: "CS tiền mặt", value: (row) => row.cashPolicy },
  { label: "Chênh lệch", value: differenceOf, tone: "text-blue-700" },
];

function HeaderTotals({ total }: { total: ReportNumbers }) {
  return (
    <div className="overflow-x-auto border-b border-slate-100 bg-slate-50/70">
      <div className="grid min-w-[1260px] grid-cols-9 divide-x divide-slate-200">
        {HEADER_TOTALS.map((item) => (
          <div key={item.label} className="px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {item.label}
            </p>
            <p
              className={`mt-0.5 text-xs font-black tabular-nums ${
                item.tone ?? "text-slate-800"
              }`}
            >
              {money(item.value(total))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Báo cáo tổng hợp thu chi: mỗi dòng là một trường trong một kỳ, nhóm theo nhân
 * viên kinh doanh; cột chia ba nhóm Doanh thu | Hóa đơn | Chi, có dòng tổng của
 * từng nhân viên (tính trên mọi dòng khớp lọc, không chỉ trang đang xem) và
 * tổng chung ở các thẻ phía trên.
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
  const [onlyRemaining, setOnlyRemaining] = useState(false);
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
        const total = numbersFrom(item, Number(item.cashPolicy || 0));
        const subjectRows: ReportRow[] = (item.subjects || []).map(
          (subjectItem: any) => ({
            ...base,
            ...numbersFrom(subjectItem),
            key: `${item.schoolExpenseId}-subject-${subjectItem.subject?.id}`,
            subjectName: subjectItem.subject?.name || "Chưa đặt tên môn",
          })
        );

        if (!subjectRows.length) {
          return [
            {
              ...base,
              ...total,
              key: `${item.schoolExpenseId}-common`,
              subjectName: "Khoản chung / chưa phân môn",
            },
          ];
        }

        const remainder = subtractNumbers(total, sumRows(subjectRows));
        if (hasMoney(remainder)) {
          subjectRows.push({
            ...base,
            ...remainder,
            key: `${item.schoolExpenseId}-common`,
            subjectName: "Khoản chung / chưa phân môn",
          });
        }
        return subjectRows;
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
        return !onlyRemaining || row.remaining > 0;
      }),
    [rows, keyword, employeeId, schoolId, year, month, onlyRemaining]
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
  }, [keyword, employeeId, schoolId, year, month, onlyRemaining]);

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

  const cards: { label: string; value: number; note?: string; tone: string }[] =
    [
      { label: "Doanh thu", value: totals.revenue, tone: "text-slate-900" },
      {
        label: "Tổng tiền hóa đơn",
        value: totals.invoiceTotal,
        note: "Đã xuất + Chưa xuất + Không xuất HĐ",
        tone: "text-amber-800",
      },
      {
        label: "Hóa đơn đã xuất",
        value: totals.invoiceIssued,
        tone: "text-emerald-700",
      },
      {
        label: "Hóa đơn chưa xuất",
        value: totals.invoiceNotIssued,
        tone: "text-rose-700",
      },
      {
        label: "Tiền không xuất hóa đơn",
        value: totals.invoiceNone,
        tone: "text-slate-700",
      },
      {
        label: "Tổng chi",
        value: totals.totalExpense,
        note: `Đã chi ${money(totals.paid)}`,
        tone: "text-slate-900",
      },
      {
        label: "Còn phải chi",
        value: totals.remaining,
        tone: "text-orange-700",
      },
      {
        label: "Chênh lệch",
        value: differenceOf(totals),
        note: `CS tiền mặt ${money(totals.cashPolicy)}`,
        tone: "text-blue-700",
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
              Mỗi dòng là một trường trong một kỳ, nhóm theo nhân viên kinh
              doanh — Doanh thu, Hóa đơn và Chi
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
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-base font-bold">
            <input
              type="checkbox"
              checked={onlyRemaining}
              onChange={(e) => setOnlyRemaining(e.target.checked)}
            />
            Còn phải chi
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className={`mt-2 text-xl font-black tabular-nums ${card.tone}`}>
              {money(card.value)}
            </p>
            {card.note && (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {card.note}
              </p>
            )}
          </div>
        ))}
      </section>

      {groups.map(([employeeName, employeeRows]) => {
        const employee = employeeRows[0]?.employee || {};
        const roles = Array.isArray(employee.roles) ? employee.roles : [];
        const all = employeeTotals.get(employeeName);

        return (
          <section
            key={employeeName}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-col items-center gap-2 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-2xl">
                👤
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-lg font-black text-slate-800">
                  {employeeName}
                </p>
                <p className="mt-0.5 text-sm text-slate-400">
                  {employee.phone ||
                    employee.email ||
                    "Chưa có thông tin liên hệ"}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
                  {roles.length ? (
                    roles.map((role: string) => (
                      <span
                        key={role}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${roleColor(
                          role
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
              <div className="flex gap-2">
                <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Trường
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {new Set(all?.rows.map((row) => row.school?.id)).size}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 px-4 py-2 text-center">
                  <p className="text-xs font-semibold uppercase text-amber-600">
                    HĐ chưa xuất
                  </p>
                  <p className="mt-1 text-base font-black tabular-nums text-rose-700">
                    {money(all?.total.invoiceNotIssued ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            {all && <HeaderTotals total={all.total} />}
            <div className="overflow-auto">
              <table className="w-full min-w-[1500px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-xs font-black uppercase tracking-wide">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-left text-slate-700"
                    >
                      Trường
                    </th>
                    <th
                      rowSpan={2}
                      className="bg-slate-100 px-3 py-2 text-left text-slate-700"
                    >
                      Kỳ
                    </th>
                    <th
                      rowSpan={2}
                      className="bg-slate-100 px-3 py-2 text-left text-slate-700"
                    >
                      Môn học
                    </th>
                    {GROUP_HEADERS.map((group, index) => (
                      <th
                        key={index}
                        colSpan={group.span}
                        className={`px-3 py-2 text-center ${group.className}`}
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-600">
                    {COLUMN_HEADERS.map((column) => (
                      <th
                        key={column.label}
                        title={column.title}
                        className="px-3 py-2 text-right"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-slate-100 hover:bg-blue-50/60"
                    >
                      <td className="sticky left-0 z-[1] max-w-[280px] bg-white px-3 py-2.5">
                        <p className="truncate font-bold text-slate-900">
                          {row.school?.name || "--"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {periodLabel(row.period)}
                      </td>
                      <td
                        className="max-w-[240px] truncate px-3 py-2.5 font-semibold text-slate-700"
                        title={row.subjectName}
                      >
                        {row.subjectName}
                      </td>
                      <NumberCells row={row} />
                    </tr>
                  ))}
                </tbody>
                {all && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td
                        colSpan={3}
                        className="sticky left-0 z-[1] bg-slate-50 px-3 py-3 font-black text-slate-800"
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
