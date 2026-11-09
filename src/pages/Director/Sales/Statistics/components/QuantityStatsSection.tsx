import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Table2,
} from "lucide-react";
import {
  buildSchoolQuantitySummary,
  type PolicyRef,
  type QuantityCell,
  type SchoolQuantitySummary,
} from "../quantityStats";
import { getPeriodLabel } from "../expenseStats";
import {
  useSelectedPeriod,
  useSheetSummaries,
} from "../hooks/useSheetSummaries";
import PolicyDetailModal from "./PolicyDetailModal";
import AccountingSourceModal from "./AccountingSourceModal";

type Props = {
  /** Chính sách đã duyệt theo bộ lọc trang. */
  policies: any[];
  /** Được đọc số liệu QL thu chi (Kế toán nhập). */
  accountingAvailable?: boolean;
  subjectId?: number | null;
  /** Năm học đang lọc ở trang ("" = mọi năm học). */
  schoolYear?: string;
  /** Kỳ thu chi đang chọn ở bộ lọc trang. */
  period?: any | null;
  /** Hiện nút mở chi tiết chính sách (màn quản lý). */
  canOpenPolicy?: boolean;
  /** Đóng popup chính sách — trang tải lại chính sách (có thể vừa duyệt/sửa). */
  onPolicyClosed?: () => void;
};

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatDifference = (value: number) =>
  `${value > 0 ? "+" : ""}${formatQuantity(value)}`;

const ACCOUNTING_COLUMNS = [
  { key: "revenue", label: "HS Doanh Thu", className: "text-emerald-700" },
  { key: "invoice", label: "HS Hóa Đơn", className: "text-cyan-700" },
  { key: "school", label: "HS Chi Trường", className: "text-violet-700" },
  { key: "management", label: "HS Chi Ngoài", className: "text-fuchsia-700" },
] as const;

