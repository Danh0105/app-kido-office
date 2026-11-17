import { useCallback, useEffect, useMemo, useState } from "react";

import ManagementExpenseStats from "@/pages/Director/expense/component/expense/ManagementExpenseStats";
import { invoiceCashAccountLabel } from "@/pages/Director/expense/RealExpenseDetail/utils/invoiceCashAccounts";
import { expenseRequestApi } from "@/service/expenseRequest";
import type {
  ManagementExpenseRow,
  ManagementExpenseSection,
} from "@/types/expenseRequest";
import { formatDate, formatDateTime } from "../lib";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const quantity = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
/** Số âm (đã chi vượt) hiện đỏ để người duyệt không bỏ sót. */
const remainingTone = (value: number) =>
  value < 0 ? "text-red-600" : "text-slate-800";

const quantityLabel = (row: ManagementExpenseRow) =>
  `${
    row.studentCount > 0
      ? `${quantity(row.studentCount)} HS`
      : `${quantity(row.totalPeriods)} tiết`
  } × ${quantity(row.monthsCount)} tháng`;

function Stat({
  label,
  value,
  tone = "text-slate-800",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 sm:block sm:py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`whitespace-nowrap text-sm font-bold ${tone}`}>
        {money(value)}
      </p>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="break-words text-xs font-medium text-slate-800">
        {children}
      </dd>
    </div>
  );
}

function RowCard({ row }: { row: ManagementExpenseRow }) {
  const account = invoiceCashAccountLabel(row.cashAccount);
  return (
    <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <p className="break-words text-sm font-semibold text-slate-800">
          {row.content || "(Không có nội dung)"}
        </p>
        <p className="text-xs text-slate-500">{quantityLabel(row)}</p>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-1.5">
        <Stat label="Chi ngoài" value={row.totalOutside} tone="text-red-700" />
        <Stat label="Đã chi" value={row.paidAmount} tone="text-emerald-700" />
        <Stat
          label="Còn chi"
          value={row.remaining}
          tone={remainingTone(row.remaining)}
        />
      </div>
      <details>
        <summary className="cursor-pointer select-none py-1 text-xs font-medium text-blue-600">
          Xem chi tiết
        </summary>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2">
          <Detail label="Đơn giá QL1">{money(row.ql1UnitPrice)}</Detail>
          <Detail label="Thuế QL1">{money(row.ql1Tax)}</Detail>
          <Detail label="Chi QL1">{money(row.ql1Expense)}</Detail>
          <Detail label="Đơn giá QL2">{money(row.ql2UnitPrice)}</Detail>
          <Detail label="Thuế QL2">{money(row.ql2Tax)}</Detail>
          <Detail label="Chi QL2">{money(row.ql2Expense)}</Detail>
          {row.otherCosts.map((cost) => (
            <Detail key={cost.key} label={cost.name}>
              {money(cost.unitPrice)} − {money(cost.tax)} ={" "}
              {money(cost.expense)}
            </Detail>
          ))}
          {row.paymentDate && (
            <Detail label="Ngày chi">{formatDate(row.paymentDate)}</Detail>
          )}
          {account && <Detail label="Nguồn chi">{account}</Detail>}
          {row.payer && <Detail label="Người chi">{row.payer}</Detail>}
          {row.note && <Detail label="Ghi chú">{row.note}</Detail>}
        </dl>
      </details>
    </article>
  );
}

const thBase = "border-b border-slate-200 bg-slate-800 px-2 py-2 font-semibold text-white";
const tdBase = "border-b border-slate-100 px-2 py-1.5 tabular-nums";
const tfBase = "border-t border-slate-300 bg-slate-100 px-2 py-2 font-bold tabular-nums";
const th = `${thBase} text-right`;
const thLeft = `${thBase} text-left`;
const td = `${tdBase} text-right`;
const tdLeft = `${tdBase} text-left`;
const tf = `${tfBase} text-right`;

