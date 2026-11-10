import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";

import {
  DEFAULT_SCHOOL_YEAR,
  PREVIOUS_SCHOOL_YEAR,
} from "@/constants/schoolYear";
import {
  collaboratorPayrollApi,
  type CollaboratorPayrollResult,
  type CollaboratorPayrollSubject,
  type CollaboratorPayrollTotals,
} from "@/service/collaboratorPayroll";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  formatPayrollMoney,
  monthLabel,
  monthRange,
  normalizeSearch,
  payrollWarnings,
  schoolYearMonths,
  schoolYearOf,
  schoolYearRange,
  type MonthOption,
} from "../../utils/collaboratorPayroll";
import TeacherPayrollTable from "./TeacherPayrollTable";

type Props = {
  /** Có thì chỉ xem một trường (tab trong chi tiết trường). */
  schoolId?: number | null;
  schoolName?: string;
  /** Năm học do trang cha quản lý; không truyền thì có ô chọn riêng. */
  schoolYear?: string;
  /** Tháng mở sẵn (vd. tháng của kỳ thu chi đang xem). */
  initialMonth?: MonthOption | null;
};

const ALL_MONTHS = "all";
const monthKey = ({ month, year }: MonthOption) => `${month}-${year}`;

const today = new Date();
const CURRENT_MONTH: MonthOption = {
  month: today.getMonth() + 1,
  year: today.getFullYear(),
};

const pickMonthKey = (schoolYear: string, preferred: MonthOption[]) => {
  const keys = new Set(schoolYearMonths(schoolYear).map(monthKey));
  const hit = preferred.find((option) => keys.has(monthKey(option)));
  return hit ? monthKey(hit) : ALL_MONTHS;
};

const WarningText = ({ row }: { row: CollaboratorPayrollTotals }) => {
  const warnings = payrollWarnings(row);
  if (!warnings.length) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
      <AlertTriangle size={13} />
      {warnings.join(" · ")}
    </span>
  );
};

const subjectLabel = (subject: CollaboratorPayrollSubject) =>
  [subject.subjectCode, subject.subjectName].filter(Boolean).join(" • ") +
  (subject.schoolYear ? ` (${subject.schoolYear})` : "");

const cell = "px-3 py-2.5 text-sm";
const numCell = `${cell} text-right tabular-nums`;

/**
 * Tổng hợp lương giáo viên cộng tác viên theo trường → môn → giáo viên, lấy
 * từ chấm công. Chỉ để xem: không ghi vào bảng thu chi nào.
 */
