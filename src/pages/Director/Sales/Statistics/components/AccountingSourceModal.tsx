import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Building2, Calculator, Landmark, ReceiptText, X } from "lucide-react";
import { calculateRevenueQuantity } from "@/utils/revenueAmount";
import { getPeriodLabel } from "../expenseStats";
import {
  QUANTITY_TABLES,
  type QuantityTableKey,
  type SourceRow,
  type SubjectQuantity,
} from "../quantityStats";

type Props = {
  schoolName: string;
  subjects: SubjectQuantity[];
  /** Mở sẵn một môn; không truyền thì xem mọi môn của trường. */
  initialSubjectId?: number;
  onClose: () => void;
};

type Column = {
  label: string;
  align?: "right";
  render: (row: SourceRow) => ReactNode;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatQuantity = (value: unknown) =>
  num(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const formatMoney = (value: unknown) =>
  num(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const formatDate = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("vi-VN");
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  company: "Xuất HĐ Cty",
  student: "Xuất HĐ HS",
  none: "Không xuất HĐ",
  other: "Khác",
};
const invoiceTypeLabel = (item: any) => {
  const type = item?.invoiceType || (item?.invoiced ? "company" : "");
  if (!type) return "Chưa chọn";
  const label = INVOICE_TYPE_LABELS[type] || type;
  return type === "other" && item?.invoiceOther
    ? `${label}: ${item.invoiceOther}`
    : label;
};

const TABLE_META: Record<
  QuantityTableKey,
  { icon: typeof Calculator; tone: string; note: string; columns: Column[] }
> = {
  revenue: {
    icon: Calculator,
    tone: "text-emerald-700 bg-emerald-50",
    note: "Mọi dòng Doanh Thu của kỳ được dùng.",
    columns: [
      { label: "Nội dung", render: (row) => row.item?.content || "—" },
      {
        label: "Đơn giá",
        align: "right",
        render: (row) => formatMoney(row.item?.unitPrice),
      },
      {
        label: "Thành tiền",
        align: "right",
        render: (row) => formatMoney(row.item?.invoiceAmount),
      },
      {
        label: "Đã thu",
        align: "right",
        render: (row) => formatMoney(row.item?.paidAmount),
      },
    ],
  },
  invoice: {
    icon: ReceiptText,
    tone: "text-cyan-700 bg-cyan-50",
    note: "Các dòng Doanh Thu; chỉ dòng Xuất HĐ Cty / Xuất HĐ HS / Khác được tính.",
    columns: [
      { label: "Nội dung", render: (row) => row.item?.content || "—" },
      { label: "Loại HĐ", render: (row) => invoiceTypeLabel(row.item) },
      { label: "Số HĐ", render: (row) => row.item?.invoiceNumber || "—" },
      { label: "Ngày HĐ", render: (row) => formatDate(row.item?.invoiceDate) },
      {
        label: "Số lượng HĐ",
        align: "right",
        render: (row) => formatQuantity(calculateRevenueQuantity(row.item || {})),
      },
    ],
  },
  school: {
    icon: Building2,
    tone: "text-violet-700 bg-violet-50",
    note: "Mọi dòng Chi Trường của kỳ được dùng.",
    columns: [
      {
        label: "Thành tiền",
        align: "right",
        render: (row) => formatMoney(row.item?.schoolExpenseAmount),
      },
      {
        label: "Đã chi",
        align: "right",
        render: (row) => formatMoney(row.item?.paidAmount),
      },
      { label: "Ghi chú", render: (row) => row.item?.note || "—" },
    ],
  },
  management: {
    icon: Landmark,
    tone: "text-fuchsia-700 bg-fuchsia-50",
    note: "Mọi dòng Chi Ngoài của kỳ được dùng.",
    columns: [
      {
        label: "Tổng chi ngoài",
        align: "right",
        render: (row) => formatMoney(row.item?.totalOutside),
      },
      {
        label: "Đã chi",
        align: "right",
        render: (row) => formatMoney(row.item?.paidAmount),
      },
      { label: "Ghi chú", render: (row) => row.item?.note || "—" },
    ],
  },
};

const statusOf = (row: SourceRow) => {
  if (!row.used) {
    // Dòng tuỳ chỉnh (tháng ảo > 12) chỉ dùng khi không có tháng thật nào có số.
    return {
      label: row.period.month > 12 ? "Dòng tuỳ chỉnh" : "Kỳ cũ hơn",
      className: "bg-slate-100 text-slate-500",
    };
  }
  if (!row.counted) {
    return { label: "Không tính", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Tính", className: "bg-emerald-50 text-emerald-700" };
};

/**
 * Popup "Bảng nguồn" của Kế toán nhập: các dòng QL thu chi (Doanh Thu, Hóa Đơn,
 * Chi Trường, Chi Ngoài) đã được đọc để ra số HS / số tiết của trường.
 */
export default function AccountingSourceModal({
  schoolName,
  subjects,
  initialSubjectId,
  onClose,
}: Props) {
  const [subjectFilter, setSubjectFilter] = useState<number | null>(
    initialSubjectId ?? null,
  );
  const [showOlder, setShowOlder] = useState(false);

  const visibleSubjects = useMemo(
    () =>
      subjectFilter === null
        ? subjects
        : subjects.filter((subject) => subject.subjectId === subjectFilter),
    [subjectFilter, subjects],
  );
  const subjectNames = useMemo(
    () => new Map(subjects.map((s) => [s.subjectId, s.subjectName])),
    [subjects],
  );
  const showSubjectColumn = visibleSubjects.length > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-emerald-800">
              Dữ liệu kế toán nhập — bảng nguồn
            </h2>
            <p className="truncate text-sm text-slate-500">{schoolName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          {subjects.length > 1 && (
            <FilterChip
              active={subjectFilter === null}
              onClick={() => setSubjectFilter(null)}
            >
              Tất cả môn
            </FilterChip>
          )}
          {subjects.map((subject) => (
            <FilterChip
              key={subject.subjectId}
              active={subjectFilter === subject.subjectId}
              onClick={() => setSubjectFilter(subject.subjectId)}
            >
              {subject.subjectName}
            </FilterChip>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={showOlder}
              onChange={(event) => setShowOlder(event.target.checked)}
            />
            Hiện cả các kỳ không dùng
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <p className="text-sm text-slate-500">
            Mỗi môn, mỗi bảng lấy <strong>kỳ mới nhất có số</strong> trong năm
            học / kỳ đang lọc. Số HS và số tiết trên bảng thống kê là tổng các
            dòng “Tính”.
          </p>

          {QUANTITY_TABLES.map(({ key, label }) => {
            const meta = TABLE_META[key];
            const Icon = meta.icon;
            const rows = visibleSubjects
              .flatMap((subject) => subject.sources)
              .filter((row) => row.table === key && (showOlder || row.used));
            const counted = rows.filter((row) => row.used && row.counted);
            const students = counted.reduce(
              (total, row) => total + num(row.item?.studentCount),
              0,
            );
            const periods = counted.reduce(
              (total, row) => total + num(row.item?.totalPeriods),
              0,
            );
            const periodsUsed = visibleSubjects
              .map((subject) => ({
                name: subject.subjectName,
                period: subject.tables[key].period,
              }))
              .filter((entry) => entry.period);

            return (
              <section
                key={key}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.tone}`}
                    >
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-slate-800">
                        {label}
                      </h3>
                      <p className="text-xs text-slate-500">{meta.note}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {formatQuantity(students)} HS · {formatQuantity(periods)}{" "}
                      tiết
                    </span>
                    {periodsUsed.map((entry) => (
                      <span
                        key={entry.name}
                        className="rounded-full bg-blue-50 px-3 py-1 text-blue-700"
                      >
                        {visibleSubjects.length > 1 ? `${entry.name}: ` : "Kỳ "}
                        {getPeriodLabel(entry.period!)}
                      </span>
                    ))}
                  </div>
                </div>

                {rows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          {showSubjectColumn && (
                            <th className="px-3 py-2 text-left">Môn</th>
                          )}
                          <th className="px-3 py-2 text-left">Kỳ</th>
                          <th className="px-3 py-2 text-right">Dòng</th>
                          <th className="px-3 py-2 text-right">Số HS</th>
                          <th className="px-3 py-2 text-right">Số tiết</th>
                          <th className="px-3 py-2 text-right">Số tháng</th>
                          {meta.columns.map((column) => (
                            <th
                              key={column.label}
                              className={`whitespace-nowrap px-3 py-2 ${
                                column.align === "right"
                                  ? "text-right"
                                  : "text-left"
                              }`}
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-center">
                            Trạng thái
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row) => {
                          const status = statusOf(row);
                          const muted = !row.used || !row.counted;
                          return (
                            <tr
                              key={`${row.subjectId}-${row.key}`}
                              className={muted ? "text-slate-400" : ""}
                            >
                              {showSubjectColumn && (
                                <td className="whitespace-nowrap px-3 py-2 font-semibold">
                                  {subjectNames.get(row.subjectId) || "—"}
                                </td>
                              )}
                              <td className="whitespace-nowrap px-3 py-2">
                                {getPeriodLabel(row.period)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {num(row.item?.rowIndex) + 1}
                              </td>
                              <td className="px-3 py-2 text-right font-bold">
                                {formatQuantity(row.item?.studentCount)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatQuantity(row.item?.totalPeriods)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatQuantity(row.item?.monthsCount)}
                              </td>
                              {meta.columns.map((column) => (
                                <td
                                  key={column.label}
                                  className={`px-3 py-2 ${
                                    column.align === "right"
                                      ? "whitespace-nowrap text-right"
                                      : "text-left"
                                  }`}
                                >
                                  {column.render(row)}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${status.className}`}
                                >
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    Chưa có dòng nào trong năm học / kỳ đang lọc.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
        active
          ? "bg-emerald-600 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}
