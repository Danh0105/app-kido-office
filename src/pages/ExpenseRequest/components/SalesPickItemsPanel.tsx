import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";

import DecimalInput from "@/components/DecimalInput";
import { expenseRequestApi } from "@/service/expenseRequest";
import {
  CASHFLOW_ITEM_STATUS_META,
  SALES_PICK_SOURCE_META,
  type ExpenseCashflowItem,
  type ExpenseCashflowItemsResponse,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import type { MonthlyApprovalView } from "./ManagementExpenseView";

const money = (value: number | null | undefined) =>
  `${formatVnd(Number(value ?? 0)) || "0"} đ`;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Gợi ý ban đầu: điền lần lượt từng khoản tối đa Còn chi cho tới hết số kinh doanh đề xuất. */
function suggestAmounts(items: ExpenseCashflowItem[], cap: number | null) {
  let left = cap ?? Number.POSITIVE_INFINITY;
  const result: Record<number, number> = {};
  for (const item of items) {
    if (item.id == null) continue;
    const max = Math.max(0, Number(item.maxAmount ?? item.remainingAmount) || 0);
    const amount = round2(Math.max(0, Math.min(max, left)));
    result[item.id] = amount;
    left = round2(left - amount);
  }
  return result;
}

/**
 * "Đề xuất chi tháng" tích chọn: các khoản kinh doanh đã chọn (Chi trường /
 * Chi Ban quản lí / Chi giáo viên) với số hiện tại ở QL thu chi. Ở bước Kế
 * toán, người nhập (Kế toán / Kế toán công nợ / Kế toán trưởng) nhập số tiền
 * từng khoản — mỗi khoản ≤ Còn chi, tổng ≤ số kinh doanh đề xuất — rồi gửi
 * Giám đốc. Báo số cho hộp duyệt của Giám đốc qua `onLoaded`.
 */
export default function SalesPickItemsPanel({
  requestId,
  reloadKey,
  onLoaded,
  canEnterAmounts = false,
  onSubmitted,
}: {
  requestId: number;
  /** Đổi để tải lại (sau mỗi bước xử lý). */
  reloadKey?: unknown;
  onLoaded?: (view: MonthlyApprovalView | null) => void;
  /** Người xem đang giữ bước nhập số tiền. */
  canEnterAmounts?: boolean;
  /** Gửi Giám đốc xong — trang chi tiết tải lại đề xuất. */
  onSubmitted?: () => void;
}) {
  const [data, setData] = useState<ExpenseCashflowItemsResponse | null>(null);
  const [error, setError] = useState("");
  const [amounts, setAmounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setError("");
    setData(null);
    onLoaded?.(null);
    expenseRequestApi
      .getCashflowItems(requestId)
      .then((response) => {
        setData(response);
        setAmounts(
          suggestAmounts(response.items, response.salesAmount ?? null)
        );
        const amountOf = (item: ExpenseCashflowItem) =>
          Number(item.requestedAmount ?? 0);
        onLoaded?.({
          remainingTotal: round2(
            response.items
              .filter((item) => !item.excluded)
              .reduce((sum, item) => sum + amountOf(item), 0)
          ),
          itemAmounts: new Map(
            response.items
              .filter((item) => item.id != null)
              .map((item) => [item.id as number, amountOf(item)])
          ),
        });
      })
      .catch((err) => {
        setError(
          err?.response?.status === 403
            ? err?.response?.data?.message || "Bạn không xem được số liệu này"
            : "Không tải được khoản chi của đề xuất"
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const items = data?.items ?? [];
  const salesAmount = data?.salesAmount ?? null;
  const enteredTotal = round2(
    items.reduce(
      (sum, item) => sum + (item.id != null ? Number(amounts[item.id] ?? 0) : 0),
      0
    )
  );
  const overItem = items.find(
    (item) =>
      item.id != null &&
      Number(amounts[item.id] ?? 0) >
        Number(item.maxAmount ?? item.remainingAmount) + 0.005
  );
  const overTotal = salesAmount != null && enteredTotal > salesAmount + 0.005;
  const lockedTotal = round2(
    items
      .filter((item) => !item.excluded)
      .reduce((sum, item) => sum + Number(item.requestedAmount ?? 0), 0)
  );
  const entering = canEnterAmounts && !!data;

  const submit = async () => {
    if (!data) return;
    if (overItem) {
      toast.error(`${overItem.label}: số tiền vượt Còn chi`);
      return;
    }
    if (overTotal) {
      toast.error("Tổng số tiền vượt số kinh doanh đề xuất");
      return;
    }
    if (!(enteredTotal > 0)) {
      toast.error("Nhập số tiền cho ít nhất một khoản");
      return;
    }
    const zero = items.filter(
      (item) => item.id != null && !(Number(amounts[item.id] ?? 0) > 0)
    );
    if (
      !window.confirm(
        `Gửi Giám đốc duyệt ${money(enteredTotal)}?` +
          (zero.length
            ? `\n${zero.length} khoản nhập 0 sẽ bị bỏ khỏi đề xuất.`
            : "")
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await expenseRequestApi.submitAmounts(
        requestId,
        items
          .filter((item) => item.id != null)
          .map((item) => ({
            id: item.id as number,
            amount: Number(amounts[item.id as number] ?? 0),
          })),
        note.trim() || undefined
      );
      toast.success("Đã gửi Giám đốc duyệt");
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gửi thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-indigo-700">
          🗂️ Khoản chi tháng kinh doanh đã chọn
        </h3>
        <p className="text-xs text-slate-500">
          {entering
            ? "Nhập số tiền từng khoản (không vượt Còn chi của khoản, tổng không vượt số kinh doanh đề xuất; nhập 0 = bỏ khoản) rồi gửi Giám đốc duyệt."
            : "Số hiện tại ở QL thu chi. Khi kinh doanh xác nhận đã chi, Đã chi, Ngày chi, Nguồn chi tự ghi về đúng bảng của từng khoản."}
        </p>
        {entering && data?.items?.[0] && (
          <Link
            to={`/director/real-expense/${data.items[0].schoolId ?? ""}`}
            className="mt-1 inline-block text-xs font-medium text-indigo-600 underline"
          >
            Mở QL thu chi của trường →
          </Link>
        )}
      </div>
      {error ? (
        <p className="text-xs text-slate-500">{error}</p>
      ) : !data ? (
        <p className="text-xs text-slate-400">Đang tải…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">Kinh doanh đề xuất</p>
              <p className="font-semibold tabular-nums text-slate-800">
                {salesAmount != null ? money(salesAmount) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">Tổng Còn chi các khoản</p>
              <p className="font-semibold tabular-nums text-orange-600">
                {money(data.pickedRemainingTotal ?? 0)}
              </p>
            </div>
          </div>
          {!!data.hiddenItemCount && (
            <p className="text-[11px] text-slate-500">
              {data.hiddenItemCount} khoản Chi giáo viên ẩn (bạn không xem được
              lương giáo viên trường).
            </p>
          )}
          {items.length === 0 && (
            <p className="text-xs text-slate-500">Đề xuất chưa có khoản chi.</p>
          )}
          <ul className="space-y-1.5">
            {items.map((item) => {
              const status = CASHFLOW_ITEM_STATUS_META[item.status];
              const kind = item.source ? SALES_PICK_SOURCE_META[item.source] : null;
              const max = Number(item.maxAmount ?? item.remainingAmount) || 0;
              const value = item.id != null ? Number(amounts[item.id] ?? 0) : 0;
              return (
                <li
                  key={item.id ?? item.label}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    item.excluded
                      ? "border-gray-200 bg-gray-50 opacity-70"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    {kind && (
                      <span className="rounded-full bg-indigo-50 px-1.5 py-[1px] text-[10px] font-medium text-indigo-700">
                        {kind.icon} {kind.label}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      {item.label.replace(/^[^·]*· /, kind ? "" : "$&")}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {item.excluded && (
                      <span className="rounded-full bg-gray-100 px-1.5 py-[1px] text-[10px] text-gray-600">
                        Giám đốc không duyệt
                      </span>
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-gray-500">
                    <span>
                      Phải chi
                      <br />
                      <b className="text-gray-800">{money(item.totalAmount)}</b>
                    </span>
                    <span>
                      Đã chi
                      <br />
                      <b className="text-gray-800">{money(item.paidAmount)}</b>
                    </span>
                    <span>
                      Còn lại
                      <br />
                      <b className="text-orange-600">
                        {money(Math.max(0, item.remainingAmount))}
                      </b>
                    </span>
                  </div>
                  {entering && item.id != null ? (
                    <div className="mt-1.5">
                      <label className="text-[11px] text-gray-600">
                        Số tiền chi (tối đa {money(max)})
                      </label>
                      <DecimalInput
                        value={value}
                        onValueChange={(next) =>
                          setAmounts((current) => ({
                            ...current,
                            [item.id as number]: Number(next) || 0,
                          }))
                        }
                        className={`mt-0.5 w-full rounded-lg border px-3 py-1.5 text-sm ${
                          value > max + 0.005 ? "border-red-300" : ""
                        }`}
                        placeholder="0"
                        allowDecimal={false}
                        keepZero
                      />
                      {value > max + 0.005 && (
                        <p className="mt-0.5 text-[11px] text-red-600">
                          Vượt Còn chi của khoản ({money(max)})
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                      {item.requestedAmount != null && (
                        <span>Kế toán nhập: {money(item.requestedAmount)}</span>
                      )}
                      {item.approvedAmount != null && (
                        <span>Giám đốc duyệt: {money(item.approvedAmount)}</span>
                      )}
                      {item.paidBySuggest > 0 && (
                        <span className="font-medium text-emerald-700">
                          Đề xuất này đã ghi: {money(item.paidBySuggest)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {entering ? (
            <div className="space-y-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <div className="flex justify-between">
                <span>Tổng Kế toán nhập</span>
                <b className={overTotal ? "text-red-600" : ""}>
                  {money(enteredTotal)}
                  {salesAmount != null ? ` / ${money(salesAmount)}` : ""}
                </b>
              </div>
              {overTotal && (
                <p className="text-red-600">
                  Tổng vượt số kinh doanh đề xuất ({money(salesAmount)})
                </p>
              )}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Ghi chú (không bắt buộc)"
                className="w-full rounded-lg border border-indigo-100 bg-white px-2 py-1.5 text-sm text-gray-800"
              />
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !!overItem || overTotal || !(enteredTotal > 0)}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Đang gửi…" : "Gửi Giám đốc duyệt"}
              </button>
            </div>
          ) : (
            <div className="flex justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <span>Số tiền Kế toán nhập</span>
              <b>{lockedTotal > 0 ? money(lockedTotal) : "Chưa nhập"}</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}