export default function CollaboratorPayrollReport({
  schoolId,
  schoolName,
  schoolYear: controlledSchoolYear,
  initialMonth,
}: Props) {
  const singleSchool = !!schoolId;
  const [localSchoolYear, setLocalSchoolYear] = useState(() =>
    initialMonth
      ? schoolYearOf(initialMonth.month, initialMonth.year)
      : DEFAULT_SCHOOL_YEAR,
  );
  const schoolYear = controlledSchoolYear || localSchoolYear;
  const [selectedMonth, setSelectedMonth] = useState(() =>
    pickMonthKey(
      schoolYear,
      initialMonth ? [initialMonth, CURRENT_MONTH] : [CURRENT_MONTH],
    ),
  );
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<CollaboratorPayrollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openSchools, setOpenSchools] = useState<Set<number>>(new Set());
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());

  const months = useMemo(() => schoolYearMonths(schoolYear), [schoolYear]);

  // Đổi năm học mà tháng đang chọn không thuộc năm đó → tháng hiện tại hoặc cả năm.
  useEffect(() => {
    if (
      selectedMonth !== ALL_MONTHS &&
      !months.some((option) => monthKey(option) === selectedMonth)
    ) {
      setSelectedMonth(pickMonthKey(schoolYear, [CURRENT_MONTH]));
    }
  }, [months, schoolYear, selectedMonth]);

  // Kỳ thu chi đổi (chọn tháng khác ở trang cha) → theo tháng mới.
  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(pickMonthKey(schoolYear, [initialMonth]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMonth?.month, initialMonth?.year]);

  const range = useMemo(() => {
    if (selectedMonth === ALL_MONTHS) return schoolYearRange(schoolYear);
    const option = months.find((item) => monthKey(item) === selectedMonth);
    return option ? monthRange(option.month, option.year) : null;
  }, [months, schoolYear, selectedMonth]);

  useEffect(() => {
    if (!range) return;
    let active = true;
    setLoading(true);
    setError("");
    collaboratorPayrollApi
      .summary({ ...range, ...(schoolId ? { schoolId } : {}) })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setError(
          getApiErrorMessage(err, "Không thể tải lương giáo viên cộng tác viên"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range?.fromDate, range?.toDate, schoolId, reloadKey]);

  const schools = useMemo(() => {
    const list = data?.schools || [];
    const search = normalizeSearch(keyword);
    if (!search) return list;
    return list.filter((school) =>
      normalizeSearch(school.schoolName).includes(search),
    );
  }, [data, keyword]);

  const totals: CollaboratorPayrollTotals | undefined = singleSchool
    ? data?.schools[0] || data?.grandTotal
    : data?.grandTotal;

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const periodText =
    selectedMonth === ALL_MONTHS
      ? `cả năm học ${schoolYear}`
      : `tháng ${monthLabel(
          months.find((item) => monthKey(item) === selectedMonth) ||
            CURRENT_MONTH,
        )}`;

  const yearOptions = Array.from(
    new Set([
      DEFAULT_SCHOOL_YEAR,
      PREVIOUS_SCHOOL_YEAR,
      schoolYearOf(CURRENT_MONTH.month, CURRENT_MONTH.year),
      schoolYear,
    ]),
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* BỘ LỌC */}
      <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-800">
            Lương giáo viên cộng tác viên
          </h3>
          <p className="text-sm text-slate-500">
            {singleSchool && schoolName ? `${schoolName} — ` : ""}
            Theo chấm công {periodText}. Chỉ để xem, không cộng vào Tổng chi
            trường.
          </p>
        </div>

        {!controlledSchoolYear && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              Năm học
            </span>
            <select
              value={schoolYear}
              onChange={(event) => setLocalSchoolYear(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Tháng</span>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3"
          >
            <option value={ALL_MONTHS}>Cả năm học</option>
            {months.map((option) => (
              <option key={monthKey(option)} value={monthKey(option)}>
                Tháng {monthLabel(option)}
              </option>
            ))}
          </select>
        </label>

        {!singleSchool && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              Tìm trường
            </span>
            <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tên trường..."
                className="w-44 bg-transparent outline-none"
              />
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Tải lại
        </button>
      </div>

      {/* TỔNG */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm text-indigo-100">
              <Wallet size={16} /> Tổng lương CTV
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {formatPayrollMoney(totals.totalAmount)}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Tiền dạy / chi phí khác</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {formatPayrollMoney(totals.teachingAmount)}
              <span className="text-sm font-medium text-slate-500">
                {" "}
                + {formatPayrollMoney(totals.otherCostsAmount)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users size={16} /> Giáo viên / buổi / tiết
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {totals.teacherCount} GV · {totals.presentSessions} buổi ·{" "}
              {totals.payablePeriods} tiết
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Cần kiểm tra</div>
            <div className="mt-1">
              {payrollWarnings(totals).length ? (
                <WarningText row={totals} />
              ) : (
                <span className="text-sm font-medium text-emerald-700">
                  Đã đủ đơn giá và chấm công
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Đang tải...
        </div>
      )}

      {/* MỘT TRƯỜNG: từng môn kèm bảng giáo viên */}
      {singleSchool && data && (
        <div className="space-y-4">
          {(data.schools[0]?.subjects || []).map((subject) => (
            <section
              key={subject.subjectId}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-indigo-50 px-4 py-3">
                <span className="font-bold text-indigo-900">
                  {subjectLabel(subject)}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-sm text-indigo-900">
                  <WarningText row={subject} />
                  <span>{subject.teacherCount} giáo viên</span>
                  <span className="font-bold tabular-nums">
                    {formatPayrollMoney(subject.totalAmount)}
                  </span>
                </span>
              </div>
              <TeacherPayrollTable teachers={subject.teachers} total={subject} />
            </section>
          ))}
          {!data.schools.length && !loading && (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500">
              Không có buổi dạy nào của giáo viên cộng tác viên ở trường này
              trong {periodText}.
            </div>
          )}
        </div>
      )}

      {/* MỌI TRƯỜNG: trường → môn → giáo viên */}
      {!singleSchool && data && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className={`${cell} text-left`}>Trường / Môn</th>
                  <th className={`${cell} text-right`}>GV</th>
                  <th className={`${cell} text-right`}>Buổi</th>
                  <th className={`${cell} text-right`}>Tiết</th>
                  <th className={`${cell} text-right`}>Tiền dạy</th>
                  <th className={`${cell} text-right`}>Chi phí khác</th>
                  <th className={`${cell} text-right`}>Tổng lương</th>
                  <th className={`${cell} text-left`}>Lưu ý</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const schoolOpen = openSchools.has(school.schoolId);
                  return (
                    <Fragment key={school.schoolId}>
                      <tr
                        className="cursor-pointer border-t border-slate-200 bg-white font-semibold hover:bg-slate-50"
                        onClick={() =>
                          setOpenSchools((set) => toggle(set, school.schoolId))
                        }
                      >
                        <td className={cell}>
                          <span className="flex items-center gap-1 text-slate-800">
                            {schoolOpen ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            {school.schoolName}
                          </span>
                        </td>
                        <td className={numCell}>{school.teacherCount}</td>
                        <td className={numCell}>{school.presentSessions}</td>
                        <td className={numCell}>{school.payablePeriods}</td>
                        <td className={numCell}>
                          {formatPayrollMoney(school.teachingAmount)}
                        </td>
                        <td className={numCell}>
                          {formatPayrollMoney(school.otherCostsAmount)}
                        </td>
                        <td className={`${numCell} text-indigo-700`}>
                          {formatPayrollMoney(school.totalAmount)}
                        </td>
                        <td className={cell}>
                          <WarningText row={school} />
                        </td>
                      </tr>

                      {schoolOpen &&
                        school.subjects.map((subject) => {
                          const key = `${school.schoolId}-${subject.subjectId}`;
                          const subjectOpen = openSubjects.has(key);
                          return (
                            <Fragment key={key}>
                              <tr
                                className="cursor-pointer border-t border-slate-100 bg-indigo-50/50 hover:bg-indigo-50"
                                onClick={() =>
                                  setOpenSubjects((set) => toggle(set, key))
                                }
                              >
                                <td className={`${cell} pl-9`}>
                                  <span className="flex items-center gap-1 text-indigo-900">
                                    {subjectOpen ? (
                                      <ChevronDown size={15} />
                                    ) : (
                                      <ChevronRight size={15} />
                                    )}
                                    {subjectLabel(subject)}
                                  </span>
                                </td>
                                <td className={numCell}>
                                  {subject.teacherCount}
                                </td>
                                <td className={numCell}>
                                  {subject.presentSessions}
                                </td>
                                <td className={numCell}>
                                  {subject.payablePeriods}
                                </td>
                                <td className={numCell}>
                                  {formatPayrollMoney(subject.teachingAmount)}
                                </td>
                                <td className={numCell}>
                                  {formatPayrollMoney(subject.otherCostsAmount)}
                                </td>
                                <td className={`${numCell} font-semibold`}>
                                  {formatPayrollMoney(subject.totalAmount)}
                                </td>
                                <td className={cell}>
                                  <WarningText row={subject} />
                                </td>
                              </tr>
                              {subjectOpen && (
                                <tr className="border-t border-slate-100">
                                  <td colSpan={8} className="bg-slate-50 px-6 py-3">
                                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                      <TeacherPayrollTable
                                        teachers={subject.teachers}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
                {!schools.length && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      {keyword
                        ? "Không có trường nào khớp từ khoá."
                        : `Không có buổi dạy nào của giáo viên cộng tác viên trong ${periodText}.`}
                    </td>
                  </tr>
                )}
              </tbody>
              {data.schools.length > 0 && !keyword && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <tr>
                    <td className={cell}>Tổng cộng</td>
                    <td className={numCell}>{data.grandTotal.teacherCount}</td>
                    <td className={numCell}>
                      {data.grandTotal.presentSessions}
                    </td>
                    <td className={numCell}>
                      {data.grandTotal.payablePeriods}
                    </td>
                    <td className={numCell}>
                      {formatPayrollMoney(data.grandTotal.teachingAmount)}
                    </td>
                    <td className={numCell}>
                      {formatPayrollMoney(data.grandTotal.otherCostsAmount)}
                    </td>
                    <td className={`${numCell} text-indigo-700`}>
                      {formatPayrollMoney(data.grandTotal.totalAmount)}
                    </td>
                    <td className={cell} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
