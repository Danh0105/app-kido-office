import type { ReactNode } from "react";

import { invoiceCashAccountLabel } from "@/pages/Director/expense/RealExpenseDetail/utils/invoiceCashAccounts";
import {
  CASHFLOW_ITEM_STATUS_META,
  CASHFLOW_SOURCE_META,
  type CashflowSheetResponse,
  type SchoolExpenseSheetRow,
  type SchoolTeacherSheetRow,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import { formatDate } from "../lib";
import { ManagementExpenseSections } from "./ManagementExpenseView";

const money = (value: number | null | undefined) =>
  `${formatVnd(Number(value ?? 0)) || "0"} đ`;
const qty = (value: number) => Number(value || 0).toLocaleString("vi-VN");

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  in_contract: "Có trong HĐ",
  not_in_contract: "Không có trong HĐ",
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white px-2.5 py-2 border border-slate-100">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${tone}`}>{money(value)}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-xs text-slate-800 break-words">{children}</dd>
    </div>
  );
}

const th = "border-b border-slate-200 bg-slate-800 px-2 py-2 text-right font-semibold text-white whitespace-nowrap";
const thLeft = th.replace("text-right", "text-left");
const td = "border-b border-slate-100 px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
const tdLeft = "border-b border-slate-100 px-2 py-1.5 text-left";

function PaymentTypeBadge({ row }: { row: SchoolExpenseSheetRow }) {
  if (!row.paymentType) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${
        row.inContract ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {PAYMENT_TYPE_LABEL[row.paymentType] ?? row.paymentType}
    </span>
  );
}

