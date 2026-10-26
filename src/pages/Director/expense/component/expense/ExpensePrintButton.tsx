import { useState } from "react";
import { FileSpreadsheet, Printer, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  buildExpensePrintHtml,
  EXPENSE_PRINT_SECTIONS,
  printHtml,
  type ExpensePrintData,
  type ExpensePrintSection,
} from "../../RealExpenseDetail/utils/expensePrint";
import {
  buildExpenseExcel,
  expenseExcelFileName,
} from "../../RealExpenseDetail/utils/expenseExcel";
import { EXCEL_FILE_TYPE, saveBlob } from "@/utils/saveBlob";

type Props = Omit<ExpensePrintData, "sections"> & {
  /** Bảng được phép in / xuất (sales admin chỉ có Chi ngoài). */
  availableSections?: ExpensePrintSection[];
};

type Mode = "print" | "excel";

const MODE_TEXT: Record<Mode, { title: string; action: string; note: string }> = {
  print: {
    title: "Chọn bảng cần in",
    action: "In",
    note: "In theo số liệu đang hiện trên màn hình (kể cả phần chưa lưu).",
  },
  excel: {
    title: "Chọn bảng cần xuất Excel",
    action: "Xuất Excel",
    note: "Mỗi bảng một sheet, theo số liệu đang hiện trên màn hình (kể cả phần chưa lưu).",
  },
};

const triggerClassName = `
  h-12 px-5 rounded-2xl
  border border-slate-200
  bg-white
  text-slate-700 font-bold
  flex items-center gap-2
  hover:border-slate-300 hover:bg-slate-100
  transition-all
`;

/** Nút "In" và "Xuất Excel" + hộp chọn bảng (Doanh thu / Chi trường / Chi ngoài). */
export default function ExpensePrintButton({
  availableSections = EXPENSE_PRINT_SECTIONS.map((section) => section.key),
  ...data
}: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] =
    useState<ExpensePrintSection[]>(availableSections);

  const options = EXPENSE_PRINT_SECTIONS.filter((section) =>
    availableSections.includes(section.key),
  );
  const sections = selected.filter((key) => availableSections.includes(key));
  const text = MODE_TEXT[mode || "print"];
  const ActionIcon = mode === "excel" ? FileSpreadsheet : Printer;

  const close = () => {
    if (!exporting) setMode(null);
  };

  const toggle = (key: ExpensePrintSection) =>
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );

  const handlePrint = () => {
    if (!printHtml(buildExpensePrintHtml({ ...data, sections }))) {
      toast.error("Trình duyệt không mở được trang in");
      return;
    }
    setMode(null);
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const exportData = { ...data, sections };
      const blob = await buildExpenseExcel(exportData);
      await saveBlob(blob, expenseExcelFileName(exportData), EXCEL_FILE_TYPE);
      setMode(null);
    } catch (error) {
      console.error(error);
      toast.error("Không xuất được file Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleAction = () => {
    if (!sections.length || exporting) return;
    if (mode === "excel") void handleExcel();
    else handlePrint();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMode("print")}
        className={triggerClassName}
      >
        <Printer size={18} />
        <span>In</span>
      </button>

      <button
        type="button"
        onClick={() => setMode("excel")}
        className={triggerClassName}
      >
        <FileSpreadsheet size={18} />
        <span>Xuất Excel</span>
      </button>

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-print-title"
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3
                id="expense-print-title"
                className="text-lg font-bold text-slate-800"
              >
                {text.title}
              </h3>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 px-5 py-4">
              {options.map((option) => (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sections.includes(option.key)}
                    onChange={() => toggle(option.key)}
                    className="h-5 w-5 accent-blue-600"
                  />
                  <span className="font-semibold text-slate-700">
                    {option.label}
                  </span>
                </label>
              ))}
              <p className="pt-1 text-xs text-slate-500">{text.note}</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={close}
                disabled={exporting}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={!sections.length || exporting}
                className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
              >
                <ActionIcon size={16} />
                {exporting ? "Đang xuất..." : text.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
