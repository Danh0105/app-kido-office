import { useState, type ReactNode } from "react";
import {
  Flag,
  History,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Unlock,
} from "lucide-react";

import RevenueExpenseTable from "./RevenueExpenseTable";
import ManagementExpenseTable from "./ManagementExpenseTable";
import InvoiceTable, { isAllInvoiceLocked } from "./InvoiceTable";
import ExpensePrintButton from "./ExpensePrintButton";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import type { RevenueEInvoice } from "@/service/schoolExpense";
import type { CollaboratorPayrollScope } from "./CollaboratorPayrollRow";

type Props = {
  inputRows: InputExpenseRow[];

  revenueRows: any[];
  managementRows: any[];

  subjects: any;
  editingItem: any;
  loading: boolean;

  /** Thêm 1 dòng cho cả 4 bảng: Doanh Thu, Chi Trường, Hóa Đơn, Chi Ngoài. */
  addRow: () => void;
  /** Thêm 1 dòng chỉ cho bảng Chi Ngoài. Không truyền thì ẩn nút. */
  addManagementRow?: () => void;

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
  /** Hiển thị đầy đủ các bảng nhưng khoá toàn bộ thao tác ghi. */
  readOnly?: boolean;
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
  /** Đã "Xác nhận đúng BBCS" → khoá phần chính sách Chi Ngoài, kể cả với KTT. */
  managementPolicyLocked?: boolean;
  /** Bảng Chi Ngoài đã khoá, người xem không phải KTT → cột chi chỉ sửa trên dòng đã lưu. */
  managementSavedRowsOnly?: boolean;
  /** Chi Ngoài chỉ còn sửa Ngày chi + Nguồn chi (trợ lý GĐ / giám đốc khi đã khoá, hoặc kỳ đã kết thúc). */
  managementDateSourceOnly?: boolean;
  /** KTT mở khoá "Xác nhận đúng BBCS". */
  onUnconfirmManagement?: () => void;
  /**
   * Kỳ thu chi đã "Kết thúc" → khoá toàn bộ, trừ Ngày chi + Nguồn chi của Chi
   * Trường / Chi Ngoài (sales admin khoá hẳn); chỉ KTT mở lại.
   */
  finalized?: boolean;
  finalizedByName?: string | null;
  finalizedAt?: string | Date | null;
  onFinalize?: () => void;
  onReopen?: () => void;
  /** Đang gọi API xác nhận BBCS / kết thúc / mở lại. */
  lockActionLoading?: boolean;
  /**
   * Nút "Đẩy hóa đơn" ở bảng Hóa Đơn: lưu rồi gộp các dòng "Xuất HĐ Cty" chưa
   * có hóa đơn thành 1 hóa đơn nháp Viettel. Không truyền thì ẩn nút.
   */
  onExportInvoices?: () => void;
  exportingInvoices?: boolean;
  /** Trạng thái hóa đơn điện tử theo rowIndex — hiển thị ở bảng Hóa Đơn. */
  einvoices?: RevenueEInvoice[];
  /** KTT "Bỏ liên kết nháp" ở bảng Hóa Đơn. Không truyền thì ẩn nút. */
  onUnlinkEInvoice?: (einvoice: RevenueEInvoice) => void;
  unlinkingEInvoiceId?: number | null;
  /** Tiêu đề trang in. */
  schoolName?: string;
  schoolYear?: string;
  /** Dòng "Lương GV CTV" ở bảng Chi Trường; không truyền thì ẩn. */
  collaboratorPayroll?: CollaboratorPayrollScope | null;
  /** Kỳ từ 11/2026: Chi Trường bỏ phần Giáo viên trường. */
  teacherSplit?: boolean;
  /** Bảng Giáo viên trường — hiện trong thẻ Chi Ngoài, ngay dưới bảng. */
  schoolTeacherSection?: ReactNode;
};

