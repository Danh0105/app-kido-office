import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

import {
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  getPolicyTeacherUnitPrice,
  type PolicyOtherCost,
} from "../../utils/policyOtherCosts";
import { invoiceCashAccountLabel } from "../utils/invoiceCashAccounts";
import { calculateRevenueQuantity } from "@/utils/revenueAmount";

type Align = "left" | "right" | "center";

type Column<T> = {
  key: string;
  label: string;
  /** Độ rộng (px). Bỏ trống = cột co giãn, nhận phần chiều rộng còn dư. */
  width?: number;
  align?: Align;
  /** Cho xuống dòng (cột chữ dài). */
  wrap?: boolean;
  /** Màu / độ đậm riêng của ô dữ liệu. */
  className?: string;
  render: (row: T) => ReactNode;
};

// Độ rộng dùng chung cho mọi bảng → các cột cùng loại thẳng hàng giữa các bảng.
const NUM = 96; // Số tiết / HS / Tháng
const NUM_FIT = 72; // Số tiết / HS / Tháng khi phóng to — vẫn cố định để thẳng hàng
const MONEY = 140;
const DATE = 132;
const TEXT = 190;
const FLEX_MIN = 240; // tối thiểu của cột co giãn

const fmt = (value: unknown) => Number(value || 0).toLocaleString("vi-VN");
// Tháng lưu tới 4 chữ số thập phân — toLocaleString mặc định chỉ hiện 3.
const fmtMonths = (value: unknown) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const alignClass: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const invoiceTypeLabel = (r: any) =>
  r.invoiceType === "company"
    ? "Xuất HĐ Cty"
    : r.invoiceType === "student"
    ? "Xuất HĐ HS"
    : r.invoiceType === "none"
    ? "Không xuất"
    : r.invoiceType === "other"
    ? r.invoiceOther || "Khác"
    : "-";

/**
 * `src/pages/.../Policy/css/Sales.css` khai báo `th, td { padding: 4px !important;
 * font-size: 10px }` toàn cục → ép lại cỡ chữ (class thắng selector thẻ) và
 * padding (`!`) ngay ở từng ô.
 */
const cellClass = (fit: boolean) =>
  `${fit ? "!px-3 !py-2.5" : "!px-4 !py-3"} text-base leading-snug`;

