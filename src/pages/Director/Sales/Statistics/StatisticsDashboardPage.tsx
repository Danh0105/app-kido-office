import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from "lucide-react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { employeeApi } from "@/service/employee";
import { expensePeriodApi } from "@/service/expensePeriod";
import { usePolicyStats } from "./hooks/usePolicyStats";
import PolicyPopup from "./components/PolicyPopup";
import QuantityStatsSection from "./components/QuantityStatsSection";
import ExpenseStatsSection from "./components/ExpenseStatsSection";
import DashboardOverview from "./components/DashboardOverview";
import DeviceAnalytics from "./components/DeviceAnalytics";
import PolicyAnalytics from "./components/PolicyAnalytics";
import {
  buildStatisticsDashboardModel,
  filterStatisticsPolicies,
  getCompanyUnit,
  getPolicyData,
  hasContract,
  numberValue,
  type DashboardFilters,
  type StatisticsPolicy,
} from "./statisticsDashboard";
import {
  DEFAULT_SCHOOL_YEAR,
  includeDefaultSchoolYear,
} from "@/constants/schoolYear";

type DashboardSection =
  | "overview"
  | "quantities"
  | "devices"
  | "finance"
  | "policies";

type Props = {
  employeeId?: number;
  showExpenses?: boolean;
  /** Xem được toàn bộ nhân viên, tách khỏi quyền xem thu chi. */
  directorView?: boolean;
};

const EMPTY_FILTERS: DashboardFilters = {
  keyword: "",
  provinceId: null,
  wardId: null,
  schoolId: null,
  subjectId: null,
  schoolYear: DEFAULT_SCHOOL_YEAR,
};

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);