const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ExpenseFormTable({
  inputRows,
  revenueRows,
  managementRows,

  subjects,

  editingItem,
  loading,

  addRow,
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
  readOnly = false,
  managementConfirmed = false,
  managementReadOnly = false,
  canConfirmManagement = false,
  confirmingManagement = false,
  onConfirmManagement,
  managementConfirmedByName,
  managementConfirmedAt,
  isChief = false,
  managementPolicyLocked = false,
  managementSavedRowsOnly = false,
  managementDateSourceOnly = false,
  onUnconfirmManagement,
  finalized = false,
  finalizedByName,
  finalizedAt,
  onFinalize,
  onReopen,
  lockActionLoading = false,
  onExportInvoices,
  exportingInvoices = false,
  einvoices = [],
  onUnlinkEInvoice,
  unlinkingEInvoiceId = null,
  schoolName,
  schoolYear,
  collaboratorPayroll,
  teacherSplit = false,
  schoolTeacherSection,
}: Props) {
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const lockAllInvoices = () => {
    inputRows.forEach((_, idx) => updateInputRow(idx, "invoiceLocked", true));
  };

  const unlockAllInvoices = () => {
    inputRows.forEach((_, idx) => updateInputRow(idx, "invoiceLocked", false));
  };

  // Đã xuất hóa đơn thì không được thêm dòng (kế toán trưởng mở khóa lại mới thêm được).
  const invoiceExported = inputRows.some((row) => row.invoiceLocked);
  // Đã "Xuất hóa đơn tất cả" (mọi dòng khoá hóa đơn): khoá toàn bộ các bảng,
  // chỉ còn "Tổng thanh toán công ty" sửa được (19/11/2026).
  const allInvoiceLocked = isAllInvoiceLocked(inputRows);
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-800">Quản lý thu chi</h2>
      </div>

      {/*
        Đã "Kết thúc" → khoá mọi ô nhập/nút, trừ Ngày chi + Nguồn chi của Chi
        Trường / Chi Ngoài (các bảng tự khoá từng ô); sales admin khoá hẳn.
      */}
      <fieldset
        disabled={finalized && managementOnly}
        className="m-0 min-w-0 border-0 p-4 space-y-8"
      >
        {!managementOnly && (
          <>
            {/* DOANH THU */}
            <fieldset
              disabled={readOnly || allInvoiceLocked}
              className="m-0 min-w-0 space-y-3 border-0 p-0"
            >
              <RevenueExpenseTable
                inputRows={inputRows}
                rows={revenueRows}
                subjects={subjects}
                updateInputRow={updateInputRow}
                updateRow={updateRevenueRow}
                removeRow={removeRevenueRow}
                finalized={finalized}
                teacherSplit={teacherSplit}
                collaboratorPayroll={collaboratorPayroll}
              />
            </fieldset>

            {/* HÓA ĐƠN — nằm giữa Chi Trường và Chi Ngoài */}
            <fieldset
              disabled={finalized || readOnly}
              className="m-0 min-w-0 border-0 p-0 space-y-3"
            >
              <InvoiceTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                subjects={subjects}
                updateInputRow={updateInputRow}
                einvoices={einvoices}
                onExportInvoices={onExportInvoices}
                exportingInvoices={exportingInvoices}
                loading={loading}
                onUnlinkEInvoice={onUnlinkEInvoice}
                unlinkingEInvoiceId={unlinkingEInvoiceId}
                teacherSplit={teacherSplit}
                fullyLocked={allInvoiceLocked}
              />
            </fieldset>
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
            addRow={addManagementRow}
            showActions={!managementOnly}
            isConfirmed={managementConfirmed}
            readOnly={managementReadOnly || readOnly || allInvoiceLocked}
            canConfirm={canConfirmManagement}
            confirming={confirmingManagement}
            onConfirm={onConfirmManagement}
            confirmedByName={managementConfirmedByName}
            confirmedAt={managementConfirmedAt}
            policyLocked={managementPolicyLocked}
            savedRowsOnly={managementSavedRowsOnly}
            dateSourceOnly={managementDateSourceOnly}
            extraSection={schoolTeacherSection}
          />
        </div>
      </fieldset>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        {allInvoiceLocked && !managementOnly && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Lock size={16} className="text-amber-600" />
            <span className="font-bold">Đã xuất hóa đơn tất cả</span>
            <span>
              — mọi bảng đã khoá, chỉ sửa được 🏢 Tổng thanh toán công ty (nhớ
              bấm "Lưu tất cả"). Kế toán trưởng bấm "Mở khóa tất cả" để sửa lại.
            </span>
          </div>
        )}
        {finalized && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <Lock size={16} className="text-slate-600" />
            <span className="font-bold">Đã kết thúc</span>
            <span>
              {finalizedByName ? `— ${finalizedByName}` : ""}
              {finalizedAt ? ` lúc ${formatDateTime(finalizedAt)}` : ""}.{" "}
              {managementOnly
                ? "Toàn bộ dữ liệu đã khoá"
                : "Đã khoá toàn bộ, trừ Ngày chi và Nguồn chi của Chi Trường, Chi Ngoài"}
              ; chỉ kế toán trưởng mở lại được.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 justify-end">
          {!managementOnly && !readOnly && !finalized && (
            <button
              onClick={addRow}
              disabled={invoiceExported}
              title={
                invoiceExported
                  ? "Đã xuất hóa đơn — không thể thêm dòng"
                  : undefined
              }
              className="
                h-12 px-5 rounded-2xl
                bg-indigo-600
                text-white font-bold
                flex items-center gap-2
                hover:bg-indigo-700
                transition-all
                disabled:bg-slate-300
                disabled:text-slate-500
                disabled:cursor-not-allowed
              "
            >
              <Plus size={18} />
              <span>Thêm dòng doanh thu</span>
            </button>
          )}

          {!managementOnly && !readOnly && !finalized && (
            <button
              onClick={lockAllInvoices}
              disabled={exportingInvoices || allInvoiceLocked}
              className="
                h-12 px-5 rounded-2xl
                border border-amber-200
                bg-white
                text-amber-700 font-bold
                flex items-center gap-2
                hover:bg-amber-50
                transition-all
                disabled:opacity-60
              "
            >
              <Lock size={18} />
              <span>Xuất hóa đơn tất cả</span>
            </button>
          )}

          {!managementOnly && !readOnly && isChief && !finalized && (
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

          {!managementOnly && !readOnly && isChief && !finalized && (
            <button
              onClick={
                managementConfirmed ? onUnconfirmManagement : onConfirmManagement
              }
              disabled={lockActionLoading}
              className={`
                h-12 px-5 rounded-2xl
                border bg-white font-bold
                flex items-center gap-2
                transition-all
                disabled:opacity-60
                ${
                  managementConfirmed
                    ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    : "border-teal-300 text-teal-700 hover:bg-teal-50"
                }
              `}
            >
              {managementConfirmed ? (
                <Unlock size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              <span>
                {managementConfirmed ? "Mở khoá BBCS" : "Xác nhận đúng BBCS"}
              </span>
            </button>
          )}

          {!managementOnly && !readOnly && isChief && !finalized && !confirmFinalize && (
            <button
              onClick={() => setConfirmFinalize(true)}
              disabled={lockActionLoading}
              className="
                h-12 px-5 rounded-2xl
                bg-slate-800
                text-white font-bold
                flex items-center gap-2
                hover:bg-slate-900
                transition-all
                disabled:opacity-60
              "
            >
              <Flag size={18} />
              <span>Kết thúc</span>
            </button>
          )}

          {!managementOnly && !readOnly && isChief && !finalized && confirmFinalize && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2">
              <span className="text-sm text-slate-600">
                Nhớ Lưu trước — kết thúc xong sẽ khoá toàn bộ kỳ thu chi.
              </span>
              <button
                onClick={() => {
                  setConfirmFinalize(false);
                  onFinalize?.();
                }}
                disabled={lockActionLoading}
                className="h-9 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-60"
              >
                Xác nhận kết thúc
              </button>
              <button
                onClick={() => setConfirmFinalize(false)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
            </div>
          )}

          {!managementOnly && !readOnly && isChief && finalized && (
            <button
              onClick={onReopen}
              disabled={lockActionLoading}
              className="
                h-12 px-5 rounded-2xl
                border border-amber-300
                bg-white
                text-amber-700 font-bold
                flex items-center gap-2
                hover:bg-amber-50
                transition-all
                disabled:opacity-60
              "
            >
              <RotateCcw size={18} />
              <span>Mở lại</span>
            </button>
          )}

          {!readOnly && editingItem && !finalized && (
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

          {/* Kỳ đã kết thúc vẫn lưu được Ngày chi + Nguồn chi (trừ sales admin). */}
          {!readOnly && !(managementOnly && (managementReadOnly || finalized)) && (
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

          <ExpensePrintButton
            availableSections={
              managementOnly ? ["management"] : undefined
            }
            inputRows={inputRows}
            revenueRows={revenueRows}
            managementRows={managementRows}
            subject={subjects}
            schoolName={schoolName}
            schoolYear={schoolYear}
            teacherSplit={teacherSplit}
          />

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
