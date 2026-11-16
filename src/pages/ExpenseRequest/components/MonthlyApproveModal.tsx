import { useMemo, useState } from "react";

import type { ExpenseMonthlyItem } from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import { monthlyItemLabel } from "../lib";

const money = (value: number) => `${formatVnd(value) || "0"} đ`;

/**
 * Giám đốc duyệt chi tháng, không nhập số tiền. Đề xuất nhiều trường thì bỏ
 * tích được trường không duyệt: lệnh chi chỉ tính Còn chi của trường được
 * duyệt, bỏ trường thì phải ghi lý do. Đã có lệnh chi do Kế toán lập thì giữ
 * số đó, không chọn trường.
 */
export default function MonthlyApproveModal({
  items,
  itemAmounts,
  remainingTotal,
  existingAmount,
  canSeeTable,
  loading,
  onClose,
  onSubmit,
  tableLabel = "Chi Ngoài",
  title = "Duyệt đề xuất chi tháng",
  chain = false,
}: {
  /**
   * Quy trình Kế toán: số tiền là số Kế toán chốt lúc gửi; duyệt xong chuyển
   * Kế toán công nợ lập lệnh chi (không lập lệnh chi ngay).
   */
  chain?: boolean;
  /** Bảng nguồn ở QL thu chi: Chi Ngoài / Chi Trường / Giáo viên trường. */
  tableLabel?: string;
  title?: string;
  items: ExpenseMonthlyItem[];
  /** Còn chi hiện tại của từng dòng (theo id); null khi chưa tải được bảng. */
  itemAmounts: Map<number, number> | null;
  remainingTotal: number | null;
  existingAmount: number | null;
  canSeeTable: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: { note?: string; approvedItemIds?: number[] }) => void;
}) {
  const selectable = existingAmount == null && items.length >= 2;
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(items.map((item) => Number(item.id)))
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const excluded = selectable ? items.length - checked.size : 0;
  // Một trường nhiều môn thì mỗi dòng là một môn — đếm theo môn cho khỏi lệch.
  const unit =
    new Set(items.map((item) => item.schoolId)).size === items.length
      ? "trường"
      : "môn";

  const total = useMemo(() => {
    if (!selectable) return remainingTotal;
    if (!itemAmounts) return null;
    return items
      .filter((item) => checked.has(Number(item.id)))
      .reduce((sum, item) => sum + (itemAmounts.get(Number(item.id)) ?? 0), 0);
  }, [selectable, remainingTotal, itemAmounts, items, checked]);

  const toggle = (id: number) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    if (selectable && checked.size === 0)
      return setError("Phải duyệt ít nhất một trường — muốn bỏ hết thì bấm Từ chối");
    if (excluded > 0 && !note.trim())
      return setError("Ghi lý do không duyệt các trường bỏ chọn");
    if (existingAmount == null && total != null && total <= 0)
      return setError("Các trường được chọn không còn khoản nào cần chi (Còn chi = 0)");
    setError("");
    onSubmit({
      note: note.trim() || undefined,
      approvedItemIds:
        excluded > 0
          ? items
              .map((item) => Number(item.id))
              .filter((id) => checked.has(id))
          : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {existingAmount != null ? (
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">
              Chi theo lệnh chi Kế toán đã lập: <b>{money(existingAmount)}</b>
            </div>
          ) : (
            <>
              {selectable && (
                <>
                  <p className="text-sm text-gray-600">
                    Bỏ tích {unit} <b>không duyệt</b>.{" "}
                    {chain
                      ? "Số duyệt chỉ tính các khoản được duyệt."
                      : "Lệnh chi chỉ tính Còn chi của các trường được duyệt."}
                  </p>
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const id = Number(item.id);
                      const on = checked.has(id);
                      const amount = itemAmounts?.get(id);
                      return (
                        <li key={id}>
                          <label
                            className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                              on
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-gray-200 bg-gray-50 opacity-70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={on}
                              onChange={() => toggle(id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-800">
                                {item.school?.name || `Trường #${item.schoolId}`}
                              </span>
                              <span className="block text-xs text-gray-500">
                                {monthlyItemLabel(item)}
                              </span>
                            </span>
                            {amount != null && (
                              <span
                                className={`shrink-0 text-sm font-semibold ${
                                  on ? "text-gray-800" : "text-gray-400 line-through"
                                }`}
                              >
                                {money(amount)}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <div
                className={`rounded-xl border p-3 text-sm ${
                  total != null && total <= 0
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-emerald-100 bg-emerald-50 text-emerald-800"
                }`}
              >
                {total == null ? (
                  canSeeTable
                    ? `Đang tính số tiền từ bảng ${tableLabel}…`
                    : `Lệnh chi sẽ được lập bằng tổng cột Còn chi của bảng ${tableLabel} các trường được duyệt.`
                ) : total <= 0 ? (
                  "Các trường được chọn không còn khoản nào cần chi (Còn chi = 0) nên chưa duyệt được."
                ) : chain ? (
                  <>
                    Duyệt <b>{money(total)}</b> (số Kế toán chốt
                    {excluded > 0
                      ? ` của ${checked.size}/${items.length} ${unit} được duyệt`
                      : ` của bảng ${tableLabel}`}
                    ), chuyển Kế toán công nợ lập lệnh chi.
                  </>
                ) : (
                  <>
                    Lệnh chi sẽ được lập với số tiền <b>{money(total)}</b>{" "}
                    (tổng cột Còn chi
                    {excluded > 0
                      ? ` của ${checked.size}/${items.length} ${unit} được duyệt`
                      : ` của bảng ${tableLabel}`}
                    ), chuyển Thủ quỹ xuất tiền.
                  </>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-gray-600">
              {excluded > 0 ? (
                <>
                  Lý do không duyệt các trường bỏ chọn{" "}
                  <span className="text-red-500">*</span>
                </>
              ) : (
                "Ghi chú duyệt (không bắt buộc)"
              )}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder={excluded > 0 ? "VD: TH C chưa xác nhận lớp" : "Không bắt buộc"}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-60"
          >
            {loading
              ? "Đang duyệt…"
              : excluded > 0
              ? `Duyệt ${checked.size}/${items.length} ${unit}`
              : "Duyệt và chuyển Thủ quỹ"}
          </button>
        </div>
      </div>
    </div>
  );
}
