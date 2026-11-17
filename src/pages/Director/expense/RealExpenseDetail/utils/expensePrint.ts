import type { InputExpenseRow } from "../type/InputExpenseRow";
import { invoiceCashAccountLabel } from "./invoiceCashAccounts";
import {
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  getPolicyOtherCosts,
  getPolicyTeacherUnitPrice,
} from "../../utils/policyOtherCosts";
import {
  getManagementRowInput,
  type ManagementRowInput,
} from "../../utils/managementRows";
import {
  calculateRevenueAmount,
  calculateRevenueQuantity,
} from "@/utils/revenueAmount";

/** Các bảng in / xuất Excel được ở màn "Quản lý thu chi". */
export type ExpensePrintSection = "revenue" | "school" | "management";

export const EXPENSE_PRINT_SECTIONS: {
  key: ExpensePrintSection;
  label: string;
}[] = [
  { key: "revenue", label: "Doanh thu" },
  { key: "school", label: "Chi trường" },
  { key: "management", label: "Chi ngoài" },
];

export type ExpensePrintData = {
  sections: ExpensePrintSection[];
  inputRows: InputExpenseRow[];
  revenueRows: any[];
  managementRows: any[];
  /** Môn đang xem (activeSubject) — lấy đơn giá mặc định của chính sách. */
  subject: any;
  schoolName?: string;
  schoolYear?: string;
  teacherSplit?: boolean;
};

/**
 * Cách hiện một ô:
 * - money: số tiền / đơn giá, luôn hiện kể cả 0;
 * - quantity: STT / số tiết / HS / tháng, bỏ trống khi 0 như trên màn hình;
 * - date: ngày dạng "YYYY-MM-DD";
 * - text: chữ.
 */
export type ExpenseCellKind = "money" | "quantity" | "date" | "text";
export type ExpenseCellAlign = "left" | "center" | "right";
export type ExpenseCellValue = string | number;

type PrintColumn<T> = {
  header: string;
  value: (row: T, index: number) => ExpenseCellValue;
  /** Mặc định "text". */
  kind?: ExpenseCellKind;
  /** Mặc định theo kind. */
  align?: ExpenseCellAlign;
  /** Có giá trị → hiện ở dòng "Tổng cộng". */
  total?: number;
};

export type ExpenseTableColumn = {
  header: string;
  kind: ExpenseCellKind;
  align: ExpenseCellAlign;
  total?: number;
};

/** Một bảng đã tính sẵn giá trị từng ô — trang in và file Excel dùng chung. */
export type ExpenseTable = {
  key: ExpensePrintSection;
  label: string;
  columns: ExpenseTableColumn[];
  rows: ExpenseCellValue[][];
  /** Bảng nhiều cột: in chữ nhỏ hơn. */
  dense: boolean;
};

const DEFAULT_ALIGN: Record<ExpenseCellKind, ExpenseCellAlign> = {
  money: "right",
  quantity: "center",
  date: "center",
  text: "left",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] as string,
  );

/** Số tiền / đơn giá: luôn hiện, kể cả 0. */
const money = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** Số tiết / HS / tháng: bỏ trống khi 0 như trên màn hình. */
const quantity = (value: unknown) => {
  const parsed = Number(value || 0);
  return parsed
    ? parsed.toLocaleString("vi-VN", { maximumFractionDigits: 4 })
    : "";
};

/** "2026-09-15" → [2026, 9, 15]. */
export const parseIsoDate = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/** "2026-09-15" → "15/09/2026". */
const date = (value?: string | null) => {
  const parts = parseIsoDate(value);
  return parts
    ? parts
        .reverse()
        .map((part) => String(part).padStart(2, "0"))
        .join("/")
    : value || "";
};

/** Giá trị ô → chữ đúng như trên màn hình / trang in. */
export function formatExpenseCell(kind: ExpenseCellKind, value: ExpenseCellValue) {
  if (kind === "money") return money(Number(value));
  if (kind === "quantity") return quantity(value);
  if (kind === "date") return date(String(value));
  return String(value ?? "");
}

/** Cột tổng đầu tiên — "Tổng cộng" gộp các cột đứng trước nó. */
export const firstTotalColumn = (columns: ExpenseTableColumn[]) =>
  columns.findIndex((column) => column.total !== undefined);

const sum = <T>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  in_contract: "Có trong HĐ",
  not_in_contract: "Không có trong HĐ",
};

