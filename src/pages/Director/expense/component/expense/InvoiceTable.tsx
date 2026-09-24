import { InputExpenseRow } from "../../RealExpenseDetail/type/InputExpenseRow";

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
};

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

/**
 * Hóa đơn của từng dòng doanh thu — tách khỏi bảng Doanh Thu, đặt giữa
 * Chi Trường và Chi Ngoài. Mỗi dòng tương ứng 1 dòng doanh thu (cùng index).
 */
/** Tổng đơn giá Chi trường (CSVC + giáo viên + thuế) của 1 dòng — không nhân HS/tháng. */
const schoolUnitPriceOf = (row: any, policyData: any) => {
  const teacherUnitPrice = Number(
    row?.teacherUnitPrice ?? row?.giaovien ?? policyData?.giaovien ?? 0,
  );
  const taxUnitPrice = Number(
    row?.taxUnitPrice ??
      row?.thue ??
      row?.tax ??
      policyData?.thue ??
      policyData?.tax ??
      0,
  );
  const csvcUnitPrice = Number(
    row?.csvcUnitPrice ?? row?.csvc ?? policyData?.csvc ?? 0,
  );
  return teacherUnitPrice + taxUnitPrice + csvcUnitPrice;
};

/**
 * Tổng thanh toán công ty của 1 dòng — tính theo ĐƠN GIÁ (không nhân HS/tháng),
 * tuỳ theo row.paymentType (Hình thức chi):
 * - 'not_in_contract' (Không có trong HĐ): = Đơn giá trên doanh thu (không trừ CSVC/GV/thuế).
 * - 'in_contract' hoặc rỗng/chưa chọn (mặc định, giữ hành vi cũ): = Đơn giá trên doanh thu - (ĐG CSVC + ĐG giáo viên + ĐG thuế).
 */
const companyPaymentOf = (
  revenueUnitPrice: number,
  row: any,
  policyData: any,
) => {
  if (row?.paymentType === "not_in_contract") {
    return revenueUnitPrice;
  }
  return revenueUnitPrice - schoolUnitPriceOf(row, policyData);
};

const formatVND = (value: number) => value.toLocaleString("vi-VN");

export default function InvoiceTable({
  inputRows,
  revenueRows = [],
  subjects,
  updateInputRow,
}: Props) {
  const policyData = subjects?.policies?.[0]?.data || {};

  const totalCompanyPayment = inputRows.reduce((sum, row, idx) => {
    const revenueUnitPrice = Number(row.unitPrice || 0);
    const companyUnitPayment = companyPaymentOf(
      revenueUnitPrice,
      revenueRows[idx],
      policyData,
    );
    return sum + Number(row.studentCount || 0) * companyUnitPayment;
  }, 0);

  return (
    <div className="rounded-2xl border border-amber-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
        <div>
          <h3 className="font-bold text-lg">🧾 Hóa Đơn</h3>
          <p className="text-sm text-amber-50">
            Xuất hóa đơn cho từng dòng doanh thu
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-50">Tổng thanh toán công ty</div>
          <div className="font-bold text-2xl">
            {formatVND(totalCompanyPayment)}đ
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1550px] border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm w-16">
                #
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm text-left">
                📄 Nội dung doanh thu
              </th>
              <th className="p-4 border border-slate-700 font-bold whitespace-nowrap text-sm">
                📄 HĐ
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
                📝 Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {inputRows.map((row, idx) => {
              const invoiceType =
                row.invoiceType || (row.invoiced ? "company" : "");
              // Đơn giá trên doanh thu - Đơn giá Chi trường của cùng dòng
              const revenueUnitPrice = Number(row.unitPrice || 0);
              const companyPayment = companyPaymentOf(
                revenueUnitPrice,
                revenueRows[idx],
                policyData,
              );

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
                    <div className="space-y-2">
                      <select
                        value={invoiceType}
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
                        className="w-full h-14 border rounded-lg px-2 text-sm bg-white"
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

                      {invoiceType === "other" && (
                        <input
                          value={row.invoiceOther || ""}
                          onChange={(e) =>
                            updateInputRow(idx, "invoiceOther", e.target.value)
                          }
                          placeholder="Nhập HĐ khác"
                          className="w-full h-11 border rounded-lg px-2 text-sm"
                        />
                      )}
                    </div>
                  </td>

                  <td className="border p-2">
                    <input
                      value={row.invoiceUnit || ""}
                      maxLength={50}
                      onChange={(e) =>
                        updateInputRow(idx, "invoiceUnit", e.target.value)
                      }
                      placeholder="ĐVT"
                      className="w-full h-14 border rounded-lg px-2 text-sm text-center"
                    />
                  </td>

                  <td className="border p-2 bg-slate-50">
                    <input
                      readOnly
                      value={Number(row.studentCount) || 0}
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
                      value={formatVND(
                        Number(row.studentCount || 0) * companyPayment,
                      )}
                      className="w-full h-14 text-center border rounded-lg text-sm font-bold text-emerald-700"
                    />
                  </td>

                  <td className="border p-2">
                    {invoiceType === "company" ? (
                      <input
                        value={row.invoiceNumber || ""}
                        maxLength={100}
                        onChange={(e) =>
                          updateInputRow(idx, "invoiceNumber", e.target.value)
                        }
                        placeholder="Nhập số hóa đơn"
                        className="w-full h-14 border rounded-lg px-3 text-sm font-semibold"
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
                      onChange={(e) =>
                        updateInputRow(idx, "invoiceDate", e.target.value)
                      }
                      className="w-full h-14 border rounded-lg px-2 text-sm"
                    />
                  </td>

                  <td className="border p-2 bg-violet-50">
                    <input
                      readOnly
                      value={formatVND(
                        Number(row.studentCount || 0) * companyPayment,
                      )}
                      className="w-full h-14 text-center font-bold text-violet-700 border rounded-lg text-sm"
                    />
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