export default function StatisticsDashboardPage({
  employeeId: employeeIdProp,
  showExpenses = true,
  directorView,
}: Props = {}) {
  const { employeeId: routeEmployeeId } = useParams();
  const initialEmployeeId = Number(employeeIdProp ?? routeEmployeeId) || 0;
  const isDirectorView = directorView ?? showExpenses;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    initialEmployeeId
  );
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [openPolicy, setOpenPolicy] = useState<StatisticsPolicy | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [salesEmployees, setSalesEmployees] = useState<
    Array<{ id: number; name?: string }>
  >([]);
  const [expensePeriods, setExpensePeriods] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const employeeId = isDirectorView
    ? selectedEmployeeId || undefined
    : initialEmployeeId || undefined;
  const query = usePolicyStats({ employeeId, fromDate: "", toDate: "" });
  const policies = Array.isArray(query.data) ? query.data : [];

  useEffect(() => {
    if (isDirectorView) setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId, isDirectorView]);

  useEffect(() => {
    if (query.data) setLastUpdated(new Date());
  }, [query.data]);

  useEffect(() => {
    let active = true;
    if (!employeeId) {
      setEmployeeName(isDirectorView ? "Tất cả nhân viên" : "");
      return;
    }
    employeeApi
      .getById(employeeId)
      .then((employee) => {
        if (active) setEmployeeName(employee?.name || "");
      })
      .catch(() => {
        if (active) setEmployeeName("");
      });
    return () => {
      active = false;
    };
  }, [employeeId, isDirectorView]);

  useEffect(() => {
    if (!isDirectorView) return;
    let active = true;
    employeeApi
      .getSales()
      .then((employees) => {
        if (active) setSalesEmployees(Array.isArray(employees) ? employees : []);
      })
      .catch(() => {
        if (active) setSalesEmployees([]);
      });
    return () => {
      active = false;
    };
  }, [isDirectorView]);

  useEffect(() => {
    if (!showExpenses) return;
    let active = true;
    expensePeriodApi
      .getAll()
      .then((rows) => {
        if (active) setExpensePeriods(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setExpensePeriods([]);
      });
    return () => {
      active = false;
    };
  }, [showExpenses]);

  const filteredPolicies = useMemo(
    () => filterStatisticsPolicies(policies, filters),
    [filters, policies]
  );
  const selectedExpensePeriod = useMemo(
    () =>
      expensePeriods.find(
        (period: any) => Number(period.id) === selectedPeriodId
      ) || null,
    [expensePeriods, selectedPeriodId]
  );
  const model = useMemo(
    () => buildStatisticsDashboardModel(filteredPolicies),
    [filteredPolicies]
  );

  const options = useMemo(() => {
    const provinces = new Map<number, string>();
    const wards = new Map<number, string>();
    const schools = new Map<number, string>();
    const subjects = new Map<number, string>();
    const years = new Set<string>();

    policies.forEach((policy: any) => {
      const provinceId = numberValue(policy.provinceId);
      const wardId = numberValue(policy.wardId);
      const schoolId = numberValue(policy.schoolId);
      const subjectId = numberValue(policy.subjectId);
      if (provinceId)
        provinces.set(provinceId, policy.provinceName || `Tỉnh #${provinceId}`);
      if (
        (!filters.provinceId || provinceId === filters.provinceId) &&
        wardId
      ) {
        wards.set(wardId, policy.wardName || `Xã/Phường #${wardId}`);
      }
      if (
        (!filters.provinceId || provinceId === filters.provinceId) &&
        (!filters.wardId || wardId === filters.wardId) &&
        schoolId
      ) {
        schools.set(schoolId, policy.schoolName || `Trường #${schoolId}`);
      }
      if (subjectId)
        subjects.set(subjectId, policy.subjectName || `Môn #${subjectId}`);
      if (policy.schoolYear) years.add(policy.schoolYear);
    });

    const mapRows = (map: Map<number, string>) =>
      Array.from(map, ([id, name]) => ({ id, name })).sort((left, right) =>
        left.name.localeCompare(right.name, "vi")
      );

    return {
      provinces: mapRows(provinces),
      wards: mapRows(wards),
      schools: mapRows(schools),
      subjects: mapRows(subjects),
      years: includeDefaultSchoolYear(Array.from(years)).sort((left, right) =>
        right.localeCompare(left, "vi")
      ),
    };
  }, [filters.provinceId, filters.wardId, policies]);

  const activeFilterCount = [
    filters.keyword,
    isDirectorView && selectedEmployeeId,
    filters.provinceId,
    filters.wardId,
    filters.schoolId,
    filters.subjectId,
    filters.schoolYear,
    selectedPeriodId,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSelectedPeriodId(null);
    if (isDirectorView) setSelectedEmployeeId(0);
  };

  const exportCsv = () => {
    const headings = [
      "Nhân viên",
      "Trường",
      "Tỉnh/Thành",
      "Xã/Phường",
      "Môn học",
      "Năm học",
      "Số học sinh",
      "Số tiết",
      "Học phí",
      "Đơn giá CTY thu",
      "Hợp đồng",
    ];
    const escape = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filteredPolicies.map((policy: any) => {
      const data = getPolicyData(policy);
      return [
        policy.employeeName,
        policy.schoolName,
        policy.provinceName,
        policy.wardName,
        policy.subjectName,
        policy.schoolYear,
        numberValue(policy.studentCount),
        numberValue(policy.totalLessons),
        numberValue(data.fee),
        getCompanyUnit(policy),
        hasContract(policy) ? "Đã có" : "Còn thiếu",
      ]
        .map(escape)
        .join(",");
    });
    const blob = new Blob(
      [`\uFEFF${headings.map(escape).join(",")}\n${rows.join("\n")}`],
      {
        type: "text/csv;charset=utf-8",
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thong-ke-kinh-doanh-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sections = [
    { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { key: "quantities", label: "Học sinh & số tiết", icon: GraduationCap },
    { key: "devices", label: "Thiết bị", icon: Boxes },
    ...(showExpenses
      ? [{ key: "finance", label: "Thu chi", icon: WalletCards }]
      : []),
    { key: "policies", label: "Chi tiết chính sách", icon: FileSpreadsheet },
  ] as Array<{
    key: DashboardSection;
    label: string;
    icon: typeof LayoutDashboard;
  }>;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <HeaderWithBack title="Trung tâm thống kê" />

      <main className="mx-auto max-w-[1680px] px-3 pb-12 pt-[72px] sm:px-5 lg:px-7">
        <section className="relative overflow-hidden rounded-[28px] bg-[#071b33] px-5 py-6 text-white shadow-xl sm:px-7 lg:px-9 lg:py-8">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-100">
                  {isDirectorView ? "Executive analytics" : "Sales performance"}
                </span>
                {employeeName && (
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">
                    {employeeName}
                  </span>
                )}
              </div>
              <h1 className="mt-4 max-w-3xl text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                {isDirectorView
                  ? "Bức tranh điều hành kinh doanh"
                  : "Hiệu quả kinh doanh của tôi"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Theo dõi quy mô trường, chính sách, học sinh, số tiết, thiết bị
                {isDirectorView
                  ? ", thu chi và công nợ"
                  : " và mức độ hoàn thiện hồ sơ"}{" "}
                trên cùng một nguồn dữ liệu đã được duyệt.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cập nhật gần nhất
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {lastUpdated
                    ? formatDateTime(lastUpdated)
                    : "Đang tải dữ liệu"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={query.isFetching ? "animate-spin" : ""}
                />{" "}
                Làm mới
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!filteredPolicies.length}
                className="flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={17} /> Xuất CSV
              </button>
            </div>
          </div>
        </section>

        <section className="sticky top-[56px] z-30 mt-4 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-xl sm:p-4">
          {isDirectorView && (
            <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-blue-950">
                <UsersRound size={18} className="shrink-0 text-blue-700" />
                <span>Phạm vi nhân viên</span>
              </div>
              <div className="w-full sm:max-w-md">
                <FilterSelect
                  value={selectedEmployeeId || ""}
                  onChange={(value) => {
                    setSelectedEmployeeId(value ? Number(value) : 0);
                    setFilters(EMPTY_FILTERS);
                  }}
                  placeholder="Tất cả nhân viên"
                  options={salesEmployees
                    .map((employee) => ({
                      id: employee.id,
                      name: employee.name || `Nhân viên #${employee.id}`,
                    }))
                    .sort((left, right) =>
                      left.name.localeCompare(right.name, "vi")
                    )}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1 xl:max-w-[360px]">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="Tìm trường, môn, hợp đồng…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <FilterSelect
                value={filters.provinceId || ""}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    provinceId: value ? Number(value) : null,
                    wardId: null,
                    schoolId: null,
                  }))
                }
                placeholder="Tỉnh/Thành"
                options={options.provinces}
              />
              <FilterSelect
                value={filters.wardId || ""}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    wardId: value ? Number(value) : null,
                    schoolId: null,
                  }))
                }
                placeholder="Xã/Phường"
                options={options.wards}
              />
              <FilterSelect
                value={filters.schoolId || ""}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    schoolId: value ? Number(value) : null,
                  }))
                }
                placeholder="Trường học"
                options={options.schools}
              />
              <FilterSelect
                value={filters.subjectId || ""}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    subjectId: value ? Number(value) : null,
                  }))
                }
                placeholder="Môn học"
                options={options.subjects}
              />
              <FilterSelect
                value={filters.schoolYear}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, schoolYear: value }))
                }
                placeholder="Năm học"
                options={options.years.map((name) => ({ id: name, name }))}
              />
              {showExpenses && (
                <FilterSelect
                  value={selectedPeriodId || ""}
                  onChange={(value) =>
                    setSelectedPeriodId(value ? Number(value) : null)
                  }
                  placeholder="Kỳ thu chi"
                  options={expensePeriods.map((period: any) => ({
                    id: period.id,
                    name:
                      period.name ||
                      `${String(period.month).padStart(2, "0")}/${period.year}`,
                  }))}
                />
              )}
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <RotateCcw size={16} /> Xóa lọc{" "}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <Filter size={14} />
            Đang hiển thị{" "}
            <strong className="text-slate-800">
              {filteredPolicies.length}
            </strong>{" "}
            / {policies.length} chính sách đã duyệt
          </div>
        </section>

        <nav
          className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          aria-label="Nhóm báo cáo thống kê"
        >
          {sections.map((section) => {
            const Icon = section.icon;
            const selected = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  selected
                    ? "bg-slate-950 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon size={17} /> {section.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5">
          {query.isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <div className="text-center">
                <Loader2
                  size={36}
                  className="mx-auto animate-spin text-blue-600"
                />
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Đang tổng hợp dữ liệu thống kê…
                </p>
              </div>
            </div>
          ) : query.error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
              <BarChart3 size={40} className="mx-auto text-rose-500" />
              <h2 className="mt-3 text-xl font-black text-rose-900">
                Không thể tải dữ liệu thống kê
              </h2>
              <p className="mt-2 text-sm text-rose-700">
                Vui lòng làm mới hoặc kiểm tra lại quyền truy cập.
              </p>
            </div>
          ) : (
            <>
              {activeSection === "overview" && (
                <DashboardOverview
                  model={model}
                  isDirectorView={isDirectorView}
                  showEmployeeComparison={
                    isDirectorView && !selectedEmployeeId
                  }
                  onOpenPolicies={() => setActiveSection("policies")}
                />
              )}
              {activeSection === "quantities" && (
                <QuantityStatsSection
                  policies={filteredPolicies}
                  accountingAvailable={showExpenses}
                  subjectId={filters.subjectId}
                  schoolYear={filters.schoolYear}
                  period={selectedExpensePeriod}
                  canOpenPolicy={isDirectorView}
                  onPolicyClosed={() => query.refetch()}
                />
              )}
              {activeSection === "devices" && (
                <DeviceAnalytics devices={model.devices} />
              )}
              {activeSection === "finance" && showExpenses && (
                <ExpenseStatsSection
                  policies={filteredPolicies}
                  restrictToPolicySchools
                  subjectId={filters.subjectId}
                  employeeId={employeeId || undefined}
                  schoolYear={filters.schoolYear}
                  period={selectedExpensePeriod}
                />
              )}
              {activeSection === "policies" && (
                <PolicyAnalytics
                  policies={filteredPolicies}
                  onOpenPolicy={setOpenPolicy}
                />
              )}
            </>
          )}
        </div>
      </main>

      {query.isFetching && !query.isLoading && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">
          <Loader2 size={15} className="animate-spin" /> Đang cập nhật
        </div>
      )}
      {openPolicy && (
        <PolicyPopup data={openPolicy} onClose={() => setOpenPolicy(null)} />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ id: string | number; name: string }>;
}) {
  return (
    <label className="relative min-w-0">
      <SlidersHorizontal
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none truncate rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-7 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
