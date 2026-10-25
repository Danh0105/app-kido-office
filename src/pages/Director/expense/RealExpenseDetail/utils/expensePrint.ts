import type { InputExpenseRow } from "../type/InputExpenseRow";
import { invoiceCashAccountLabel } from "./invoiceCashAccounts";
import {
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  getPolicyOtherCosts,
} from "../../utils/policyOtherCosts";
import {
  calculateRevenueAmount,
  calculateRevenueQuantity,
} from "@/utils/revenueAmount";

/** Các bảng in được ở màn "Quản lý thu chi". */
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
};

type PrintColumn<T> = {
  header: string;
  cell: (row: T, index: number) => string;
  align?: "left" | "center" | "right";
  /** Có giá trị → hiện ở dòng "Tổng cộng". */
  total?: number;
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

/** "2026-09-15" → "15/09/2026". */
const date = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "";
};

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

function renderTable<T>(
  columns: PrintColumn<T>[],
  rows: T[],
  className = "",
) {
  const head = columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join("");

  const body = rows.length
    ? rows
        .map(
          (row, index) =>
            `<tr>${columns
              .map(
                (column) =>
                  `<td class="${column.align || "left"}">${escapeHtml(
                    column.cell(row, index),
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td class="center" colspan="${columns.length}">Không có dữ liệu</td></tr>`;

  // "Tổng cộng" gộp các cột đứng trước cột tổng đầu tiên.
  const firstTotal = columns.findIndex((column) => column.total !== undefined);
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

  return `<table class="${className}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}

const sharedColumns = <T extends { input: InputExpenseRow }>(
  studentHeader: string,
  monthHeader: string,
): PrintColumn<T>[] => [
  { header: "STT", cell: (_, index) => String(index + 1), align: "center" },
  { header: "Nội dung", cell: (item) => item.input.content || "" },
  {
    header: "Số tiết",
    cell: (item) => quantity(item.input.totalPeriods),
    align: "center",
  },
  {
    header: studentHeader,
    cell: (item) => quantity(item.input.studentCount),
    align: "center",
  },
  {
    header: monthHeader,
    cell: (item) => quantity(item.input.monthsCount),
    align: "center",
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

  return renderTable<(typeof rows)[number]>(
    [
      ...sharedColumns("HS", "Tháng"),
      {
        header: "Đơn giá",
        cell: (item) => money(item.input.unitPrice),
        align: "right",
      },
      {
        header: "Thành tiền",
        cell: (item) => money(item.amount),
        align: "right",
        total: sum(rows, (item) => item.amount),
      },
      {
        header: "Đã thu",
        cell: (item) => money(item.paid),
        align: "right",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Hình thức",
        cell: (item) => PAYMENT_METHOD_LABELS[item.input.paymentMethod] || "",
        align: "center",
      },
      {
        header: "Ngày thu",
        cell: (item) => date(item.input.paymentDate),
        align: "center",
      },
      {
        header: "Còn lại",
        cell: (item) => money(item.remaining),
        align: "right",
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
) {
  const policyData = subject?.policies?.[0]?.data || {};
  const fallbackInput = inputRows[0] || ({} as InputExpenseRow);

  const rows = revenueRows.map((row, index) => {
    const input = inputRows[index] || fallbackInput;
    const students = Number(input.studentCount || 0);
    const months = Number(input.monthsCount || 0);
    const teacherUnitPrice = Number(
      row.teacherUnitPrice ?? row.giaovien ?? policyData?.giaovien ?? 0,
    );
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

  return renderTable<(typeof rows)[number]>(
    [
      ...sharedColumns("HS", "Tháng"),
      {
        header: "ĐG CSVC",
        cell: (item) => money(item.csvcUnitPrice),
        align: "right",
      },
      {
        header: "CSVC",
        cell: (item) => money(item.csvcAmount),
        align: "right",
        total: sum(rows, (item) => item.csvcAmount),
      },
      {
        header: "ĐG giáo viên",
        cell: (item) => money(item.teacherUnitPrice),
        align: "right",
      },
      {
        header: "Giáo viên",
        cell: (item) => money(item.teacherAmount),
        align: "right",
        total: sum(rows, (item) => item.teacherAmount),
      },
      {
        header: "ĐG thuế",
        cell: (item) => money(item.taxUnitPrice),
        align: "right",
      },
      {
        header: "Thuế",
        cell: (item) => money(item.taxAmount),
        align: "right",
        total: sum(rows, (item) => item.taxAmount),
      },
      {
        header: "Chi trường",
        cell: (item) => money(item.total),
        align: "right",
        total: sum(rows, (item) => item.total),
      },
      {
        header: "Hình thức chi",
        cell: (item) => PAYMENT_TYPE_LABELS[item.row.paymentType] || "",
        align: "center",
      },
      {
        header: "Ngày chi",
        cell: (item) => date(item.row.paymentDate),
        align: "center",
      },
      {
        header: "Đã chi",
        cell: (item) => money(item.paid),
        align: "right",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Còn lại",
        cell: (item) => money(item.remaining),
        align: "right",
        total: sum(rows, (item) => item.remaining),
      },
      { header: "Người chi", cell: (item) => item.row.payer || "" },
      { header: "Ghi chú", cell: (item) => item.row.note || "" },
    ],
    rows,
    "dense",
  );
}

function managementSection(
  managementRows: any[],
  inputRows: InputExpenseRow[],
  subject: any,
) {
  const ttcs = subject?.policies?.[0]?.data?.ttcs?.[0] || {};
  const otherCosts = getPolicyOtherCosts(subject);
  const fallbackInput = inputRows[0] || ({} as InputExpenseRow);

  const rows = managementRows.map((row, index) => {
    const input = inputRows[index] || fallbackInput;
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
          cell: (item) => money(item.others[otherIndex].unitPrice),
          align: "right",
        },
        {
          header: `Thuế ${label}`,
          cell: (item) => money(item.others[otherIndex].tax),
          align: "right",
        },
        {
          header: `Chi ${label}`,
          cell: (item) => money(item.others[otherIndex].expense),
          align: "right",
          total: sum(rows, (item) => item.others[otherIndex].expense),
        },
      ];
    },
  );

  return renderTable<Item>(
    [
      ...sharedColumns("Số HS", "Số tháng"),
      {
        header: "Đơn giá QL1",
        cell: (item) => money(item.ql1UnitPrice),
        align: "right",
      },
      { header: "Thuế QL1", cell: (item) => money(item.ql1Tax), align: "right" },
      {
        header: "Chi QL1",
        cell: (item) => money(item.ql1Expense),
        align: "right",
        total: sum(rows, (item) => item.ql1Expense),
      },
      {
        header: "Đơn giá QL2",
        cell: (item) => money(item.ql2UnitPrice),
        align: "right",
      },
      { header: "Thuế QL2", cell: (item) => money(item.ql2Tax), align: "right" },
      {
        header: "Chi QL2",
        cell: (item) => money(item.ql2Expense),
        align: "right",
        total: sum(rows, (item) => item.ql2Expense),
      },
      ...otherColumns,
      {
        header: "Chi ngoài",
        cell: (item) => money(item.total),
        align: "right",
        total: sum(rows, (item) => item.total),
      },
      {
        header: "Ngày chi",
        cell: (item) => date(item.row.paymentDate),
        align: "center",
      },
      {
        header: "Nguồn chi",
        cell: (item) => invoiceCashAccountLabel(item.row.cashAccount),
      },
      {
        header: "Đã chi",
        cell: (item) => money(item.paid),
        align: "right",
        total: sum(rows, (item) => item.paid),
      },
      {
        header: "Còn chi",
        cell: (item) => money(item.remaining),
        align: "right",
        total: sum(rows, (item) => item.remaining),
      },
      { header: "Người chi", cell: (item) => item.row.payer || "" },
      { header: "Ghi chú", cell: (item) => item.row.note || "" },
    ],
    rows,
    "dense",
  );
}

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
  const { sections, inputRows, revenueRows, managementRows, subject } = data;
  const subjectName = subject?.catalog?.name || subject?.name || "";
  const metaParts = [
    data.schoolName && `Trường: ${data.schoolName}`,
    subjectName && `Môn: ${subjectName}`,
    data.schoolYear && `Năm học: ${data.schoolYear}`,
  ].filter(Boolean);
  const printedAt = new Date().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderers: Record<ExpensePrintSection, () => string> = {
    revenue: () => revenueSection(inputRows),
    school: () => schoolSection(revenueRows, inputRows, subject),
    management: () => managementSection(managementRows, inputRows, subject),
  };

  const body = EXPENSE_PRINT_SECTIONS.filter(({ key }) =>
    sections.includes(key),
  )
    .map(
      ({ key, label }) =>
        `<section><h2>${escapeHtml(label)}</h2>${renderers[key]()}</section>`,
    )
    .join("");

  const title = ["Thu chi", data.schoolName, subjectName]
    .filter(Boolean)
    .join(" - ");

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>${escapeHtml(
    title,
  )}</title><style>${PRINT_STYLES}</style></head><body><h1>Bảng thu chi</h1><p class="meta">${escapeHtml(
    metaParts.join(" · "),
  )}</p><p class="printed-at">In lúc ${escapeHtml(
    printedAt,
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