function SavedTable<T>({
  columns,
  rows,
  rowKey,
  fit,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Phóng to: co các cột cho vừa màn hình, không cần cuộn ngang. */
  fit: boolean;
}) {
  const minWidth = columns.reduce(
    (total, column) => total + (column.width ?? FLEX_MIN),
    0
  );

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse ${
          fit ? "table-auto" : "table-fixed"
        }`}
        style={fit ? undefined : { minWidth }}
      >
        <colgroup>
          {columns.map((column) => {
            // Phóng to: chỉ giữ cố định các cột số ngắn, còn lại co theo nội dung.
            const width = fit
              ? column.width === NUM
                ? NUM_FIT
                : undefined
              : column.width;
            return (
              <col key={column.key} style={width ? { width } : undefined} />
            );
          })}
        </colgroup>
        <thead>
          <tr className="bg-slate-900 text-white">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${cellClass(fit)} align-bottom font-bold ${
                  alignClass[column.align ?? "left"]
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className="border-t border-slate-200 hover:bg-slate-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${cellClass(
                    fit
                  )} align-top font-semibold tabular-nums ${
                    alignClass[column.align ?? "left"]
                  } ${
                    column.wrap
                      ? "whitespace-normal break-words"
                      : "whitespace-nowrap"
                  } ${column.className ?? "text-slate-800"}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={`border-y px-6 py-3 text-lg font-bold ${className}`}>
      {children}
    </div>
  );
}

type Props = {
  savedRevenues: any[];
  savedSchoolItems: any[];
  savedMgmtItems: any[];
  /** "Chi khác" theo chính sách của môn đang mở. */
  otherCosts: PolicyOtherCost[];
  /** ttcs[0] của chính sách — giá trị mặc định QL1/QL2. */
  ttcs: any;
  teacherSplit?: boolean;
};

export default function SavedDataSection({
  savedRevenues,
  savedSchoolItems,
  savedMgmtItems,
  otherCosts,
  ttcs,
  teacherSplit = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Phóng to: Esc để thu nhỏ, khoá cuộn trang phía sau.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  if (
    savedRevenues.length === 0 &&
    savedSchoolItems.length === 0 &&
    savedMgmtItems.length === 0
  ) {
    return null;
  }

  // ===== DOANH THU =====
  const revenueRows = savedRevenues.map((r: any) => {
    const invoiceAmount =
      Number(r.invoiceAmount || 0) ||
      Number(r.studentCount || 0) *
        Number(r.monthsCount || 0) *
        Number(r.unitPrice || 0);
    return {
      ...r,
      invoiceAmount,
      remaining: invoiceAmount - Number(r.paidAmount || 0),
    };
  });
  type RevenueView = (typeof revenueRows)[number];

  const revenueColumns: Column<RevenueView>[] = [
    {
      key: "periods",
      label: "Số tiết",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.totalPeriods),
    },
    {
      key: "students",
      label: "HS",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.studentCount),
    },
    {
      key: "months",
      label: "Tháng",
      width: NUM,
      align: "right",
      render: (r) => fmtMonths(r.monthsCount),
    },
    {
      key: "unitPrice",
      label: "Đơn giá",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.unitPrice),
    },
    {
      key: "amount",
      label: "Thành tiền",
      width: MONEY,
      align: "right",
      className: "font-bold text-blue-700",
      render: (r) => fmt(r.invoiceAmount),
    },
    {
      key: "paid",
      label: "Đã thu",
      width: MONEY,
      align: "right",
      className: "font-bold text-green-700",
      render: (r) => fmt(r.paidAmount),
    },
    {
      key: "method",
      label: "Hình thức",
      width: DATE,
      render: (r) =>
        r.paymentMethod === "cash"
          ? "Tiền mặt"
          : r.paymentMethod === "bank_transfer"
          ? "Chuyển khoản"
          : "-",
    },
    {
      key: "date",
      label: "Ngày thu",
      width: DATE,
      render: (r) => text(r.paymentDate),
    },
    {
      key: "remaining",
      label: "Còn lại",
      width: MONEY,
      align: "right",
      className: "font-bold text-orange-700",
      render: (r) => fmt(r.remaining),
    },
    {
      key: "content",
      label: "Nội dung",
      wrap: true,
      render: (r) => text(r.content),
    },
  ];

  // ===== CHI TRƯỜNG =====
  const policyTeacherUnitPrice = getPolicyTeacherUnitPrice({ ttcs: [ttcs] });
  const schoolRows = savedSchoolItems.map((r: any) => {
    const students = Number(r.studentCount || 0);
    const months = Number(r.monthsCount || 0);
    const teacherUP = policyTeacherUnitPrice;
    const taxUP = Number(r.taxUnitPrice ?? r.thue ?? r.tax ?? 0);
    const csvcUP = Number(r.csvcUnitPrice ?? r.csvc ?? 0);
    const teacherAmt = teacherSplit ? 0 : students * months * teacherUP;
    const taxAmt = students * months * taxUP;
    const csvcAmt = students * months * csvcUP;
    const totalSchool = teacherAmt + taxAmt + csvcAmt;
    return {
      ...r,
      teacherUP,
      taxUP,
      csvcUP,
      teacherAmt,
      taxAmt,
      csvcAmt,
      totalSchool,
      remaining: totalSchool - Number(r.paidAmount || 0),
    };
  });
  type SchoolView = (typeof schoolRows)[number];

  const schoolColumns: Column<SchoolView>[] = [
    {
      key: "periods",
      label: "Số tiết",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.totalPeriods),
    },
    {
      key: "students",
      label: "HS",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.studentCount),
    },
    {
      key: "months",
      label: "Tháng",
      width: NUM,
      align: "right",
      render: (r) => fmtMonths(r.monthsCount),
    },
    {
      key: "teacherUP",
      label: "ĐG GV",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.teacherUP),
    },
    {
      key: "teacher",
      label: "Giáo viên",
      width: MONEY,
      align: "right",
      className: "font-bold text-amber-700",
      render: (r) => fmt(r.teacherAmt),
    },
    {
      key: "taxUP",
      label: "ĐG Thuế",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.taxUP),
    },
    {
      key: "tax",
      label: "Thuế",
      width: MONEY,
      align: "right",
      className: "font-bold text-rose-700",
      render: (r) => fmt(r.taxAmt),
    },
    {
      key: "csvcUP",
      label: "ĐG CSVC",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.csvcUP),
    },
    {
      key: "csvc",
      label: "CSVC",
      width: MONEY,
      align: "right",
      className: "font-bold text-emerald-700",
      render: (r) => fmt(r.csvcAmt),
    },
    {
      key: "total",
      label: "Chi trường",
      width: MONEY,
      align: "right",
      className: "font-bold text-blue-700",
      render: (r) => fmt(r.totalSchool),
    },
    {
      key: "paid",
      label: "Đã chi",
      width: MONEY,
      align: "right",
      className: "font-bold text-green-700",
      render: (r) => fmt(r.paidAmount),
    },
    {
      key: "remaining",
      label: "Còn lại",
      width: MONEY,
      align: "right",
      className: "font-bold text-orange-700",
      render: (r) => fmt(r.remaining),
    },
    {
      key: "date",
      label: "Ngày chi",
      width: DATE,
      render: (r) => text(r.expenseDate),
    },
    {
      key: "payer",
      label: "Người chi",
      width: TEXT,
      wrap: true,
      render: (r) => text(r.payer),
    },
    { key: "note", label: "Ghi chú", wrap: true, render: (r) => text(r.note) },
  ];

  // ===== HÓA ĐƠN — của từng dòng doanh thu =====
  const invoiceRows = savedRevenues.map((r: any, idx: number) => {
    // Đơn giá = Đơn giá doanh thu - Đơn giá Chi trường của dòng cùng rowIndex
    // (không trừ nếu Hình thức chi = "Không có trong HĐ").
    const revenueUnitPrice = Number(r.unitPrice || 0);
    const sc =
      savedSchoolItems.find((x: any) => x.rowIndex === r.rowIndex) ||
      savedSchoolItems[idx];
    const schoolUnitPrice = sc
      ? policyTeacherUnitPrice +
        Number(sc.taxUnitPrice ?? sc.thue ?? sc.tax ?? 0) +
        Number(sc.csvcUnitPrice ?? sc.csvc ?? 0)
      : 0;
    const unitPrice =
      sc?.paymentType === "not_in_contract"
        ? revenueUnitPrice
        : revenueUnitPrice - schoolUnitPrice;
    const quantity = Number(r.studentCount || 0);
    return {
      ...r,
      quantity,
      companyUnitPrice: unitPrice,
      total: quantity * unitPrice,
    };
  });
  type InvoiceView = (typeof invoiceRows)[number];

  const invoiceColumns: Column<InvoiceView>[] = [
    {
      key: "content",
      label: "Nội dung",
      wrap: true,
      render: (r) => text(r.content),
    },
    {
      key: "type",
      label: "HĐ",
      width: TEXT,
      render: (r) => invoiceTypeLabel(r),
    },
    {
      key: "number",
      label: "Số HĐ",
      width: DATE,
      render: (r) =>
        r.invoiceType === "company" ? text(r.invoiceNumber) : "-",
    },
    {
      key: "date",
      label: "Ngày xuất HĐ",
      width: DATE,
      render: (r) => text(r.invoiceDate),
    },
    {
      key: "quantity",
      label: "Số lượng",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.quantity),
    },
    {
      key: "unitPrice",
      label: "Đơn giá",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.companyUnitPrice),
    },
    {
      key: "total",
      label: "Tổng thanh toán công ty",
      width: MONEY + 30,
      align: "right",
      className: "font-bold text-violet-700",
      render: (r) => fmt(r.total),
    },
    {
      key: "paymentDate",
      label: "Ngày chi",
      width: DATE,
      render: (r) => text(r.invoicePaymentDate),
    },
    {
      key: "cashAccount",
      label: "Khoản thu/chi",
      width: TEXT,
      wrap: true,
      render: (r) => text(invoiceCashAccountLabel(r.invoiceCashAccount)),
    },
  ];

  // ===== CHI NGOÀI =====
  const mgmtRows = savedMgmtItems.map((r: any) => {
    const quantity = calculateRevenueQuantity(r);
    const ql1UP = Number(r.ql1UnitPrice ?? ttcs?.ql1Percent ?? 0);
    const ql2UP = Number(r.ql2UnitPrice ?? ttcs?.ql2Percent ?? 0);
    const ql1Tax = Number(r.ql1Tax ?? ttcs?.ql1Tax ?? 0);
    const ql2Tax = Number(r.ql2Tax ?? ttcs?.ql2Tax ?? 0);
    const ql1Amt = Math.max(0, ql1UP - ql1Tax) * quantity;
    const ql2Amt = Math.max(0, ql2UP - ql2Tax) * quantity;
    const otherCostValues = otherCosts.map((item, otherCostIndex) => {
      const key = getOtherCostKey(item, otherCostIndex);
      const savedCost = (r.otherCosts || []).find(
        (cost: any, savedIndex: number) =>
          getOtherCostKey(cost, savedIndex) === key ||
          (cost.name && item.name && cost.name === item.name)
      );
      const unitPrice = savedCost
        ? getOtherCostGrossPrice(savedCost)
        : getOtherCostGrossPrice(item);
      const tax =
        savedCost?.tax !== undefined && savedCost?.tax !== null
          ? getOtherCostTax(savedCost)
          : getOtherCostTax(item);
      return { unitPrice, tax, expense: Math.max(0, unitPrice - tax) };
    });
    const totalOutside =
      ql1Amt +
      ql2Amt +
      otherCostValues.reduce((total, item) => total + item.expense, 0);
    return {
      ...r,
      ql1UP,
      ql2UP,
      ql1Tax,
      ql2Tax,
      ql1Amt,
      ql2Amt,
      otherCostValues,
      totalOutside,
      remaining: totalOutside - Number(r.paidAmount || 0),
    };
  });
  type MgmtView = (typeof mgmtRows)[number];

  const mgmtColumns: Column<MgmtView>[] = [
    {
      key: "periods",
      label: "Số tiết",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.totalPeriods),
    },
    {
      key: "students",
      label: "HS",
      width: NUM,
      align: "right",
      render: (r) => fmt(r.studentCount),
    },
    {
      key: "months",
      label: "Tháng",
      width: NUM,
      align: "right",
      render: (r) => fmtMonths(r.monthsCount),
    },
    {
      key: "ql1UP",
      label: "ĐG QL1",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.ql1UP),
    },
    {
      key: "ql1Tax",
      label: "Thuế QL1",
      width: MONEY,
      align: "right",
      className: "text-rose-700",
      render: (r) => fmt(r.ql1Tax),
    },
    {
      key: "ql1",
      label: "Chi QL1",
      width: MONEY,
      align: "right",
      className: "font-bold text-emerald-700",
      render: (r) => fmt(r.ql1Amt),
    },
    {
      key: "ql2UP",
      label: "ĐG QL2",
      width: MONEY,
      align: "right",
      render: (r) => fmt(r.ql2UP),
    },
    {
      key: "ql2Tax",
      label: "Thuế QL2",
      width: MONEY,
      align: "right",
      className: "text-rose-700",
      render: (r) => fmt(r.ql2Tax),
    },
    {
      key: "ql2",
      label: "Chi QL2",
      width: MONEY,
      align: "right",
      className: "font-bold text-cyan-700",
      render: (r) => fmt(r.ql2Amt),
    },
    ...otherCosts.flatMap((item, index): Column<MgmtView>[] => {
      const label = item.name || `Chi khác ${index + 1}`;
      const key = getOtherCostKey(item, index);
      return [
        {
          key: `${key}-unit`,
          label: `ĐG ${label}`,
          width: MONEY,
          align: "right",
          className: "text-fuchsia-700",
          render: (r) => fmt(r.otherCostValues[index]?.unitPrice),
        },
        {
          key: `${key}-tax`,
          label: `Thuế ${label}`,
          width: MONEY,
          align: "right",
          className: "text-rose-700",
          render: (r) => fmt(r.otherCostValues[index]?.tax),
        },
        {
          key: `${key}-expense`,
          label: `Chi ${label}`,
          width: MONEY,
          align: "right",
          className: "font-bold text-fuchsia-700",
          render: (r) => fmt(r.otherCostValues[index]?.expense),
        },
      ];
    }),
    {
      key: "total",
      label: "Tổng chi ngoài",
      width: MONEY,
      align: "right",
      className: "font-bold text-red-600",
      render: (r) => fmt(r.totalOutside),
    },
    {
      key: "invoice",
      label: "Tiền HĐ",
      width: MONEY,
      align: "right",
      className: "font-bold text-blue-600",
      render: (r) => fmt(r.invoiceAmount),
    },
    {
      key: "paid",
      label: "Đã chi",
      width: MONEY,
      align: "right",
      className: "font-bold text-green-700",
      render: (r) => fmt(r.paidAmount),
    },
    {
      key: "remaining",
      label: "Còn chi",
      width: MONEY,
      align: "right",
      className: "font-bold text-orange-700",
      render: (r) => fmt(r.remaining),
    },
    {
      key: "date",
      label: "Ngày chi",
      width: DATE,
      render: (r) => text(r.expenseDate),
    },
    {
      key: "payer",
      label: "Người chi",
      width: TEXT,
      wrap: true,
      render: (r) => text(r.payer),
    },
    { key: "note", label: "Ghi chú", wrap: true, render: (r) => text(r.note) },
  ];

  const rowKey = (row: any, index: number) => row.id ?? index;

  const renderTables = (fit: boolean) => (
    <>
      {revenueRows.length > 0 && (
        <div>
          <SectionTitle className="bg-indigo-50 text-indigo-700">
            💰 Doanh Thu ({revenueRows.length})
          </SectionTitle>
          <SavedTable
            columns={revenueColumns}
            rows={revenueRows}
            rowKey={rowKey}
            fit={fit}
          />
        </div>
      )}

      {schoolRows.length > 0 && (
        <div>
          <SectionTitle className="bg-blue-50 text-blue-700">
            🏫 Chi Trường ({schoolRows.length})
          </SectionTitle>
          <SavedTable
            columns={schoolColumns}
            rows={schoolRows}
            rowKey={rowKey}
            fit={fit}
          />
        </div>
      )}

      {invoiceRows.length > 0 && (
        <div>
          <SectionTitle className="bg-amber-50 text-amber-700">
            🧾 Hóa Đơn ({invoiceRows.length})
          </SectionTitle>
          <SavedTable
            columns={invoiceColumns}
            rows={invoiceRows}
            rowKey={rowKey}
            fit={fit}
          />
        </div>
      )}

      {mgmtRows.length > 0 && (
        <div>
          <SectionTitle className="bg-emerald-50 text-emerald-700">
            💸 Chi Ngoài ({mgmtRows.length})
          </SectionTitle>
          <SavedTable
            columns={mgmtColumns}
            rows={mgmtRows}
            rowKey={rowKey}
            fit={fit}
          />
        </div>
      )}
    </>
  );

  const headerButtonClass =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors";

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-slate-800 px-6 py-4 text-white">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex-1 text-left text-xl font-bold"
          >
            📋 Dữ liệu đã lưu
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={`${headerButtonClass} bg-white/10 hover:bg-white/20`}
            >
              <Maximize2 size={16} />
              Phóng to
            </button>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className={`${headerButtonClass} font-normal hover:bg-white/10`}
            >
              {open ? "Ẩn ▲" : "Hiện ▼"}
            </button>
          </div>
        </div>

        {open && renderTables(false)}
      </div>

      {/* Portal ra body: không bị khung cha (transform / z-index) cắt hay đè lên. */}
      {expanded &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dữ liệu đã lưu"
            className="fixed inset-0 z-[1000] flex flex-col bg-slate-100"
          >
            <div className="flex items-center justify-between gap-3 bg-slate-800 px-6 py-4 text-white">
              <span className="text-xl font-bold">📋 Dữ liệu đã lưu</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={`${headerButtonClass} bg-white/10 hover:bg-white/20`}
              >
                <Minimize2 size={16} />
                Thu nhỏ
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {renderTables(true)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
