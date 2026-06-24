import { History, Save } from "lucide-react";

import RevenueExpenseTable from "./RevenueExpenseTable";
import ManagementExpenseTable from "./ManagementExpenseTable";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  inputRows: InputExpenseRow[];

  revenueRows: any[];
  managementRows: any[];

  subjects: any;
  editingItem: any;
  loading: boolean;

  addRevenueRow: () => void;
  addManagementRow: () => void;

  removeRevenueRow: (index: number) => void;
  removeManagementRow: (index: number) => void;

  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => void;

  updateRevenueRow: (index: number, field: string, value: string) => void;

  updateManagementRow: (index: number, field: string, value: string) => void;

  handleSubmit: () => void;
  handleCancelEdit: () => void;
  handleViewHistory?: () => void;
  historyLoading?: boolean;
  historyCount?: number;
};

export default function ExpenseFormTable({
  inputRows,
  revenueRows,
  managementRows,

  subjects,

  editingItem,
  loading,

  addRevenueRow,
  addManagementRow,

  removeRevenueRow,
  removeManagementRow,

  updateInputRow,
  updateRevenueRow,
  updateManagementRow,

  handleSubmit,
  handleCancelEdit,
  handleViewHistory,
  historyLoading = false,
  historyCount = 0,
}: Props) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-800">Quản lý thu chi</h2>
      </div>

      <div className="p-4 space-y-8">
        {/* DOANH THU */}
        <div className="space-y-3">
          <RevenueExpenseTable
            inputRows={inputRows}
            rows={revenueRows}
            subjects={subjects}
            updateInputRow={updateInputRow}
            updateRow={updateRevenueRow}
            removeRow={removeRevenueRow}
          />
        </div>

        {/* CHI QUẢN LÝ */}
        <div className="space-y-3">
          <ManagementExpenseTable
            rows={managementRows}
            subjects={subjects}
            inputRows={inputRows}
            updateInputRow={updateInputRow}
            updateRow={updateManagementRow}
            removeRow={removeManagementRow}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {handleViewHistory && (
            <button
              onClick={handleViewHistory}
              disabled={historyLoading}
              className={`
                h-12 px-5 rounded-2xl
                border border-slate-200
                bg-white
                text-slate-700 font-bold
                flex items-center gap-2
                transition-all
                ${
                  historyLoading
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-slate-300 hover:bg-slate-100"
                }
              `}
            >
              <History size={18} />
              <span>{historyLoading ? "Đang tải..." : "Xem lịch sử"}</span>
              {historyCount > 0 && (
                <span className="min-w-6 h-6 px-2 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>
          )}

          {editingItem && (
            <button
              onClick={handleCancelEdit}
              className="
                h-12 px-5 rounded-2xl
                border border-red-200
                text-red-500
                bg-white
              "
            >
              Huỷ
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`
              h-12 px-7 rounded-2xl
              text-white font-bold
              flex items-center gap-2
              ${
                loading
                  ? "bg-slate-400"
                  : editingItem
                  ? "bg-emerald-600"
                  : "bg-blue-600"
              }
            `}
          >
            <Save size={18} />
            <span>{editingItem ? "Cập nhật" : "Lưu tất cả"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