function SchoolExpenseRows({ rows }: { rows: SchoolExpenseSheetRow[] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            className={`rounded-xl border p-3 space-y-2 ${
              row.inContract ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-sm font-semibold text-slate-800">{row.subjectName || "—"}</span>
              <PaymentTypeBadge row={row} />
            </div>
            <p className="text-xs text-slate-500">
              {qty(row.totalPeriods)} tiết · {qty(row.studentCount)} HS · {qty(row.monthsCount)} tháng
            </p>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-500">
              <span>
                Tiền chi trường
                <br />
                <b className="text-slate-800">{money(row.schoolExpenseAmount)}</b>
              </span>
              <span>
                Đã chi
                <br />
                <b className="text-emerald-700">{money(row.paidAmount)}</b>
              </span>
              <span>
                Còn đề xuất
                <br />
                <b className="text-orange-600">{money(row.proposableAmount)}</b>
              </span>
            </div>
            <details>
              <summary className="cursor-pointer select-none text-xs font-medium text-blue-600">
                Xem chi tiết
              </summary>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Field label="ĐG giáo viên">{money(row.teacherUnitPrice)}</Field>
                <Field label="Tiền giáo viên">{money(row.teacherAmount)}</Field>
                <Field label="ĐG thuế">{money(row.taxUnitPrice)}</Field>
                <Field label="Tiền thuế">{money(row.taxAmount)}</Field>
                <Field label="ĐG CSVC">{money(row.csvcUnitPrice)}</Field>
                <Field label="Tiền CSVC">{money(row.csvcAmount)}</Field>
                <Field label="Ngày chi">{row.expenseDate ? formatDate(row.expenseDate) : "—"}</Field>
                <Field label="Nguồn chi">{invoiceCashAccountLabel(row.cashAccount) || "—"}</Field>
                <Field label="Còn lại (bảng)">{money(row.remaining)}</Field>
                <Field label="Người chi">{row.payer || "—"}</Field>
                {row.suggestCodes && <Field label="Theo đề xuất">{row.suggestCodes}</Field>}
                {row.note && <Field label="Ghi chú">{row.note}</Field>}
              </dl>
            </details>
          </article>
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1400px] text-xs">
          <thead>
            <tr>
              <th className={thLeft}>Môn</th>
              <th className={th}>Số tiết</th>
              <th className={th}>SL HS</th>
              <th className={th}>Số tháng</th>
              <th className={th}>ĐG GV</th>
              <th className={th}>ĐG thuế</th>
              <th className={th}>ĐG CSVC</th>
              <th className={th}>Tiền GV</th>
              <th className={th}>Tiền thuế</th>
              <th className={th}>Tiền CSVC</th>
              <th className={th}>Tiền chi trường</th>
              <th className={thLeft}>📑 Hình thức chi</th>
              <th className={thLeft}>Ngày chi</th>
              <th className={thLeft}>Nguồn chi</th>
              <th className={th}>Đã chi</th>
              <th className={th}>Còn lại</th>
              <th className={th}>Còn đề xuất</th>
              <th className={thLeft}>Người chi</th>
              <th className={thLeft}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.inContract ? "bg-emerald-50/50" : ""}>
                <td className={tdLeft}>{row.subjectName || "—"}</td>
                <td className={td}>{qty(row.totalPeriods)}</td>
                <td className={td}>{qty(row.studentCount)}</td>
                <td className={td}>{qty(row.monthsCount)}</td>
                <td className={td}>{money(row.teacherUnitPrice)}</td>
                <td className={td}>{money(row.taxUnitPrice)}</td>
                <td className={td}>{money(row.csvcUnitPrice)}</td>
                <td className={td}>{money(row.teacherAmount)}</td>
                <td className={td}>{money(row.taxAmount)}</td>
                <td className={td}>{money(row.csvcAmount)}</td>
                <td className={`${td} font-semibold`}>{money(row.schoolExpenseAmount)}</td>
                <td className={tdLeft}>
                  <PaymentTypeBadge row={row} />
                </td>
                <td className={tdLeft}>{row.expenseDate ? formatDate(row.expenseDate) : "—"}</td>
                <td className={tdLeft}>{invoiceCashAccountLabel(row.cashAccount) || "—"}</td>
                <td className={`${td} text-emerald-700`}>{money(row.paidAmount)}</td>
                <td className={td}>{money(row.remaining)}</td>
                <td className={`${td} font-semibold text-orange-600`}>{money(row.proposableAmount)}</td>
                <td className={tdLeft}>{row.payer || "—"}</td>
                <td className={tdLeft}>
                  {[row.note, row.suggestCodes ? `Theo ${row.suggestCodes}` : null].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SchoolTeacherRows({ rows }: { rows: SchoolTeacherSheetRow[] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-sm font-semibold text-slate-800">
                {row.teacherName || "Chưa chọn giáo viên"}
              </span>
              <span
                className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${
                  row.paid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {row.paid ? "Đã trả" : "Chưa trả"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {[row.subjectName, row.content].filter(Boolean).join(" · ") || "—"} · {qty(row.totalPeriods)} tiết ·{" "}
              {qty(row.studentCount)} HS · {qty(row.monthsCount)} tháng
            </p>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-500">
              <span>
                Thành tiền
                <br />
                <b className="text-slate-800">{money(row.amount)}</b>
              </span>
              <span>
                Thuế TNCN
                <br />
                <b className="text-slate-800">{money(row.pitAmount)}</b>
              </span>
              <span>
                Còn lại phải chi
                <br />
                <b className="text-orange-600">{money(row.netAmount)}</b>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Field label="Đơn giá">{money(row.unitPrice)}</Field>
              <Field label="% thuế">{qty(row.pitRate)}%</Field>
              <Field label="Ngày chi">{row.expenseDate ? formatDate(row.expenseDate) : "—"}</Field>
              <Field label="Nguồn chi">{invoiceCashAccountLabel(row.cashAccount) || "—"}</Field>
              {row.suggestCodes && <Field label="Theo đề xuất">{row.suggestCodes}</Field>}
              {row.note && <Field label="Ghi chú">{row.note}</Field>}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1200px] text-xs">
          <thead>
            <tr>
              <th className={thLeft}>Giáo viên</th>
              <th className={thLeft}>Môn</th>
              <th className={thLeft}>Nội dung</th>
              <th className={th}>Số tiết</th>
              <th className={th}>SL HS</th>
              <th className={th}>Số tháng</th>
              <th className={th}>Đơn giá</th>
              <th className={th}>Thành tiền</th>
              <th className={th}>% thuế</th>
              <th className={th}>Thuế TNCN</th>
              <th className={th}>Còn lại phải chi</th>
              <th className={thLeft}>Ngày chi</th>
              <th className={thLeft}>Nguồn chi</th>
              <th className={thLeft}>Trạng thái</th>
              <th className={thLeft}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={tdLeft}>{row.teacherName || <span className="text-amber-700">Chưa chọn</span>}</td>
                <td className={tdLeft}>{row.subjectName || "—"}</td>
                <td className={tdLeft}>{row.content || "—"}</td>
                <td className={td}>{qty(row.totalPeriods)}</td>
                <td className={td}>{qty(row.studentCount)}</td>
                <td className={td}>{qty(row.monthsCount)}</td>
                <td className={td}>{money(row.unitPrice)}</td>
                <td className={td}>{money(row.amount)}</td>
                <td className={td}>{qty(row.pitRate)}%</td>
                <td className={td}>{money(row.pitAmount)}</td>
                <td className={`${td} font-semibold`}>{money(row.netAmount)}</td>
                <td className={tdLeft}>{row.expenseDate ? formatDate(row.expenseDate) : "—"}</td>
                <td className={tdLeft}>{invoiceCashAccountLabel(row.cashAccount) || "—"}</td>
                <td className={tdLeft}>{row.paid ? "Đã trả" : "Chưa trả"}</td>
                <td className={tdLeft}>
                  {[row.note, row.suggestCodes ? `Theo ${row.suggestCodes}` : null].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Màn tạo Chi Ngoài / Chi Trường / Chi GV trường: toàn bộ số liệu Kế toán đã
 * nhập ở bảng nguồn của trường trong kỳ đã chọn (chỉ xem), cùng số còn đề xuất
 * được. Chi Trường: dòng Hình thức chi "Có trong HĐ" tính là đã chi.
 */
export default function CashflowSheetPreview({
  sheet,
  loading,
  error,
}: {
  sheet: CashflowSheetResponse | null;
  loading?: boolean;
  error?: string;
}) {
  if (loading) return <p className="text-xs text-gray-400">Đang tải số liệu QL thu chi…</p>;
  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!sheet) return null;

  const meta = CASHFLOW_SOURCE_META[sheet.source];
  const total = sheet.groups.reduce((sum, group) => sum + Number(group.totalAmount || 0), 0);
  const paid = sheet.groups.reduce((sum, group) => sum + Number(group.paidAmount || 0), 0);
  const unassignedRows = sheet.unassigned.reduce((sum, item) => sum + item.rowCount, 0);
  const periodName =
    sheet.period.name || `Tháng ${sheet.period.month}/${sheet.period.year}`;

  return (
    <section className="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div>
        <h3 className="text-sm font-semibold text-indigo-800">
          {meta.icon} Số liệu Kế toán đã nhập — bảng {sheet.table}
        </h3>
        <p className="text-xs text-slate-500">
          {sheet.school.name || "Trường"} · {periodName}. Chỉ xem; Kế toán chốt số
          tiền khi gửi Kế toán trưởng.
        </p>
      </div>

      {!sheet.hasData ? (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
          Bảng {sheet.table} của trường trong kỳ này chưa có số liệu — Kế toán sẽ
          nhập ở bước sau.
        </p>
      ) : (
        <div className={`grid gap-1.5 ${sheet.source === "SCHOOL_EXPENSE" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          <Stat label="Phải chi" value={total} tone="text-slate-800" />
          <Stat
            label={sheet.source === "SCHOOL_EXPENSE" ? "Đã chi (gồm Có trong HĐ)" : "Đã chi"}
            value={paid}
            tone="text-emerald-700"
          />
          {sheet.source === "SCHOOL_EXPENSE" && (
            <Stat label="Có trong HĐ (tính đã chi)" value={sheet.inContractTotal} tone="text-emerald-700" />
          )}
          <Stat label="Còn đề xuất được" value={sheet.proposableTotal} tone="text-orange-600" />
        </div>
      )}

      {sheet.openSheetRequest && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Bảng này đã có đề xuất{" "}
          <b>{sheet.openSheetRequest.code || `#${sheet.openSheetRequest.id}`}</b>{" "}
          đang chạy — chờ đề xuất đó xong mới đề xuất tiếp.
        </p>
      )}
      {sheet.hasData && !(sheet.proposableTotal > 0) && !sheet.openSheetRequest && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Bảng {sheet.table} không còn khoản nào cần đề xuất
          {sheet.inContractTotal > 0
            ? ' (dòng Hình thức chi "Có trong HĐ" đã tính là đã chi).'
            : " (đã chi đủ hoặc đang nằm trong đề xuất khác)."}
        </p>
      )}
      {unassignedRows > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Còn {unassignedRows} dòng chưa chọn giáo viên — Kế toán phải chọn trước
          khi gửi.
        </p>
      )}

      {sheet.groups.length > 0 && (
        <ul className="space-y-1">
          {sheet.groups.map((group) => {
            const status = CASHFLOW_ITEM_STATUS_META[group.status];
            return (
              <li
                key={group.key}
                className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs"
              >
                <span className="flex flex-wrap items-center gap-1">
                  <span className="font-medium text-slate-800">
                    {group.subjectName || group.teacherName || group.label}
                  </span>
                  <span className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${status.className}`}>
                    {status.label}
                  </span>
                  {group.openRequest && (
                    <span className="rounded-full bg-amber-50 px-1.5 py-[1px] text-[10px] text-amber-700">
                      Đang trong {group.openRequest.code || `#${group.openRequest.id}`}
                    </span>
                  )}
                  {group.inContractAmount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-[1px] text-[10px] text-emerald-700">
                      Có trong HĐ {money(group.inContractAmount)}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-slate-600">
                  Phải chi {money(group.totalAmount)} · Còn{" "}
                  <b className="text-orange-600">{money(Math.max(0, group.remainingAmount))}</b>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {sheet.hasData && (
        <details open className="rounded-xl bg-white p-2">
          <summary className="cursor-pointer select-none text-xs font-semibold text-indigo-700">
            Chi tiết từng dòng ở QL thu chi
          </summary>
          <div className="mt-2">
            {sheet.source === "MANAGEMENT" ? (
              <ManagementExpenseSections
                sections={sheet.sections}
                emptyText="Bảng Chi Ngoài chưa có dòng nào."
              />
            ) : sheet.source === "SCHOOL_EXPENSE" ? (
              <SchoolExpenseRows rows={sheet.rows as SchoolExpenseSheetRow[]} />
            ) : (
              <SchoolTeacherRows rows={sheet.rows as SchoolTeacherSheetRow[]} />
            )}
          </div>
        </details>
      )}
    </section>
  );
}
