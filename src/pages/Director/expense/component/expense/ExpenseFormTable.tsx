import { Pencil, Save } from "lucide-react";

import RevenueExpenseTable from "./RevenueExpenseTable";
import ManagementExpenseTable from "./ManagementExpenseTable";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

type Props = {
  inputData: InputExpenseRow;

  revenueRows: any[];
  managementRows: any[];

  subjects: any;
  editingItem: any;
  loading: boolean;

  addRevenueRow: () => void;
  addManagementRow: () => void;

  removeRevenueRow: (index: number) => void;
  removeManagementRow: (index: number) => void;

  updateRevenueRow: (index: number, field: string, value: string) => void;

  updateManagementRow: (index: number, field: string, value: string) => void;

  handleSubmit: () => void;
  handleCancelEdit: () => void;
};

export default function ExpenseFormTable({
  inputData,
  revenueRows,
  managementRows,

  subjects,

  editingItem,
  loading,

  addRevenueRow,
  addManagementRow,

  removeRevenueRow,
  removeManagementRow,

  updateRevenueRow,
  updateManagementRow,

  handleSubmit,
  handleCancelEdit,
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
            inputData={inputData}
            rows={revenueRows}
            subjects={subjects}
            updateRow={updateRevenueRow}
            removeRow={removeRevenueRow}
          />

          <button
            onClick={addRevenueRow}
            className="
              h-10 px-4 rounded-xl
              bg-blue-600 text-white
              font-medium
              hover:bg-blue-700
            "
          >
            + Thêm dòng doanh thu
          </button>
        </div>

        {/* CHI QUẢN LÝ */}
        <div className="space-y-3">
          <ManagementExpenseTable
            rows={managementRows}
            subjects={subjects}
            inputData={inputData}
            updateRow={updateManagementRow}
            removeRow={removeManagementRow}
          />

          <button
            onClick={addManagementRow}
            className="
              h-10 px-4 rounded-xl
              bg-emerald-600 text-white
              font-medium
              hover:bg-emerald-700
            "
          >
            + Thêm dòng chi quản lý
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3 justify-end">
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
