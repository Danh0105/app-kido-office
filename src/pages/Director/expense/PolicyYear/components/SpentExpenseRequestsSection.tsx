import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Loader2, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { expenseRequestApi } from "@/service/expenseRequest";
import type { ExpenseRequest } from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import { useExpenseSocket } from "@/pages/ExpenseRequest/useExpenseSocket";
import { creatorName, formatDate } from "@/pages/ExpenseRequest/lib";

type Props = {
  schoolId: number;
  schoolYear: string;
  policyAfterTaxAmount: number;
  onTotalChange?: (total: number) => void;
};

const getSpentDate = (item: ExpenseRequest) =>
  item.spentAt ||
  item.updatedAt ||
  item.expectedPaymentDate ||
  item.createdAt ||
  "";

const isInSchoolYear = (value: string, schoolYear: string) => {
  if (!value || !schoolYear) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const years = schoolYear.match(/\d{4}/g)?.map(Number) || [];
  if (!years.length) return true;

  const startYear = years[0];
  const endYear = years[1] || startYear + 1;
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return month >= 8 ? year === startYear : year === endYear;
};

const displayAmount = (value: number) => formatVnd(value) || "0";

export default function SpentExpenseRequestsSection({
  schoolId,
  schoolYear,
  policyAfterTaxAmount,
  onTotalChange,
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setItems([]);

    try {
      const allItems: ExpenseRequest[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await expenseRequestApi.list({
          status: "SPENT",
          schoolId,
          schoolYear,
          page,
          limit: 100,
        });
        allItems.push(...(response.data || []));
        totalPages = Math.max(1, Number(response.totalPages || 1));
        page += 1;
      } while (page <= totalPages && page <= 50);

      setItems(
        allItems
          .filter(
            (item) =>
              Number(item.school?.id || (item as any).schoolId || 0) ===
                Number(schoolId) &&
              (item.schoolYear
                ? item.schoolYear === schoolYear
                : isInSchoolYear(getSpentDate(item), schoolYear)),
          )
          .sort(
            (first, second) =>
              new Date(getSpentDate(second)).getTime() -
              new Date(getSpentDate(first)).getTime(),
          ),
      );
    } catch (loadError) {
      console.error(loadError);
      setItems([]);
      setError("Không tải được đề xuất chi đã xác nhận chi");
    } finally {
      setLoading(false);
    }
  }, [schoolId, schoolYear]);

  useEffect(() => {
    void load();
  }, [load]);

  useExpenseSocket(() => {
    void load();
  });

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items],
  );
  const remainingAmount = Number(policyAfterTaxAmount || 0) - totalAmount;
  const coveragePercent =
    policyAfterTaxAmount > 0
      ? (totalAmount / policyAfterTaxAmount) * 100
      : totalAmount > 0
        ? 100
        : 0;
  const progressWidth = Math.min(100, Math.max(0, coveragePercent));

  useEffect(() => {
    onTotalChange?.(totalAmount);
  }, [onTotalChange, totalAmount]);

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ReceiptText size={21} />
          </div>
          <div>
            <h3 className="font-black text-emerald-900">
              Đề xuất chi đã xác nhận chi
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-emerald-700">
              Năm học {schoolYear} • {items.length} đề xuất
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Tổng đã chi
          </p>
          <p className="font-black text-emerald-700">
            {displayAmount(totalAmount)} đ
          </p>
        </div>
      </div>

      <div className="border-b border-emerald-100 bg-white p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-orange-600">
              Phần chi sau thuế
            </p>
            <p className="mt-2 text-xl font-black text-orange-800">
              {displayAmount(policyAfterTaxAmount)} đ
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-600">
              Tổng đề xuất đã chi
            </p>
            <p className="mt-2 text-xl font-black text-emerald-800">
              {displayAmount(totalAmount)} đ
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              remainingAmount >= 0
                ? "border-blue-200 bg-blue-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <p
              className={`text-[11px] font-black uppercase tracking-wide ${
                remainingAmount >= 0 ? "text-blue-600" : "text-rose-600"
              }`}
            >
              {remainingAmount >= 0 ? "Còn lại cần chi" : "Chi vượt dự kiến"}
            </p>
            <p
              className={`mt-2 text-xl font-black ${
                remainingAmount >= 0 ? "text-blue-800" : "text-rose-800"
              }`}
            >
              {displayAmount(Math.abs(remainingAmount))} đ
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span>Tỷ lệ đã chi so với phần chi sau thuế</span>
            <span className="text-slate-800">
              {coveragePercent.toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}
              %
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${
                coveragePercent > 100 ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm font-bold text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          Đang tải đề xuất chi...
        </div>
      ) : error ? (
        <div className="p-5 text-center text-sm font-bold text-rose-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center">
          <CircleDollarSign
            size={34}
            className="mx-auto text-emerald-200"
          />
          <p className="mt-3 text-sm font-bold text-slate-500">
            Chưa có đề xuất chi đã hoàn tất trong năm học này
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 text-left">Mã</th>
                <th className="min-w-[280px] px-4 py-3 text-left">Nội dung</th>
                <th className="px-4 py-3 text-left">Người đề xuất</th>
                <th className="px-4 py-3 text-left">Ngày xác nhận chi</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 hover:bg-emerald-50/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-500">
                    {item.code || `#${item.id}`}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{item.content}</p>
                    {item.participants && (
                      <p className="mt-1 text-xs text-slate-400">
                        Thành phần: {item.participants}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                    {creatorName(item)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                    {formatDate(getSpentDate(item))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-black text-emerald-700">
                    {formatVnd(item.amount)} đ
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/director/expense-requests/${item.id}`)
                      }
                      className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
