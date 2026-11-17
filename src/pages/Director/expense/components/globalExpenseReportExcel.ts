import type { CellObject, Row, Sheet } from "write-excel-file/browser";

export type GlobalExpenseExcelRow = {
  employeeName: string;
  employeeRoles: string;
  employeeContact: string;
  schoolName: string;
  schoolTaxCode: string;
  periodName: string;
  schoolYear: string;
  subjectName: string;
  students: number;
  periods: number;
  revenue: number;
  schoolExpense: number;
  schoolPaid: number;
  invoice: number;
  collected: number;
  outsideExpense: number;
  outsidePaid: number;
  schoolTeacher: number;
  companyTeacher: number;
  annualPolicy: number;
  otherExpense: number;
  profit: number;
};

export type GlobalExpenseExcelFilters = {
  keyword?: string;
  employeeName?: string;
  schoolName?: string;
  schoolYear?: string;
  monthLabel?: string;
};

const BORDER = { borderStyle: "thin", borderColor: "#CBD5E1" } as const;
const COLUMN_COUNT = 23;

const numberCell = (value: number, format = "#,##0"): CellObject => ({
  value: Number(value || 0),
  type: Number,
  format,
  align: "right",
  ...BORDER,
});

const textCell = (value: unknown): CellObject => ({
  value: String(value ?? ""),
  alignVertical: "top",
  wrap: true,
  ...BORDER,
});

const fullWidth = (cell: CellObject): Row => [
  { ...cell, columnSpan: COLUMN_COUNT },
  ...Array(COLUMN_COUNT - 1).fill(null),
];

export function globalExpenseFilterDescription(
  filters: GlobalExpenseExcelFilters,
) {
  const parts = [
    filters.keyword?.trim() ? `Từ khóa: ${filters.keyword.trim()}` : "",
    filters.employeeName ? `Nhân viên: ${filters.employeeName}` : "",
    filters.schoolName ? `Trường: ${filters.schoolName}` : "",
    filters.schoolYear ? `Năm học: ${filters.schoolYear}` : "",
    filters.monthLabel ? `Tháng: ${filters.monthLabel}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Tất cả dữ liệu";
}

const numericFields = [
  "students",
  "periods",
  "revenue",
  "schoolExpense",
  "schoolPaid",
  "invoice",
  "collected",
  "outsideExpense",
  "outsidePaid",
  "schoolTeacher",
  "companyTeacher",
  "annualPolicy",
  "otherExpense",
  "profit",
] as const;

export function buildGlobalExpenseReportSheet(
  sourceRows: GlobalExpenseExcelRow[],
  filters: GlobalExpenseExcelFilters,
  exportedAt = new Date(),
): Sheet<Blob> {
  const rows = [...sourceRows].sort(
    (a, b) =>
      a.employeeName.localeCompare(b.employeeName, "vi") ||
      a.schoolName.localeCompare(b.schoolName, "vi") ||
      a.periodName.localeCompare(b.periodName, "vi") ||
      a.subjectName.localeCompare(b.subjectName, "vi"),
  );
  const headers = [
    "STT",
    "Nhân viên kinh doanh",
    "Vai trò",
    "Liên hệ",
    "Trường",
    "Mã số thuế",
    "Kỳ",
    "Năm học",
    "Môn học",
    "Số học sinh",
    "Số tiết",
    "Doanh thu",
    "Chi trường",
    "Đã chi trường",
    "Hóa đơn",
    "Đã thu",
    "Chi ngoài",
    "Đã chi ngoài",
    "Giáo viên trường",
    "Giáo viên Cty",
    "CS năm",
    "Chi khác",
    "Lợi nhuận",
  ];
  const header: Row = headers.map((value) => ({
    value,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: "#1D4ED8",
    align: "center",
    alignVertical: "center",
    wrap: true,
    ...BORDER,
  }));

  const body: Row[] = rows.map((row, index) => [
    { value: index + 1, type: Number, align: "center", ...BORDER },
    textCell(row.employeeName),
    textCell(row.employeeRoles),
    textCell(row.employeeContact),
    textCell(row.schoolName),
    textCell(row.schoolTaxCode),
    textCell(row.periodName),
    textCell(row.schoolYear),
    textCell(row.subjectName),
    numberCell(row.students, "#,##0.##"),
    numberCell(row.periods, "#,##0.##"),
    ...numericFields.slice(2).map((field) => numberCell(row[field])),
  ]);

  const totals = Object.fromEntries(
    numericFields.map((field) => [
      field,
      rows.reduce((sum, row) => sum + Number(row[field] || 0), 0),
    ]),
  ) as Record<(typeof numericFields)[number], number>;
  const totalRow: Row = [
    {
      value: `TỔNG CỘNG (${rows.length} dòng)`,
      columnSpan: 9,
      fontWeight: "bold",
      align: "center",
      backgroundColor: "#DBEAFE",
      ...BORDER,
    },
    ...Array(8).fill(null),
    ...numericFields.map((field, index) => ({
      ...numberCell(
        totals[field],
        index < 2 ? "#,##0.##" : "#,##0",
      ),
      fontWeight: "bold",
      backgroundColor: "#DBEAFE",
    })),
  ];

  return {
    sheet: "Tổng hợp thu chi",
    data: [
      fullWidth({
        value: "BÁO CÁO TỔNG HỢP THU CHI",
        fontWeight: "bold",
        fontSize: 16,
        align: "center",
      }),
      fullWidth({
        value: globalExpenseFilterDescription(filters),
        align: "center",
      }),
      fullWidth({
        value: `Xuất lúc ${exportedAt.toLocaleString("vi-VN")}`,
        fontStyle: "italic",
        align: "center",
      }),
      [],
      header,
      ...body,
      totalRow,
    ],
    columns: [
      7, 24, 18, 24, 32, 16, 18, 14, 28, 13, 13, 18, 18, 18, 18, 18, 18,
      18, 18, 18, 18, 18, 18,
    ].map((width) => ({ width })),
    stickyRowsCount: 5,
    orientation: "landscape",
    zoomScale: 0.65,
  };
}

const filePart = (value?: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function globalExpenseReportFileName(
  filters: GlobalExpenseExcelFilters,
  now = new Date(),
) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const scope =
    filePart(filters.schoolName) ||
    filePart(filters.employeeName) ||
    filePart(filters.schoolYear) ||
    "Tat_ca";
  return `Bao_cao_tong_hop_thu_chi_${scope}_${date}.xlsx`;
}

export async function buildGlobalExpenseReportExcel(
  rows: GlobalExpenseExcelRow[],
  filters: GlobalExpenseExcelFilters,
) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  return writeExcelFile([
    buildGlobalExpenseReportSheet(rows, filters),
  ]).toBlob();
}