function SectionTable({ section }: { section: ManagementExpenseSection }) {
  const { otherCostColumns, rows, totals } = section;
  const costOf = (row: ManagementExpenseRow, key: string) =>
    row.otherCosts.find((cost) => cost.key === key);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 whitespace-nowrap text-xs text-slate-700">
        <thead>
          <tr>
            <th className={`${thLeft} sticky left-0 z-10 min-w-[160px] max-w-[260px]`}>
              Nội dung
            </th>
            <th className={th}>Số tiết</th>
            <th className={th}>Số HS</th>
            <th className={th}>Số tháng</th>
            <th className={th}>Đơn giá QL1</th>
            <th className={th}>Thuế QL1</th>
            <th className={th}>Chi QL1</th>
            <th className={th}>Đơn giá QL2</th>
            <th className={th}>Thuế QL2</th>
            <th className={th}>Chi QL2</th>
            {otherCostColumns.flatMap((column) => [
              <th key={`${column.key}-unit`} className={th}>
                Đơn giá {column.name}
              </th>,
              <th key={`${column.key}-tax`} className={th}>
                Thuế {column.name}
              </th>,
              <th key={`${column.key}-expense`} className={th}>
                Chi {column.name}
              </th>,
            ])}
            <th className={th}>Chi ngoài</th>
            <th className={th}>Ngày chi</th>
            <th className={thLeft}>Nguồn chi</th>
            <th className={th}>Đã chi</th>
            <th className={th}>Còn chi</th>
            <th className={thLeft}>Người chi</th>
            <th className={thLeft}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowIndex}>
              <td className={`${tdLeft} sticky left-0 z-10 max-w-[260px] whitespace-normal break-words bg-white font-medium`}>
                {row.content || "(Không có nội dung)"}
              </td>
              <td className={td}>{quantity(row.totalPeriods)}</td>
              <td className={td}>{quantity(row.studentCount)}</td>
              <td className={td}>{quantity(row.monthsCount)}</td>
              <td className={td}>{money(row.ql1UnitPrice)}</td>
              <td className={td}>{money(row.ql1Tax)}</td>
              <td className={td}>{money(row.ql1Expense)}</td>
              <td className={td}>{money(row.ql2UnitPrice)}</td>
              <td className={td}>{money(row.ql2Tax)}</td>
              <td className={td}>{money(row.ql2Expense)}</td>
              {otherCostColumns.flatMap((column) => {
                const cost = costOf(row, column.key);
                return [
                  <td key={`${column.key}-unit`} className={td}>
                    {money(cost?.unitPrice ?? 0)}
                  </td>,
                  <td key={`${column.key}-tax`} className={td}>
                    {money(cost?.tax ?? 0)}
                  </td>,
                  <td key={`${column.key}-expense`} className={td}>
                    {money(cost?.expense ?? 0)}
                  </td>,
                ];
              })}
              <td className={`${td} font-bold text-red-700`}>
                {money(row.totalOutside)}
              </td>
              <td className={td}>{row.paymentDate ? formatDate(row.paymentDate) : ""}</td>
              <td className={tdLeft}>{invoiceCashAccountLabel(row.cashAccount)}</td>
              <td className={`${td} text-emerald-700`}>{money(row.paidAmount)}</td>
              <td className={`${td} font-semibold ${remainingTone(row.remaining)}`}>
                {money(row.remaining)}
              </td>
              <td className={tdLeft}>{row.payer}</td>
              <td className={`${tdLeft} min-w-[140px] max-w-[260px] whitespace-normal break-words`}>
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${tfBase} sticky left-0 z-10 text-left`}>Tổng cộng</td>
            <td className={tf} colSpan={5} />
            <td className={tf}>{money(totals.ql1Expense)}</td>
            <td className={tf} colSpan={2} />
            <td className={tf}>{money(totals.ql2Expense)}</td>
            {otherCostColumns.flatMap((column) => [
              <td key={`${column.key}-blank`} className={tf} colSpan={2} />,
              <td key={`${column.key}-expense`} className={tf}>
                {money(totals.otherCostExpenses[column.key] ?? 0)}
              </td>,
            ])}
            <td className={`${tf} text-red-700`}>{money(totals.totalOutside)}</td>
            <td className={tf} colSpan={2} />
            <td className={`${tf} text-emerald-700`}>{money(totals.paidAmount)}</td>
            <td className={`${tf} ${remainingTone(totals.remaining)}`}>
              {money(totals.remaining)}
            </td>
            <td className={tf} colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SectionBlock({
  section,
  showSchool = false,
  defaultOpen,
}: {
  section: ManagementExpenseSection;
  showSchool?: boolean;
  defaultOpen: boolean;
}) {
  const { totals } = section;
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <summary className="flex cursor-pointer select-none list-none items-start gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-[10px] leading-4 text-slate-400 transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-800">
              {showSchool && section.schoolName ? `${section.schoolName} · ` : ""}
              {section.periodName} · {section.subjectName}
            </span>
            {section.schoolYear && (
              <span className="text-xs text-slate-500">{section.schoolYear}</span>
            )}
            {section.confirmed && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Đã xác nhận BBCS
              </span>
            )}
            {section.finalized && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Kỳ đã kết thúc
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:max-w-md sm:grid-cols-3 sm:gap-1.5">
            <Stat label="Chi ngoài" value={totals.totalOutside} tone="text-red-700" />
            <Stat label="Đã chi" value={totals.paidAmount} tone="text-emerald-700" />
            <Stat
              label="Còn chi"
              value={totals.remaining}
              tone={remainingTone(totals.remaining)}
            />
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-100">
        <ManagementExpenseStats
          showTotals={false}
          ql1Expense={totals.ql1Expense}
          ql2Expense={totals.ql2Expense}
          otherCosts={section.otherCostColumns.map((column) => ({
            key: column.key,
            name: column.name,
            expense: totals.otherCostExpenses[column.key] ?? 0,
          }))}
          totalOutside={totals.totalOutside}
          paidAmount={totals.paidAmount}
          remaining={totals.remaining}
          rows={section.rows}
        />
      </div>
      <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-2 md:hidden">
        {section.rows.map((row) => (
          <RowCard key={row.rowIndex} row={row} />
        ))}
      </div>
      <div className="hidden border-t border-slate-100 md:block">
        <SectionTable section={section} />
      </div>
    </details>
  );
}

export function ManagementExpenseSections({
  sections,
  emptyText = "Chưa có Bảng Chi Ngoài cho đề xuất này.",
}: {
  sections: ManagementExpenseSection[];
  emptyText?: string;
}) {
  if (!sections.length) {
    return <p className="text-xs text-slate-500">{emptyText}</p>;
  }
  // Đề xuất chi tháng nhiều trường: tên trường đứng đầu mỗi bảng.
  const showSchool =
    new Set(sections.map((section) => section.schoolId ?? null)).size > 1;
  return (
    <div className="space-y-2">
      {sections.length > 1 && <SectionsOverview sections={sections} />}
      {sections.map((section, index) => (
        <SectionBlock
          key={`${section.schoolExpenseId}-${section.subjectId}`}
          section={section}
          showSchool={showSchool}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}

/** Thống kê cộng dồn khi đề xuất có nhiều bảng; Chi khác gộp theo tên. */
function SectionsOverview({ sections }: { sections: ManagementExpenseSection[] }) {
  const otherCosts = new Map<string, number>();
  const sum = (pick: (section: ManagementExpenseSection) => number) =>
    sections.reduce((total, section) => total + Number(pick(section) || 0), 0);
  for (const section of sections) {
    for (const column of section.otherCostColumns) {
      otherCosts.set(
        column.name,
        (otherCosts.get(column.name) ?? 0) +
          Number(section.totals.otherCostExpenses[column.key] ?? 0),
      );
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200">
      <p className="bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
        Tổng {sections.length} bảng
      </p>
      <ManagementExpenseStats
        ql1Expense={sum((section) => section.totals.ql1Expense)}
        ql2Expense={sum((section) => section.totals.ql2Expense)}
        otherCosts={[...otherCosts].map(([name, expense]) => ({
          key: name,
          name,
          expense,
        }))}
        totalOutside={sum((section) => section.totals.totalOutside)}
        paidAmount={sum((section) => section.totals.paidAmount)}
        remaining={sum((section) => section.totals.remaining)}
        rows={sections.flatMap((section) => section.rows)}
      />
    </div>
  );
}

/** Số liệu cho hộp duyệt chi tháng: tổng Còn chi + Còn chi từng dòng trường. */
export type MonthlyApprovalView = {
  remainingTotal: number;
  itemAmounts: Map<number, number>;
};

/** Tải số liệu đang có trong Quản lý thu chi. */
function LiveSections({
  requestId,
  onLoaded,
}: {
  requestId: number;
  onLoaded?: (view: MonthlyApprovalView | null) => void;
}) {
  const [sections, setSections] = useState<ManagementExpenseSection[] | null>(
    null
  );
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setSections(null);
    onLoaded?.(null);
    expenseRequestApi
      .getManagementExpense(requestId)
      .then((res) => {
        const list = res.sections ?? [];
        setSections(list);
        onLoaded?.({
          remainingTotal:
            res.remainingTotal ??
            list.reduce(
              (sum, section) => sum + Number(section.totals?.remaining || 0),
              0
            ),
          itemAmounts: new Map(
            (res.items ?? []).map((item) => [item.id, Number(item.amount)])
          ),
        });
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(load, [load]);

  if (failed) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-red-600">
        Không tải được Bảng Chi Ngoài.
        <button type="button" onClick={load} className="font-semibold underline">
          Thử lại
        </button>
      </div>
    );
  }
  if (!sections) {
    return <p className="text-xs text-slate-500">Đang tải Bảng Chi Ngoài…</p>;
  }
  return <ManagementExpenseSections sections={sections} />;
}

/** Khung ở màn duyệt: Giám đốc xem số liệu hiện tại trước khi quyết định. */
export function ManagementExpensePanel({
  requestId,
  monthly = false,
  onLoaded,
}: {
  requestId: number;
  /** Chi tháng: số tiền lệnh chi lấy theo tổng Còn chi khi duyệt. */
  monthly?: boolean;
  onLoaded?: (view: MonthlyApprovalView | null) => void;
}) {
  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-emerald-700">
          📊 Bảng Chi Ngoài
        </h3>
        <p className="text-xs text-slate-500">
          Số liệu hiện tại từ Quản lý thu chi, sẽ được lưu vào lịch sử khi bạn
          duyệt hoặc từ chối.
          {monthly &&
            " Chi tháng: khi bạn duyệt, lệnh chi được lập bằng tổng cột Còn chi của các bảng dưới đây."}
        </p>
      </div>
      <LiveSections requestId={requestId} onLoaded={onLoaded} />
    </div>
  );
}

/**
 * Nhánh trong cây lịch sử. Có `snapshot` thì hiện đúng số liệu lúc quyết định;
 * đề xuất duyệt trước khi có ảnh chụp thì tải số liệu hiện tại và ghi rõ.
 */
export function ManagementExpenseHistory({
  requestId,
  snapshot,
  rejected,
}: {
  requestId: number;
  snapshot?: { capturedAt?: string; sections?: ManagementExpenseSection[] };
  rejected: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const total = useMemo(
    () =>
      (snapshot?.sections ?? []).reduce(
        (sum, section) => sum + Number(section.totals?.totalOutside || 0),
        0
      ),
    [snapshot]
  );
  return (
    <details
      className="mt-1.5 min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/50"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-emerald-800">
        📊 Bảng Chi Ngoài {snapshot ? `lúc ${rejected ? "từ chối" : "duyệt"}` : "(số liệu hiện tại)"}
        {snapshot && total > 0 && (
          <span className="ml-1 font-normal text-slate-600">· {money(total)} đ</span>
        )}
      </summary>
      {opened && (
        <div className="space-y-1.5 px-2 pb-2">
          {snapshot ? (
            <>
              {snapshot.capturedAt && (
                <p className="text-[11px] text-slate-500">
                  Ảnh chụp lúc {formatDateTime(snapshot.capturedAt)}
                </p>
              )}
              <ManagementExpenseSections
                sections={snapshot.sections ?? []}
                emptyText="Lúc này chưa có Bảng Chi Ngoài."
              />
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                Đề xuất này được xử lý trước khi hệ thống lưu ảnh chụp, đây là
                số liệu hiện tại, không phải số liệu lúc đó.
              </p>
              <LiveSections requestId={requestId} />
            </>
          )}
        </div>
      )}
    </details>
  );
}
