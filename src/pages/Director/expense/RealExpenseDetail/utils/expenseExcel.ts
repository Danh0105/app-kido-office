import type { CellObject, Row, Sheet } from "write-excel-file/browser";

import {
  buildExpenseTables,
  expenseMetaLine,
  expenseSubjectName,
  firstTotalColumn,
  formatExpenseCell,
  formatNow,
  parseIsoDate,
  type ExpenseCellKind,
  type ExpenseCellValue,
  type ExpensePrintData,
  type ExpenseTable,
} from "./expensePrint";

const BORDER = { borderStyle: "thin", borderColor: "#000000" } as const;

/** Số nguyên → không phần lẻ; còn lại hiện tối đa 2 (tiền) / 4 (số lượng) số lẻ như màn hình. */
const numberFormat = (value: number, decimals: number) => {
  const scale = 10 ** decimals;
  return Number.isInteger(Math.round(value * scale) / scale)
    ? "#,##0"
    : `#,##0.${"#".repeat(decimals)}`;
};

/** Ô số tiền / số lượng là số thật (cộng trừ được trong Excel), ngày là ngày thật. */
function valueCell(kind: ExpenseCellKind, value: ExpenseCellValue): CellObject {
  if (kind === "money" || kind === "quantity") {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return { value: "" };
    // Số lượng 0 để trống như trên màn hình; tiền 0 vẫn hiện.
    if (kind === "quantity" && !number) return { value: "" };
    return {
      value: number,
      type: Number,
      format: numberFormat(number, kind === "money" ? 2 : 4),
    };
  }
  if (kind === "date") {
    const parts = parseIsoDate(String(value));
    if (parts) {
      const [year, month, day] = parts;
      return {
        value: new Date(Date.UTC(year, month - 1, day)),
        type: Date,
        format: "dd/mm/yyyy",
      };
    }
  }
  return { value: String(value ?? "") };
}

/** Bề rộng cột theo chữ dài nhất (tiêu đề / ô), giới hạn để bảng không quá dài. */
function columnWidths({ columns, rows }: ExpenseTable) {
  return columns.map((column, index) => {
    const longest = Math.max(
      column.header.length,
      ...rows.map(
        (row) => formatExpenseCell(column.kind, row[index]).length,
      ),
      column.total !== undefined
        ? formatExpenseCell("money", column.total).length
        : 0,
    );
    return { width: Math.min(40, Math.max(6, longest + 2)) };
  });
}

function tableSheet(
  table: ExpenseTable,
  meta: string,
  exportedAt: string,
): Sheet<Blob> {
  const { columns, rows } = table;
  const span = columns.length;
  const fullWidth = (cell: CellObject): Row => [
    { ...cell, columnSpan: span },
    ...Array(span - 1).fill(null),
  ];

  const header: Row = columns.map((column) => ({
    value: column.header,
    fontWeight: "bold",
    backgroundColor: "#E5E7EB",
    align: "center",
    alignVertical: "center",
    wrap: true,
    ...BORDER,
  }));

  const body: Row[] = rows.length
    ? rows.map((row) =>
        row.map((value, index) => ({
          ...valueCell(columns[index].kind, value),
          align: columns[index].align,
          alignVertical: "top",
          wrap: columns[index].kind === "text",
          ...BORDER,
        })),
      )
    : [
        [
          { value: "Không có dữ liệu", align: "center", columnSpan: span, ...BORDER },
          ...Array(span - 1).fill(null),
        ],
      ];

  const firstTotal = firstTotalColumn(columns);
  const footer: Row[] =
    firstTotal > 0
      ? [
          [
            {
              value: "Tổng cộng",
              fontWeight: "bold",
              align: "center",
              columnSpan: firstTotal,
              ...BORDER,
            },
            ...Array(firstTotal - 1).fill(null),
            ...columns.slice(firstTotal).map((column) => ({
              ...(column.total !== undefined
                ? valueCell("money", column.total)
                : { value: "" }),
              fontWeight: "bold",
              align: "right",
              ...BORDER,
            })),
          ] as Row,
        ]
      : [];

  return {
    sheet: table.label,
    data: [
      fullWidth({
        value: `Bảng thu chi — ${table.label}`.toUpperCase(),
        fontWeight: "bold",
        fontSize: 14,
        align: "center",
      }),
      fullWidth({ value: meta, align: "center" }),
      fullWidth({
        value: `Xuất lúc ${exportedAt}`,
        fontStyle: "italic",
        align: "center",
      }),
      [],
      header,
      ...body,
      ...footer,
    ] as Row[],
    columns: columnWidths(table),
    stickyRowsCount: 5,
    orientation: "landscape",
  };
}

/** "Trường Tiểu học Ánh Dương" → "Truong_Tieu_hoc_Anh_Duong". */
const fileNamePart = (value?: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function expenseExcelFileName(data: ExpensePrintData) {
  const parts = [
    "Thu_chi",
    fileNamePart(data.schoolName),
    fileNamePart(expenseSubjectName(data.subject)),
    fileNamePart(data.schoolYear),
  ].filter(Boolean);
  return `${parts.join("_")}.xlsx`;
}

/** File Excel các bảng đã chọn (mỗi bảng một sheet), theo số liệu đang hiện trên màn hình. */
export async function buildExpenseExcel(data: ExpensePrintData) {
  const meta = expenseMetaLine(data);
  const exportedAt = formatNow();
  const sheets = buildExpenseTables(data).map((table) =>
    tableSheet(table, meta, exportedAt),
  );

  const { default: writeExcelFile } = await import("write-excel-file/browser");
  return writeExcelFile(sheets).toBlob();
}