export default function QuantityStatsSection({
  policies,
  accountingAvailable = true,
  subjectId,
  schoolYear = "",
  period,
  canOpenPolicy = false,
  onPolicyClosed,
}: Props) {
  const selectedPeriod = useSelectedPeriod(period);
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [sourceModal, setSourceModal] = useState<{
    row: SchoolQuantitySummary;
    subjectId?: number;
  } | null>(null);
  const [policyModal, setPolicyModal] = useState<{
    schoolName: string;
    policies: PolicyRef[];
    initialPolicyId?: number;
  } | null>(null);

  const accounting = useSheetSummaries({
    enabled: accountingAvailable,
    schoolIds: policies.map((policy: any) => Number(policy?.schoolId || 0)),
    schoolYear,
    selectedPeriod,
    subjectId,
    reloadKey,
  });

  const rows = useMemo(
    () =>
      buildSchoolQuantitySummary(policies, accounting.sheets, {
        schoolYear,
        selectedPeriod,
      }),
    [accounting.sheets, policies, schoolYear, selectedPeriod],
  );

  const canShowAccounting = accountingAvailable && !accounting.error;
  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          policyStudents: result.policyStudents + row.policyStudents,
          policyPeriods: result.policyPeriods + row.policyPeriods,
          revenue: result.revenue + row.tables.revenue.students,
          invoice: result.invoice + row.tables.invoice.students,
          school: result.school + row.tables.school.students,
          management: result.management + row.tables.management.students,
          accountingPeriods: result.accountingPeriods + row.accountingPeriods,
        }),
        {
          policyStudents: 0,
          policyPeriods: 0,
          revenue: 0,
          invoice: 0,
          school: 0,
          management: 0,
          accountingPeriods: 0,
        },
      ),
    [rows],
  );

  const allSchoolIds = rows.map((row) => row.schoolId);
  const allExpanded =
    allSchoolIds.length > 0 && allSchoolIds.every((id) => expanded.has(id));
  const toggleSchool = (schoolId: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });

  const accountingValue = (value: number) =>
    canShowAccounting ? formatQuantity(value) : "—";

  const openPolicies = (
    row: SchoolQuantitySummary,
    initialPolicyId?: number,
  ) =>
    setPolicyModal({
      schoolName: row.schoolName,
      policies: row.policies,
      initialPolicyId,
    });

  const policyButton = (
    row: SchoolQuantitySummary,
    policyIds: PolicyRef[],
    initialPolicyId?: number,
  ) =>
    canOpenPolicy && policyIds.length > 0 ? (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openPolicies(row, initialPolicyId);
        }}
        title="Xem chi tiết chính sách"
        className="ml-2 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-0.5 align-middle text-sm font-bold text-blue-700 transition hover:bg-blue-50"
      >
        <FileText size={14} />
        Chi tiết
      </button>
    ) : null;

  const sourceButton = (row: SchoolQuantitySummary, subjectId?: number) => {
    const subjects =
      subjectId === undefined
        ? row.subjects
        : row.subjects.filter((subject) => subject.subjectId === subjectId);
    if (
      !canShowAccounting ||
      !subjects.some((subject) => subject.sources.length > 0)
    ) {
      return <span className="text-slate-300">—</span>;
    }
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setSourceModal({ row, subjectId });
        }}
        title="Xem các dòng Doanh Thu / Hóa Đơn / Chi Trường / Chi Ngoài đã dùng"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
      >
        <Table2 size={14} />
        Chi tiết
      </button>
    );
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">
            Tổng hợp theo trường
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
            <GraduationCap size={23} />
            Số học sinh / số tiết
          </h2>
          <p className="mt-1 text-base text-blue-100">
            Đối chiếu số liệu kinh doanh khai trong chính sách và số liệu kế
            toán nhập ở QL thu chi
            {schoolYear ? ` · Năm học ${schoolYear}` : " · Mọi năm học"}
            {selectedPeriod ? ` · Kỳ ${getPeriodLabel(selectedPeriod)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/15 px-5 py-2 text-center backdrop-blur">
            <p className="text-sm text-blue-100">Trường</p>
            <p className="text-3xl font-black">{rows.length}</p>
          </div>
          {accountingAvailable && (
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={accounting.loading}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={accounting.loading ? "animate-spin" : ""}
              />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {accounting.loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-base font-semibold text-slate-500">
          <Loader2 size={20} className="animate-spin text-blue-600" />
          Đang tải số liệu kế toán
          {accounting.progress?.total
            ? ` (${accounting.progress.done}/${accounting.progress.total} bảng)...`
            : "..."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            <SummaryCard
              icon={<GraduationCap size={18} />}
              label="HS kinh doanh"
              value={formatQuantity(totals.policyStudents)}
              className="bg-blue-50 text-blue-700"
            />
            <SummaryCard
              icon={<Clock3 size={18} />}
              label="Tiết kinh doanh"
              value={formatQuantity(totals.policyPeriods)}
              className="bg-indigo-50 text-indigo-700"
            />
            <SummaryCard
              icon={<Calculator size={18} />}
              label="HS Doanh Thu"
              value={accountingValue(totals.revenue)}
              className="bg-emerald-50 text-emerald-700"
            />
            <SummaryCard
              icon={<Clock3 size={18} />}
              label="Tiết kế toán"
              value={accountingValue(totals.accountingPeriods)}
              className="bg-teal-50 text-teal-700"
            />
            <SummaryCard
              icon={<ReceiptText size={18} />}
              label="HS Hóa Đơn"
              value={accountingValue(totals.invoice)}
              className="bg-cyan-50 text-cyan-700"
            />
            <SummaryCard
              icon={<Building2 size={18} />}
              label="HS Chi Trường"
              value={accountingValue(totals.school)}
              className="bg-violet-50 text-violet-700"
            />
            <SummaryCard
              icon={<Landmark size={18} />}
              label="HS Chi Ngoài"
              value={accountingValue(totals.management)}
              className="bg-fuchsia-50 text-fuchsia-700"
            />
          </div>

          {accountingAvailable ? (
            <p className="mx-4 mb-4 rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-600">
              Số kế toán của mỗi môn lấy ở{" "}
              <strong>kỳ mới nhất có dòng nhập</strong>
              {selectedPeriod ? " (đúng kỳ đang chọn)" : " trong năm học"}, không
              cộng dồn các tháng. HS Hóa Đơn chỉ tính dòng đã xuất hóa đơn (Xuất
              HĐ Cty / Xuất HĐ HS / Khác). Chênh lệch = HS Doanh Thu − HS kinh
              doanh. Bấm vào trường để xem từng môn và kỳ đã lấy số.
            </p>
          ) : (
            <p className="mx-4 mb-4 rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-700">
              Tài khoản hiện tại không có quyền xem số liệu kế toán.
            </p>
          )}

          {accounting.error && (
            <p className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              {accounting.error}
            </p>
          )}
          {accounting.failedCount > 0 && (
            <p className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-800">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              Không tải được {accounting.failedCount} bảng thu chi, số kế toán
              chưa gồm các bảng đó. Bấm Làm mới để thử lại.
            </p>
          )}

          {rows.length > 0 ? (
            <>
              <div className="flex justify-end border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(allExpanded ? new Set() : new Set(allSchoolIds))
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {allExpanded ? "Thu gọn tất cả" : "Mở tất cả theo môn"}
                </button>
              </div>
              <div className="overflow-x-auto border-t border-slate-100 [&_table]:text-xl [&_table]:leading-8 [&_th]:!px-5 [&_th]:!py-4 [&_th]:!text-xl [&_td]:!px-5 [&_td]:!py-4 [&_td]:!text-xl">
                <table className="w-full min-w-[1960px]">
                  <thead>
                    <HeaderRows />
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const isOpen = expanded.has(row.schoolId);
                      const Chevron = isOpen ? ChevronDown : ChevronRight;
                      return (
                        <Fragment key={row.schoolId}>
                          <tr
                            onClick={() => toggleSchool(row.schoolId)}
                            className="cursor-pointer transition hover:bg-blue-50/50"
                          >
                            <td className="bg-white px-4 py-3 font-bold text-slate-800 sm:sticky sm:left-0 sm:z-10">
                              <span className="flex items-center gap-2">
                                <Chevron
                                  size={20}
                                  className="shrink-0 text-blue-600"
                                />
                                <span>
                                  {row.schoolName}
                                  <span className="ml-2 text-base font-semibold text-slate-400">
                                    ({row.subjects.length} môn)
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-blue-700">
                              {formatQuantity(row.policyStudents)}
                              {policyButton(row, row.policies)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                              {formatQuantity(row.policyPeriods)}
                            </td>
                            {ACCOUNTING_COLUMNS.map((column) => (
                              <td
                                key={column.key}
                                className={`px-4 py-3 text-right font-semibold ${column.className}`}
                              >
                                {accountingValue(
                                  row.tables[column.key].students,
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right font-semibold text-teal-700">
                              {accountingValue(row.accountingPeriods)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {sourceButton(row)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-amber-700">
                              {canShowAccounting
                                ? formatDifference(
                                    row.accountingStudents - row.policyStudents,
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-amber-700">
                              {canShowAccounting
                                ? formatDifference(
                                    row.accountingPeriods - row.policyPeriods,
                                  )
                                : "—"}
                            </td>
                          </tr>
                          {isOpen &&
                            row.subjects.map((subject) => (
                              <tr
                                key={`${row.schoolId}-${subject.subjectId}`}
                                className="bg-slate-50/70"
                              >
                                <td className="bg-slate-50 px-4 py-3 text-slate-700 sm:sticky sm:left-0 sm:z-10">
                                  <span className="ml-7 mr-2 text-blue-400">
                                    └
                                  </span>
                                  {subject.subjectName}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-blue-700">
                                  {formatQuantity(subject.policyStudents)}
                                  {policyButton(
                                    row,
                                    subject.policies,
                                    subject.policies[0]?.policyId,
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-700">
                                  {formatQuantity(subject.policyPeriods)}
                                </td>
                                {ACCOUNTING_COLUMNS.map((column) => (
                                  <td
                                    key={column.key}
                                    className={`px-4 py-3 text-right ${column.className}`}
                                  >
                                    <CellWithPeriod
                                      cell={subject.tables[column.key]}
                                      value="students"
                                      visible={canShowAccounting}
                                    />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-teal-700">
                                  <CellWithPeriod
                                    cell={subject.tables.revenue}
                                    value="periods"
                                    visible={canShowAccounting}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {sourceButton(row, subject.subjectId)}
                                </td>
                                <td className="px-4 py-3 text-right text-amber-700">
                                  {canShowAccounting
                                    ? formatDifference(
                                        subject.tables.revenue.students -
                                          subject.policyStudents,
                                      )
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-right text-amber-700">
                                  {canShowAccounting
                                    ? formatDifference(
                                        subject.tables.revenue.periods -
                                          subject.policyPeriods,
                                      )
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black text-slate-800">
                    <tr>
                      <td className="bg-slate-100 px-4 py-3 sm:sticky sm:left-0 sm:z-10">
                        Tổng cộng
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatQuantity(totals.policyStudents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatQuantity(totals.policyPeriods)}
                      </td>
                      {ACCOUNTING_COLUMNS.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-right">
                          {accountingValue(totals[column.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        {accountingValue(totals.accountingPeriods)}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right">
                        {canShowAccounting
                          ? formatDifference(
                              totals.revenue - totals.policyStudents,
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canShowAccounting
                          ? formatDifference(
                              totals.accountingPeriods - totals.policyPeriods,
                            )
                          : "—"}
                      </td>
                    </tr>
                    <HeaderRows />
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-base text-slate-500">
              Không có dữ liệu phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </>
      )}

      {sourceModal && (
        <AccountingSourceModal
          schoolName={sourceModal.row.schoolName}
          subjects={sourceModal.row.subjects}
          initialSubjectId={sourceModal.subjectId}
          onClose={() => setSourceModal(null)}
        />
      )}

      {policyModal && (
        <PolicyDetailModal
          schoolName={policyModal.schoolName}
          policies={policyModal.policies}
          initialPolicyId={policyModal.initialPolicyId}
          onClose={() => {
            setPolicyModal(null);
            onPolicyClosed?.();
          }}
        />
      )}
    </section>
  );
}

/** Hai dòng tiêu đề cột — dùng ở đầu bảng và lặp lại ở cuối bảng. */
function HeaderRows() {
  return (
    <>
      <tr className="bg-slate-900 text-white">
        <th
          rowSpan={2}
          className="min-w-[240px] bg-slate-900 px-4 py-3 text-left sm:sticky sm:left-0 sm:z-10 sm:min-w-[320px]"
        >
          Trường / Môn
        </th>
        <th
          colSpan={2}
          className="border-l border-slate-700 px-4 py-2 text-center"
        >
          Kinh doanh nhập
        </th>
        <th
          colSpan={ACCOUNTING_COLUMNS.length + 2}
          className="border-l border-slate-700 px-4 py-2 text-center"
        >
          Kế toán nhập
        </th>
        <th
          colSpan={2}
          className="border-l border-slate-700 px-4 py-2 text-center"
        >
          Chênh lệch
        </th>
      </tr>
      <tr className="bg-slate-900 text-xl text-slate-200">
        <th className="whitespace-nowrap border-l border-slate-700 px-4 py-2 text-right">
          Học sinh
        </th>
        <th className="whitespace-nowrap px-4 py-2 text-right">Số tiết</th>
        {ACCOUNTING_COLUMNS.map((column, index) => (
          <th
            key={column.key}
            className={`whitespace-nowrap px-4 py-2 text-right ${
              index === 0 ? "border-l border-slate-700" : ""
            }`}
          >
            {column.label}
          </th>
        ))}
        <th className="whitespace-nowrap px-4 py-2 text-right">Số tiết</th>
        <th className="whitespace-nowrap px-4 py-2 text-center">Bảng nguồn</th>
        <th className="whitespace-nowrap border-l border-slate-700 px-4 py-2 text-right">
          Học sinh
        </th>
        <th className="whitespace-nowrap px-4 py-2 text-right">Số tiết</th>
      </tr>
    </>
  );
}

/** Số của một bảng + kỳ đã lấy số (dòng môn). */
function CellWithPeriod({
  cell,
  value,
  visible,
}: {
  cell: QuantityCell;
  value: "students" | "periods";
  visible: boolean;
}) {
  if (!visible) return <>—</>;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{formatQuantity(cell[value])}</span>
      <span className="mt-1 whitespace-nowrap text-sm font-semibold text-slate-400">
        {cell.period ? getPeriodLabel(cell.period) : "chưa nhập"}
      </span>
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-bold uppercase">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
