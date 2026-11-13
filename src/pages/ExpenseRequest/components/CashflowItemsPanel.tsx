import { useCallback, useEffect, useState } from "react";

import { expenseRequestApi } from "@/service/expenseRequest";
import {
  CASHFLOW_ITEM_STATUS_META,
  CASHFLOW_SOURCE_META,
  type CashflowSource,
  type ExpenseCashflowItemsResponse,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import type { MonthlyApprovalView } from "./ManagementExpenseView";

const money = (value: number | null | undefined) =>
  `${formatVnd(Number(value ?? 0)) || "0"} đ`;

/**
 * Khoản chi của đề xuất (Chi Ngoài / Chi Trường / Chi GV trường) với số hiện
 * tại ở QL thu chi: Phải chi, Đã chi, Còn lại, số lúc đề xuất / lúc duyệt và
 * phần đề xuất này đã ghi vào bảng. Báo số cho hộp duyệt qua `onLoaded`.
 */
export default function CashflowItemsPanel({
  requestId,
  source,
  reloadKey,
  onLoaded,
}: {
  requestId: number;
  source: CashflowSource;
  /** Đổi để tải lại (sau mỗi bước xử lý). */
  reloadKey?: unknown;
  onLoaded?: (view: MonthlyApprovalView | null) => void;
}) {
  const meta = CASHFLOW_SOURCE_META[source];
  const [data, setData] = useState<ExpenseCashflowItemsResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    setData(null);
    onLoaded?.(null);
    expenseRequestApi
      .getCashflowItems(requestId)
      .then((response) => {
        setData(response);
        onLoaded?.({
          remainingTotal: response.remainingTotal,
          itemAmounts: new Map(response.items.map((item) => [item.id, item.amount])),
        });
      })
      .catch((err) => {
        setError(
          err?.response?.status === 403
            ? err?.response?.data?.message || "Bạn không xem được số liệu này"
            : `Không tải được khoản chi từ bảng ${meta.table}`
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, meta.table]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-indigo-700">
          {meta.icon} Khoản chi ở QL thu chi — bảng {meta.table}
        </h3>
        <p className="text-xs text-slate-500">
          Số hiện tại ở QL thu chi. Khi xác nhận đã chi, Ngày chi, Nguồn chi và
          số tiền tự ghi về đúng các dòng của khoản.
        </p>
      </div>
      {error ? (
        <p className="text-xs text-slate-500">{error}</p>
      ) : !data ? (
        <p className="text-xs text-slate-400">Đang tải…</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {data.items.map((item) => {
              const status = CASHFLOW_ITEM_STATUS_META[item.status];
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    item.excluded
                      ? "border-gray-200 bg-gray-50 opacity-70"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-medium text-gray-900">{item.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
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
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                    {item.requestedAmount != null && (
                      <span>Lúc đề xuất: {money(item.requestedAmount)}</span>
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
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            <span>Còn phải chi hiện tại</span>
            <b>{money(data.remainingTotal)}</b>
          </div>
        </>
      )}
    </div>
  );
}
