import { History, Lock, Plus, Save, Unlock } from "lucide-react";

import RevenueExpenseTable from "./RevenueExpenseTable";
import ManagementExpenseTable from "./ManagementExpenseTable";
import InvoiceTable from "./InvoiceTable";
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

  /** Sales admin / kế toán trưởng: chỉ hiển thị bảng "Chi Ngoài", ẩn Doanh thu + Hoá đơn. */
  managementOnly?: boolean;
  /** Bảng "Chi Ngoài" đã được sales admin xác nhận (khoá). */
  managementConfirmed?: boolean;
  /** true khi bảng "Chi Ngoài" bị khoá với người xem hiện tại. */
  managementReadOnly?: boolean;
  /** Có quyền bấm nút "Xác nhận" (sales admin) không. */
  canConfirmManagement?: boolean;
  confirmingManagement?: boolean;
  onConfirmManagement?: () => void;
  /** Tên sales admin đã xác nhận bảng "Chi Ngoài". */
  managementConfirmedByName?: string | null;
  /** Thời điểm xác nhận. */
  managementConfirmedAt?: string | Date | null;
  /** Kế toán trưởng — được quyền mở khóa tất cả các dòng để chỉnh sửa. */
  isChief?: boolean;
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

  managementOnly = false,
  managementConfirmed = false,
  managementReadOnly = false,
  canConfirmManagement = false,
  confirmingManagement = false,
  onConfirmManagement,
  managementConfirmedByName,
  managementConfirmedAt,
  isChief = false,
}: Props) {
  const lockAllInvoices = () => {
    inputRows.forEach((_, idx) => updateInputRow(idx, "invoiceLocked", true));
  };

  const unlockAllInvoices = () => {
    inputRows.forEach((_, idx) => updateInputRow(idx, "invoiceLocked", false));
  };
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-800">Quản lý thu chi</h2>
      </div>

      <div className="p-4 space-y-8">
        {!managementOnly && (
          <>
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

            {/* HÓA ĐƠN — nằm giữa Chi Trường và Chi Ngoài */}
            <div className="space-y-3">
              <InvoiceTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                subjects={subjects}
                updateInputRow={updateInputRow}
              />
            </div>
          </>
        )}

        {/* CHI QUẢN LÝ */}
        <div className="space-y-3">
          <ManagementExpenseTable
            rows={managementRows}
            subjects={subjects}
            inputRows={inputRows}
            updateInputRow={updateInputRow}
            updateRow={updateManagementRow}
            removeRow={removeManagementRow}
            isConfirmed={managementConfirmed}
            readOnly={managementReadOnly}
            canConfirm={canConfirmManagement}
            confirming={confirmingManagement}
            onConfirm={onConfirmManagement}
            confirmedByName={managementConfirmedByName}
            confirmedAt={managementConfirmedAt}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {!managementOnly && (
            <button
              onClick={addRevenueRow}
              className="
                h-12 px-5 rounded-2xl
                bg-indigo-600
                text-white font-bold
                flex items-center gap-2
                hover:bg-indigo-700
                transition-all
              "
            >
              <Plus size={18} />
              <span>Thêm dòng doanh thu</span>
            </button>
          )}

          {!managementOnly && (
            <button
              onClick={lockAllInvoices}
              className="
                h-12 px-5 rounded-2xl
                border border-amber-200
                bg-white
                text-amber-700 font-bold
                flex items-center gap-2
                hover:bg-amber-50
                transition-all
              "
            >
              <Lock size={18} />
              <span>Xuất hóa đơn tất cả</span>
            </button>
          )}

          {!managementOnly && isChief && (
            <button
              onClick={unlockAllInvoices}
              className="
                h-12 px-5 rounded-2xl
                border border-emerald-200
                bg-white
                text-emerald-700 font-bold
                flex items-center gap-2
                hover:bg-emerald-50
                transition-all
              "
            >
              <Unlock size={18} />
              <span>Mở khóa tất cả</span>
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

          {!(managementOnly && managementReadOnly) && (
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
              <span>
                {editingItem
                  ? "Cập nhật"
                  : managementOnly
                    ? "Lưu Chi Ngoài"
                    : "Lưu tất cả"}
              </span>
            </button>
          )}

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
        </div>
      </div>
    </div>
  );
}