function makeTable<T>(columns: PrintColumn<T>[], rows: T[], dense = false) {
  return {
    columns: columns.map(
      ({ header, kind = "text", align, total }): ExpenseTableColumn => ({
        header,
        kind,
        align: align || DEFAULT_ALIGN[kind],
        total,
      }),
    ),
    rows: rows.map((row, index) =>
      columns.map((column) => column.value(row, index)),
    ),
    dense,
  };
}

function renderTable({ columns, rows, dense }: ExpenseTable) {
  const head = columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join("");

  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (value, index) =>
                  `<td class="${columns[index].align}">${escapeHtml(
                    formatExpenseCell(columns[index].kind, value),
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td class="center" colspan="${columns.length}">Không có dữ liệu</td></tr>`;

  const firstTotal = firstTotalColumn(columns);
  const foot =
    firstTotal > 0
      ? `<tfoot><tr><td class="center" colspan="${firstTotal}">Tổng cộng</td>${columns
          .slice(firstTotal)
          .map(
            (column) =>
              `<td class="right">${
                column.total !== undefined ? money(column.total) : ""
              }</td>`,
          )
          .join("")}</tr></tfoot>`
      : "";

  return `<table class="${dense ? "dense" : ""}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}

const sharedColumns = <T extends { input: ManagementRowInput }>(
  studentHeader: string,
  monthHeader: string,
): PrintColumn<T>[] => [
  { header: "STT", value: (_, index) => index + 1, kind: "quantity" },
  { header: "Nội dung", value: (item) => item.input.content || "" },
  {
    header: "Số tiết",
    value: (item) => Number(item.input.totalPeriods || 0),
    kind: "quantity",
  },
  {
    header: studentHeader,
    value: (item) => Number(item.input.studentCount || 0),
    kind: "quantity",
  },
  {
    header: monthHeader,
    value: (item) => Number(item.input.monthsCount || 0),
    kind: "quantity",
  },
];

// Công thức dưới đây giữ đúng như InputExpenseTable, RevenueExpenseRow và
// ManagementExpenseRow — sửa cách tính ở bảng nào thì sửa cả ở đây.

function revenueSection(inputRows: InputExpenseRow[]) {
  const rows = inputRows.map((input) => {
    const amount = calculateRevenueAmount(input);
    const paid = Number(input.paidAmount || 0);
    return { input, amount, paid, remaining: amount - paid };
  });

  return makeTable<(typeof rows)[number]>(
    [
      ...sharedColumns("HS", "Tháng"),
      {
        header: "Đơn giá",
        value: (item) => Number(item.input.unitPrice || 0),
        kind: "money",
      },
      {
        header: "Thành tiền",
        value: (item) => item.amount,
        kind: "money",
        total: sum(rows, (item) => item.amount),
      },
      {
        header: "Đã thu",
        value: (item) => item.paid,
        kind: "money",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Hình thức",
        value: (item) => PAYMENT_METHOD_LABELS[item.input.paymentMethod] || "",
        align: "center",
      },
      {
        header: "Ngày thu",
        value: (item) => item.input.paymentDate || "",
        kind: "date",
      },
      {
        header: "Còn lại",
        value: (item) => item.remaining,
        kind: "money",
        total: sum(rows, (item) => item.remaining),
      },
    ],
    rows,
  );
}

function schoolSection(
  revenueRows: any[],
  inputRows: InputExpenseRow[],
  subject: any,
  teacherSplit = false,
) {
  const policyData = subject?.policies?.[0]?.data || {};
  const fallbackInput = inputRows[0] || ({} as InputExpenseRow);

  const rows = revenueRows.map((row, index) => {
    const input = inputRows[index] || fallbackInput;
    const students = Number(input.studentCount || 0);
    const months = Number(input.monthsCount || 0);
    const teacherUnitPrice = teacherSplit
      ? 0
      : getPolicyTeacherUnitPrice(policyData);
    const taxUnitPrice = Number(
      row.taxUnitPrice ??
        row.thue ??
        row.tax ??
        policyData?.thue ??
        policyData?.tax ??
        0,
    );
    const csvcUnitPrice = Number(
      row.csvcUnitPrice ?? row.csvc ?? policyData?.csvc ?? 0,
    );
    const csvcAmount = csvcUnitPrice * months * students;
    const teacherAmount = students * months * teacherUnitPrice;
    const taxAmount = students * months * taxUnitPrice;
    const total = csvcAmount + teacherAmount + taxAmount;
    const paid = Number(row.paidAmount || 0);

    return {
      row,
      input,
      csvcUnitPrice,
      csvcAmount,
      teacherUnitPrice,
      teacherAmount,
      taxUnitPrice,
      taxAmount,
      total,
      paid,
      remaining: total - paid,
    };
  });

  return makeTable<(typeof rows)[number]>(
    [
      ...sharedColumns("HS", "Tháng"),
      {
        header: "ĐG CSVC",
        value: (item) => item.csvcUnitPrice,
        kind: "money",
      },
      {
        header: "CSVC",
        value: (item) => item.csvcAmount,
        kind: "money",
        total: sum(rows, (item) => item.csvcAmount),
      },
      {
        header: "ĐG giáo viên",
        value: (item) => item.teacherUnitPrice,
        kind: "money",
      },
      {
        header: "Giáo viên",
        value: (item) => item.teacherAmount,
        kind: "money",
        total: sum(rows, (item) => item.teacherAmount),
      },
      {
        header: "ĐG thuế",
        value: (item) => item.taxUnitPrice,
        kind: "money",
      },
      {
        header: "Thuế",
        value: (item) => item.taxAmount,
        kind: "money",
        total: sum(rows, (item) => item.taxAmount),
      },
      {
        header: "Chi trường",
        value: (item) => item.total,
        kind: "money",
        total: sum(rows, (item) => item.total),
      },
      {
        header: "Hình thức chi",
        value: (item) => PAYMENT_TYPE_LABELS[item.row.paymentType] || "",
        align: "center",
      },
      {
        header: "Ngày chi",
        value: (item) => item.row.paymentDate || "",
        kind: "date",
      },
      {
        header: "Đã chi",
        value: (item) => item.paid,
        kind: "money",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Còn lại",
        value: (item) => item.remaining,
        kind: "money",
        total: sum(rows, (item) => item.remaining),
      },
      { header: "Người chi", value: (item) => item.row.payer || "" },
      { header: "Ghi chú", value: (item) => item.row.note || "" },
    ],
    rows,
    true,
  );
}

function managementSection(
  managementRows: any[],
  inputRows: InputExpenseRow[],
  subject: any,
) {
  const ttcs = subject?.policies?.[0]?.data?.ttcs?.[0] || {};
  const otherCosts = getPolicyOtherCosts(subject);

  const rows = managementRows.map((row, index) => {
    const input = getManagementRowInput(row, index, inputRows);
    const qty = calculateRevenueQuantity(input);
    const ql1UnitPrice = Number(row.ql1UnitPrice ?? Number(ttcs.ql1Percent || 0));
    const ql1Tax = Number(row.ql1Tax ?? Number(ttcs.ql1Tax || 0));
    const ql2UnitPrice = Number(row.ql2UnitPrice ?? Number(ttcs.ql2Percent || 0));
    const ql2Tax = Number(row.ql2Tax ?? Number(ttcs.ql2Tax || 0));
    const ql1Expense = Math.max(0, ql1UnitPrice - ql1Tax) * qty;
    const ql2Expense = Math.max(0, ql2UnitPrice - ql2Tax) * qty;
    const others = otherCosts.map((item, otherIndex) => {
      const key = getOtherCostKey(item, otherIndex);
      const unitPrice = Number(
        row.otherCostUnitPrices?.[key] ?? getOtherCostGrossPrice(item),
      );
      const tax = Number(row.otherCostTaxes?.[key] ?? getOtherCostTax(item));
      return { unitPrice, tax, expense: Math.max(0, unitPrice - tax) };
    });
    const total =
      ql1Expense + ql2Expense + sum(others, (item) => item.expense);
    const paid = Number(row.paidAmount || 0);

    return {
      row,
      input,
      ql1UnitPrice,
      ql1Tax,
      ql1Expense,
      ql2UnitPrice,
      ql2Tax,
      ql2Expense,
      others,
      total,
      paid,
      remaining: total - paid,
    };
  });
  type Item = (typeof rows)[number];

  const otherColumns = otherCosts.flatMap(
    (cost, otherIndex): PrintColumn<Item>[] => {
      const label = cost.name || `Chi khác ${otherIndex + 1}`;
      return [
        {
          header: `Đơn giá ${label}`,
          value: (item) => item.others[otherIndex].unitPrice,
          kind: "money",
        },
        {
          header: `Thuế ${label}`,
          value: (item) => item.others[otherIndex].tax,
          kind: "money",
        },
        {
          header: `Chi ${label}`,
          value: (item) => item.others[otherIndex].expense,
          kind: "money",
          total: sum(rows, (item) => item.others[otherIndex].expense),
        },
      ];
    },
  );

  return makeTable<Item>(
    [
      ...sharedColumns("Số HS", "Số tháng"),
      {
        header: "Đơn giá QL1",
        value: (item) => item.ql1UnitPrice,
        kind: "money",
      },
      { header: "Thuế QL1", value: (item) => item.ql1Tax, kind: "money" },
      {
        header: "Chi QL1",
        value: (item) => item.ql1Expense,
        kind: "money",
        total: sum(rows, (item) => item.ql1Expense),
      },
      {
        header: "Đơn giá QL2",
        value: (item) => item.ql2UnitPrice,
        kind: "money",
      },
      { header: "Thuế QL2", value: (item) => item.ql2Tax, kind: "money" },
      {
        header: "Chi QL2",
        value: (item) => item.ql2Expense,
        kind: "money",
        total: sum(rows, (item) => item.ql2Expense),
      },
      ...otherColumns,
      {
        header: "Chi ngoài",
        value: (item) => item.total,
        kind: "money",
        total: sum(rows, (item) => item.total),
      },
      {
        header: "Ngày chi",
        value: (item) => item.row.paymentDate || "",
        kind: "date",
      },
      {
        header: "Nguồn chi",
        value: (item) => invoiceCashAccountLabel(item.row.cashAccount),
      },
      {
        header: "Đã chi",
        value: (item) => item.paid,
        kind: "money",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Còn chi",
        value: (item) => item.remaining,
        kind: "money",
        total: sum(rows, (item) => item.remaining),
      },
      { header: "Người chi", value: (item) => item.row.payer || "" },
      { header: "Ghi chú", value: (item) => item.row.note || "" },
    ],
    rows,
    true,
  );
}

/** Các bảng đã chọn, theo đúng thứ tự Doanh thu → Chi trường → Chi ngoài. */
export function buildExpenseTables(data: ExpensePrintData): ExpenseTable[] {
  const { sections, inputRows, revenueRows, managementRows, subject } = data;
  const builders: Record<
    ExpensePrintSection,
    () => Omit<ExpenseTable, "key" | "label">
  > = {
    revenue: () => revenueSection(inputRows),
    school: () =>
      schoolSection(revenueRows, inputRows, subject, data.teacherSplit),
    management: () => managementSection(managementRows, inputRows, subject),
  };

  return EXPENSE_PRINT_SECTIONS.filter(({ key }) => sections.includes(key)).map(
    ({ key, label }) => ({ key, label, ...builders[key]() }),
  );
}

export const expenseSubjectName = (subject: any): string =>
  subject?.catalog?.name || subject?.name || "";

/** "Trường: … · Môn: … · Năm học: …" ở đầu trang in / file Excel. */
export function expenseMetaLine(data: ExpensePrintData) {
  const subjectName = expenseSubjectName(data.subject);
  return [
    data.schoolName && `Trường: ${data.schoolName}`,
    subjectName && `Môn: ${subjectName}`,
    data.schoolYear && `Năm học: ${data.schoolYear}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const formatNow = () =>
  new Date().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const PRINT_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
  h1 { margin: 0 0 4px; font-size: 15pt; text-align: center; text-transform: uppercase; }
  .meta { margin: 0 0 2px; text-align: center; }
  .printed-at { margin: 0 0 8px; text-align: center; font-size: 9pt; font-style: italic; }
  section { margin-top: 14px; }
  section + section { break-before: auto; }
  h2 { margin: 0 0 6px; font-size: 12pt; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
  th { background: #e5e7eb; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tfoot td { font-weight: bold; }
  td.right { text-align: right; white-space: nowrap; }
  td.center { text-align: center; }
  table.dense th, table.dense td { padding: 2px 3px; font-size: 8pt; }
`;

/** Dựng trang HTML để in các bảng đã chọn, theo số liệu đang hiện trên màn hình. */
export function buildExpensePrintHtml(data: ExpensePrintData) {
  const body = buildExpenseTables(data)
    .map(
      (table) =>
        `<section><h2>${escapeHtml(table.label)}</h2>${renderTable(table)}</section>`,
    )
    .join("");

  const title = ["Thu chi", data.schoolName, expenseSubjectName(data.subject)]
    .filter(Boolean)
    .join(" - ");

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>${escapeHtml(
    title,
  )}</title><style>${PRINT_STYLES}</style></head><body><h1>Bảng thu chi</h1><p class="meta">${escapeHtml(
    expenseMetaLine(data),
  )}</p><p class="printed-at">In lúc ${escapeHtml(
    formatNow(),
  )}</p>${body}</body></html>`;
}

/** In qua iframe ẩn để trang in không dính CSS @media print của các màn khác. */
export function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return false;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const cleanup = () => window.setTimeout(() => iframe.remove(), 500);
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  // Chờ iframe dàn trang xong rồi mới mở hộp thoại in.
  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 100);
  return true;
}
