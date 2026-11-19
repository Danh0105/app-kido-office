import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";
import CashAccountSelect from "./CashAccountSelect";
import DecimalInput from "@/components/DecimalInput";
import type {
  RevenueEInvoice,
  RevenueEInvoiceLine,
} from "@/service/schoolExpense";
import { calculateRevenueQuantity, companyPaymentOf } from "@/utils/revenueAmount";
import { rowTeacherUnitPrice } from "../../utils/policyOtherCosts";

type Props = {
  inputRows: InputExpenseRow[];
  /** Dòng Chi Trường tương ứng theo index — để tính Tổng thanh toán công ty */
  revenueRows?: any[];
  subjects?: any;
  updateInputRow: (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => void;
  /** Hóa đơn điện tử (nháp Viettel) của môn — mỗi hóa đơn gộp nhiều dòng. */
  einvoices?: RevenueEInvoice[];
  /**
   * "Đẩy hóa đơn": lưu rồi gộp các dòng "Xuất HĐ Cty" chưa có hóa đơn thành 1
   * hóa đơn nháp Viettel. Không truyền thì ẩn nút.
   */
  onExportInvoices?: () => void;
  exportingInvoices?: boolean;
  /** Đang lưu/tải dữ liệu — tạm khóa nút. */
  loading?: boolean;
  /** KTT "Bỏ liên kết nháp" (đã xóa nháp trên portal Viettel). Không truyền thì ẩn. */
  onUnlinkEInvoice?: (einvoice: RevenueEInvoice) => void;
  /** Hóa đơn đang được bỏ liên kết. */
  unlinkingEInvoiceId?: number | null;
  /** Môn đã có tiền ở bảng Giáo viên trường thì Chi Trường không tính lại GV. */
  teacherSplit?: boolean;
};

const invoiceTypeOf = (row: InputExpenseRow) =>
  row.invoiceType || (row.invoiced ? "company" : "");

export const invoiceOptions: {
  label: string;
  value: InputExpenseRow["invoiceType"];
}[] = [
  { label: "Chọn", value: "" },
  { label: "Xuất HĐ Cty", value: "company" },
  { label: "Xuất HĐ HS", value: "student" },
  { label: "Không xuất HĐ", value: "none" },
  { label: "Khác", value: "other" },
];

const isInvoiceIssued = (value: InputExpenseRow["invoiceType"]) =>
  value === "company" || value === "student" || value === "other";

const formatVND = (value: number) => value.toLocaleString("vi-VN");

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Hóa đơn chứa dòng (theo rowIndex) — ưu tiên nháp đã tạo hơn lần đẩy lỗi. */
const einvoiceLinesByRow = (einvoices: RevenueEInvoice[]) => {
  const byRow = new Map<
    number,
    { einvoice: RevenueEInvoice; line: RevenueEInvoiceLine }
  >();
  for (const einvoice of einvoices) {
    // BE bản cũ (mỗi dòng 1 hóa đơn) không trả `lines` — bỏ qua thay vì làm sập trang.
    for (const line of einvoice.lines ?? []) {
      const current = byRow.get(line.rowIndex);
      if (!current || current.einvoice.status !== "DRAFT_CREATED") {
        byRow.set(line.rowIndex, { einvoice, line });
      }
    }
  }
  return byRow;
};

/** Trạng thái hóa đơn nháp Viettel của 1 dòng "Xuất HĐ Cty". */
function EInvoiceStatus({
  einvoice,
  line,
  currentAmount,
  onUnlink,
  unlinking = false,
}: {
  einvoice: RevenueEInvoice;
  line: RevenueEInvoiceLine;
  /** Thành tiền hiện tại của dòng — so với số đã gửi Viettel. */
  currentAmount: number;
  /** Chỉ truyền ở dòng đầu của hóa đơn — mỗi hóa đơn 1 nút. */
  onUnlink?: () => void;
  unlinking?: boolean;
}) {
  if (einvoice.status === "DRAFT_CREATED") {
    const changed = Math.round(currentAmount) !== Number(line.amount);
    return (
      <div className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
        <div className="font-bold">✓ Đã tạo nháp HĐĐT (Viettel)</div>
        <div>
          {formatVND(Number(line.amount))}đ
          {(einvoice.lines?.length ?? 0) > 1
            ? ` · HĐ gộp ${einvoice.lines.length} dòng`
            : ""}
          {einvoice.draftedAt ? ` · ${formatDateTime(einvoice.draftedAt)}` : ""}
        </div>
        {changed && (
          <div className="mt-1 whitespace-normal font-semibold text-amber-700">
            ⚠ Thành tiền đã đổi so với nháp — sửa nháp trên portal Viettel
          </div>
        )}
        {onUnlink && (
          <button
            type="button"
            onClick={onUnlink}
            disabled={unlinking}
            title="Dùng khi đã xóa hóa đơn nháp này trên portal Viettel"
            className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {unlinking && <Loader2 size={12} className="animate-spin" />}
            Bỏ liên kết nháp
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 whitespace-normal"
      title={einvoice.errorCode ?? undefined}
    >
      <div className="font-bold">✗ Chưa xuất được HĐĐT</div>
      <div>{einvoice.errorMessage}</div>
    </div>
  );
}

/**
 * Hóa đơn của từng dòng doanh thu — tách khỏi bảng Doanh Thu, đặt giữa
 * Chi Trường và Chi Ngoài. Mỗi dòng tương ứng 1 dòng doanh thu (cùng index).
 */
export default function InvoiceTable({
  inputRows,
  revenueRows = [],
  subjects,
  updateInputRow,
  einvoices = [],
  onExportInvoices,
  exportingInvoices = false,
  loading = false,
  onUnlinkEInvoice,
  unlinkingEInvoiceId = null,
  teacherSplit = false,
}: Props) {
  const [confirmExport, setConfirmExport] = useState(false);
  const policyData = subjects?.policies?.[0]?.data || {};
  const einvoiceByRow = einvoiceLinesByRow(einvoices);

  const schoolRowOf = (idx: number) => ({
    ...(revenueRows[idx] || {}),
    // ĐG giáo viên của dòng Chi Trường (tính cả khi môn có bảng Giáo viên trường).
    teacherUnitPrice: rowTeacherUnitPrice(revenueRows[idx], policyData),
  });

  const rowAmountOf = (row: InputExpenseRow, idx: number) =>
    calculateRevenueQuantity(row) *
    companyPaymentOf(Number(row.unitPrice || 0), schoolRowOf(idx), policyData);

  const totalCompanyPayment = inputRows.reduce(
    (sum, row, idx) => sum + rowAmountOf(row, idx),
    0,
  );

  // Dòng "Xuất HĐ Cty" chưa nằm trong nháp nào — sẽ lên chung 1 hóa đơn khi đẩy.
  const pendingRows = inputRows.filter(
    (row, idx) =>
      invoiceTypeOf(row) === "company" &&
      rowAmountOf(row, idx) > 0 &&
      einvoiceByRow.get(idx)?.einvoice.status !== "DRAFT_CREATED",
  ).length;
  const hasCompanyRows = inputRows.some(
    (row) => invoiceTypeOf(row) === "company",
  );

  /**
   * Các dòng "Xuất HĐ Cty" lên chung 1 hóa đơn → nhập Số HĐ ở dòng trên thì
   * điền luôn các dòng dưới đang trống hoặc đang giống dòng trên (dòng đã nhập
   * số khác, hoặc thuộc hóa đơn nháp khác, thì giữ nguyên).
   */
  const updateSharedInvoiceNumber = (idx: number, value: string) => {
    const field = "invoiceNumber";
    const previous = inputRows[idx][field] || "";
    updateInputRow(idx, field, value);
    if (invoiceTypeOf(inputRows[idx]) !== "company") return;

    const sourceInvoice = einvoiceByRow.get(idx)?.einvoice;
    inputRows.forEach((row, i) => {
      if (i <= idx || row.invoiceLocked) return;
      if (invoiceTypeOf(row) !== "company") return;
      const targetInvoice = einvoiceByRow.get(i)?.einvoice;
      if (
        sourceInvoice &&
        targetInvoice &&
        sourceInvoice.id !== targetInvoice.id
      ) {
        return;
      }
      const current = row[field] || "";
      if (current === "" || current === previous) {
        updateInputRow(i, field, value);
      }
    });
  };

  /**
   * Ngày xuất đồng bộ cho mọi dòng: nhập ở dòng nào cũng ghi cho tất cả dòng
   * (mọi loại HĐ, cả trên lẫn dưới), trừ dòng đã khoá do bấm "Xuất hóa đơn".
   */
  const updateInvoiceDate = (value: string) => {
    inputRows.forEach((row, i) => {
      if (!row.invoiceLocked) updateInputRow(i, "invoiceDate", value);
    });
  };

  return (
    <div className="rounded-2xl border border-amber-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
        <div>
          <h3 className="font-bold text-lg">🧾 Hóa Đơn</h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          {onExportInvoices && !confirmExport && (
            <button
              type="button"
              onClick={() => setConfirmExport(true)}
              disabled={exportingInvoices || loading || pendingRows === 0}
              title={
                pendingRows > 0
                  ? undefined
                  : hasCompanyRows
                    ? 'Các dòng "Xuất HĐ Cty" đều đã có hóa đơn nháp'
                    : 'Chưa có dòng "Xuất HĐ Cty" để đẩy hóa đơn'
              }
              className="h-11 px-4 rounded-xl bg-white text-orange-600 font-bold flex items-center gap-2 shadow-sm hover:bg-orange-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingInvoices ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              <span>
                {exportingInvoices ? "Đang đẩy hóa đơn..." : "Đẩy hóa đơn"}
              </span>
              {pendingRows > 0 && !exportingInvoices && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs">
                  {pendingRows} dòng
                </span>
              )}
            </button>
          )}

          {onExportInvoices && confirmExport && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
              <span className="text-sm">
                Lưu và gộp {pendingRows} dòng "Xuất HĐ Cty" thành 1 hóa đơn
                nháp trên Viettel (bên mua là trường).
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmExport(false);
                  onExportInvoices();
                }}
                disabled={exportingInvoices || loading}
                className="h-9 px-4 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-60"
              >
                Xác nhận đẩy
              </button>
              <button
                type="button"
                onClick={() => setConfirmExport(false)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
            </div>
          )}

          <div className="text-right">
            <div className="text-xs text-amber-50">Tổng thanh toán công ty</div>
            <div className="font-bold text-2xl">
              {formatVND(totalCompanyPayment)}đ
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[2300px] border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm w-16">
                #
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm text-left">
                📄 Nội dung doanh thu
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📏 ĐVT
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🔢 Số lượng
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                💵 Đơn giá
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                💰 Thành tiền
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🔢 Số HĐ
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📆 Ngày xuất
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🏢 Tổng thanh toán công ty
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📅 Ngày chi
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                🏦 Khoản thu/chi
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                ↔️ Thu/Chi
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                💸 Số tiền thu/chi
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📄 HĐ
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📝 Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {inputRows.map((row, idx) => {
              const invoiceType = invoiceTypeOf(row);
              const rowEInvoice = einvoiceByRow.get(idx);
              // Đã bấm "Xuất hóa đơn" → khoá thông tin hóa đơn (Ngày chi,
              // Khoản thu/chi và Ghi chú vẫn sửa được).
              const locked = !!row.invoiceLocked;
              // Đơn giá trên doanh thu - Đơn giá Chi trường của cùng dòng
              const revenueUnitPrice = Number(row.unitPrice || 0);
              const companyPayment = companyPaymentOf(
                revenueUnitPrice,
                schoolRowOf(idx),
                policyData,
              );
              const invoiceQuantity = calculateRevenueQuantity(row);

              return (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="border p-3 text-center font-semibold text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="border p-3 text-sm text-slate-700">
                    {row.content || (
                      <span className="text-slate-400 italic">
                        (Chưa nhập nội dung)
                      </span>
                    )}
                  </td>

                  <td className="border p-2">
                    <input
                      value={row.invoiceUnit || ""}
                      maxLength={50}
                      disabled={locked}
                      onChange={(e) =>
                        updateInputRow(idx, "invoiceUnit", e.target.value)
                      }
                      placeholder="ĐVT"
                      className="w-full h-14 border rounded-lg px-2 text-sm text-center disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-2 bg-slate-50">
                    <input
                      readOnly
                      value={invoiceQuantity}
                      className="w-full h-14 text-center border rounded-lg text-sm font-semibold"
                    />
                  </td>

                  <td className="border p-2 bg-slate-50">
                    <input
                      readOnly
                      value={formatVND(companyPayment)}
                      className="w-full h-14 text-center border rounded-lg text-sm font-semibold"
                    />
                  </td>

                  <td className="border p-2 bg-emerald-50">
                    <input
                      readOnly
                      value={formatVND(invoiceQuantity * companyPayment)}
                      className="w-full h-14 text-center border rounded-lg text-sm font-bold text-emerald-700"
                    />
                  </td>

                  <td className="border p-2">
                    {invoiceType === "company" ? (
                      <input
                        value={row.invoiceNumber || ""}
                        maxLength={100}
                        disabled={locked}
                        onChange={(e) =>
                          updateSharedInvoiceNumber(idx, e.target.value)
                        }
                        placeholder="Nhập số hóa đơn"
                        className="w-full h-14 border rounded-lg px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    ) : (
                      <div className="h-14 flex items-center justify-center text-slate-300">
                        —
                      </div>
                    )}
                  </td>

                  <td className="border p-2">
                    <input
                      type="date"
                      value={row.invoiceDate}
                      disabled={locked}
                      onChange={(e) => updateInvoiceDate(e.target.value)}
                      className="w-full h-14 border rounded-lg px-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>

                  <td className="border p-2 bg-violet-50">
                    <input
                      readOnly
                      value={formatVND(invoiceQuantity * companyPayment)}
                      className="w-full h-14 text-center font-bold text-violet-700 border rounded-lg text-sm"
                    />
                  </td>

                  <td className="border p-2">
                    <input
                      type="date"
                      value={row.invoicePaymentDate || ""}
                      onChange={(e) =>
                        updateInputRow(idx, "invoicePaymentDate", e.target.value)
                      }
                      className="w-full h-14 border rounded-lg px-2 text-sm"
                    />
                  </td>

                  <td className="border p-2">
                    <CashAccountSelect
                      value={row.invoiceCashAccount}
                      onChange={(value) =>
                        updateInputRow(idx, "invoiceCashAccount", value)
                      }
                      className="w-full min-w-[230px] h-14 border rounded-lg px-2 text-sm bg-white"
                    />
                  </td>

                  {/* Thu vào hay chi ra khỏi tài khoản ở cột "Khoản thu/chi" — tuỳ dòng */}
                  <td className="border p-2">
                    <select
                      value={row.invoiceCashDirection || ""}
                      onChange={(e) =>
                        updateInputRow(
                          idx,
                          "invoiceCashDirection",
                          e.target.value as InputExpenseRow["invoiceCashDirection"],
                        )
                      }
                      className="w-full min-w-[100px] h-14 border rounded-lg px-2 text-sm bg-white"
                    >
                      <option value="">Chọn</option>
                      <option value="IN">Thu</option>
                      <option value="OUT">Chi</option>
                    </select>
                  </td>

                  {/* Số tiền thực thu/chi — báo cáo thu chi lấy đúng số này */}
                  <td className="border p-2">
                    <DecimalInput
                      value={row.invoiceCashAmount}
                      onValueChange={(value) =>
                        updateInputRow(idx, "invoiceCashAmount", value)
                      }
                      placeholder="0"
                      allowDecimal={false}
                      className="w-full min-w-[150px] h-14 text-center font-bold border rounded-lg text-sm"
                    />
                  </td>

                  <td className="border p-2">
                    <div className="space-y-2">
                      <select
                        value={invoiceType}
                        disabled={locked}
                        onChange={(e) => {
                          const value = e.target
                            .value as InputExpenseRow["invoiceType"];

                          updateInputRow(idx, "invoiceType", value);
                          updateInputRow(idx, "invoiced", isInvoiceIssued(value));

                          if (value !== "other") {
                            updateInputRow(idx, "invoiceOther", "");
                          }
                          if (value !== "company") {
                            updateInputRow(idx, "invoiceNumber", "");
                          }
                        }}
                        className="w-full h-14 border rounded-lg px-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {invoiceOptions.map((option) => (
                          <option
                            key={option.value || "empty"}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {invoiceType === "company" && rowEInvoice && (
                        <EInvoiceStatus
                          einvoice={rowEInvoice.einvoice}
                          line={rowEInvoice.line}
                          currentAmount={invoiceQuantity * companyPayment}
                          onUnlink={
                            onUnlinkEInvoice &&
                            rowEInvoice.einvoice.lines[0]?.rowIndex === idx
                              ? () => onUnlinkEInvoice(rowEInvoice.einvoice)
                              : undefined
                          }
                          unlinking={
                            unlinkingEInvoiceId === rowEInvoice.einvoice.id
                          }
                        />
                      )}

                      {invoiceType === "other" && (
                        <input
                          value={row.invoiceOther || ""}
                          disabled={locked}
                          onChange={(e) =>
                            updateInputRow(idx, "invoiceOther", e.target.value)
                          }
                          placeholder="Nhập HĐ khác"
                          className="w-full h-11 border rounded-lg px-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      )}
                    </div>
                  </td>

                  <td className="border p-2">
                    <input
                      value={row.invoiceNote || ""}
                      maxLength={500}
                      onChange={(e) =>
                        updateInputRow(
                          idx,
                          "invoiceNote",
                          e.target.value.slice(0, 500),
                        )
                      }
                      placeholder="Ghi chú..."
                      className="w-full h-14 border rounded-lg px-2 text-sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
