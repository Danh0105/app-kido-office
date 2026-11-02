import { useEffect, useState } from "react";
import { BookOpenText, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { LedgerResponse } from "@/service/cashflowReport";
import { formatCell, formatDate, formatMoney, sourceHref } from "./cashflowFormat";
import CashflowTableShell from "./CashflowTableShell";

type Props = {
  data: LedgerResponse;
  onPageChange: (page: number) => void;
};

/**
 * 5 cột chứng từ bên trái dính khi cuộn ngang (636px). Hai cột đối tượng bên
 * phải KHÔNG dính: dính cả hai bên thì gần hết khung nhìn bị chiếm, không còn
 * chỗ cho các cột tài khoản.
 */
const LEFT = [
  { label: "Ngày hạch toán", width: 92, left: 0 },
  { label: "Ngày chứng từ", width: 92, left: 92 },
  { label: "Số chứng từ", width: 120, left: 184 },
  { label: "Số hóa đơn", width: 92, left: 304 },
  { label: "Diễn giải", width: 240, left: 396 },
];
const RIGHT = [
  { label: "Mã đối tượng", width: 104 },
  { label: "Tên đối tượng", width: 220 },
];
const AMOUNT_WIDTH = 116;
/**
 * Chiều cao hàng tiêu đề tài khoản. Giá trị này phải khớp với `top` của hàng
 * Thu/Chi; nếu hàng trên thấp hơn, sticky sẽ đẩy hàng Thu/Chi xuống và làm nó
 * chồng lên dòng số dư đầu kỳ ngay cả khi bảng chưa cuộn.
 */
const ACCOUNT_HEADER_HEIGHT = 61;
/** Màn hình hẹp hơn: không dính cột nào, cuộn ngang cả bảng. */
const STICKY_QUERY = "(min-width: 1024px)";

function useStickyColumns() {
  const [sticky, setSticky] = useState(
    () => typeof window !== "undefined" && window.matchMedia(STICKY_QUERY).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(STICKY_QUERY);
    const update = () => setSticky(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return sticky;
}

const rightStyle = (index: number) => ({
  width: RIGHT[index].width,
  minWidth: RIGHT[index].width,
});

export default function LedgerTable({ data, onPageChange }: Props) {
  const { accounts, rows } = data;
  const sticky = useStickyColumns();
  const stickyLeft = (index: number) => ({
    ...(sticky ? { position: "sticky" as const, left: LEFT[index].left } : {}),
    width: LEFT[index].width,
    minWidth: LEFT[index].width,
  });
  const totalPages = Math.max(1, Math.ceil(data.totalRows / data.limit));
  const groupTitle =
    data.group === "111" ? "Tài khoản 111 · Tiền mặt tại quỹ" : "Tài khoản 112 · Tiền gửi ngân hàng";

  const balanceRow = (
    label: string,
    pick: (account: LedgerResponse["accounts"][number]) => string | null,
    tone: string,
  ) => (
    <tr className={`${tone} font-semibold text-slate-900`}>
      {LEFT.map((column, index) => (
        <td
          key={column.label}
          style={stickyLeft(index)}
          className={`${tone} z-10 border-b border-slate-200/80 px-3 py-3 text-[13px] ${index === 4 ? "text-left" : ""}`}
        >
          {index === 4 ? label : ""}
        </td>
      ))}
      {accounts.map((account) => {
        const value = pick(account);
        return (
          <td
            key={account.code}
            colSpan={2}
            className="border-b border-slate-200/80 px-3 py-3 text-right text-[13px] font-semibold tabular-nums"
          >
            {value === null ? (
              <span className="text-xs italic font-normal text-amber-700">Chưa xác minh</span>
            ) : (
              formatMoney(value)
            )}
          </td>
        );
      })}
      {RIGHT.map((column, index) => (
        <td
          key={column.label}
          style={rightStyle(index)}
          className={`${tone} z-10 border-b border-slate-200/80`}
        />
      ))}
    </tr>
  );

  return (
    <CashflowTableShell
      title="Sổ chi tiết thu chi"
      icon={<BookOpenText size={21} />}
      description={
        <>
          <span className="font-semibold text-slate-800">{groupTitle}</span>
          <span className="mx-2 text-slate-300">•</span>
          Từ {formatDate(data.range.from)} đến {formatDate(data.range.to)}
          {data.searchActive && (
            <span className="mt-1 block font-medium text-amber-700">
              Đang lọc từ khoá: dòng “Cộng” tính các chứng từ khớp; số dư đầu/cuối kỳ vẫn là số dư thật.
            </span>
          )}
        </>
      }
    >

      {accounts.length === 0 ? (
        <p className="px-5 py-10 text-center text-[14px] text-slate-500">
          Không có tài khoản nào trong nhóm này theo bộ lọc hiện tại.
        </p>
      ) : (
        <div className="max-h-[72vh] overflow-auto overscroll-contain">
          <table className="border-separate border-spacing-0 text-[14px]" style={{ minWidth: "100%" }}>
            <thead className="text-[11px] font-semibold uppercase tracking-[0.045em] text-slate-600">
              <tr
                className="bg-[#f5f5f7]/95 backdrop-blur-xl"
                style={{ height: ACCOUNT_HEADER_HEIGHT }}
              >
                {LEFT.map((column, index) => (
                  <th
                    key={column.label}
                    rowSpan={2}
                    style={stickyLeft(index)}
                    className="top-0 z-30 border-b border-r border-slate-200 bg-[#f5f5f7]/95 px-3 py-3 font-semibold backdrop-blur-xl"
                  >
                    {column.label}
                  </th>
                ))}
                {accounts.map((account) => (
                  <th
                    key={account.code}
                    colSpan={2}
                    title={`${account.code} - ${account.name}${account.isActive ? "" : " (ngừng sử dụng)"}`}
                    className="sticky top-0 z-20 border-b border-r border-slate-200 bg-[#f5f5f7]/95 px-3 py-3 font-semibold backdrop-blur-xl"
                    style={{ minWidth: AMOUNT_WIDTH * 2 }}
                  >
                    <div className="truncate" style={{ maxWidth: AMOUNT_WIDTH * 2 - 16 }}>
                      {account.code} - {account.name}
                    </div>
                    {!account.isActive && (
                      <div className="mt-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700">Ngừng sử dụng</div>
                    )}
                  </th>
                ))}
                {RIGHT.map((column, index) => (
                  <th
                    key={column.label}
                    rowSpan={2}
                    style={rightStyle(index)}
                    className="sticky top-0 z-20 border-b border-slate-200 bg-[#f5f5f7]/95 px-3 py-3 font-semibold backdrop-blur-xl"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-blue-50/95 text-blue-800 backdrop-blur-xl">
                {accounts.flatMap((account) => [
                  <th
                    key={`${account.code}-thu`}
                    className="sticky z-20 border-b border-r border-blue-100 bg-blue-50/95 px-3 py-2 font-semibold backdrop-blur-xl"
                    style={{ minWidth: AMOUNT_WIDTH, top: ACCOUNT_HEADER_HEIGHT }}
                  >
                    Thu
                  </th>,
                  <th
                    key={`${account.code}-chi`}
                    className="sticky z-20 border-b border-r border-blue-100 bg-blue-50/95 px-3 py-2 font-semibold backdrop-blur-xl"
                    style={{ minWidth: AMOUNT_WIDTH, top: ACCOUNT_HEADER_HEIGHT }}
                  >
                    Chi
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {balanceRow("Số dư đầu kỳ", (account) => account.opening, "bg-sky-50/90")}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={LEFT.length + accounts.length * 2 + RIGHT.length}
                    className="border-b border-slate-200 px-5 py-10 text-center text-[14px] text-slate-500"
                  >
                    Không có chứng từ phát sinh trong kỳ.
                  </td>
                </tr>
              )}

              {rows.map((row) => {
                const href = sourceHref(row.source);
                return (
                  <tr
                    key={row.key}
                    className={`group bg-white transition-colors ${href ? "cursor-pointer" : ""} hover:bg-blue-50/50`}
                    onClick={() => href && window.open(href, "_blank", "noopener")}
                    title={href ? "Mở chứng từ gốc (tab mới)" : undefined}
                  >
                    {[
                      formatDate(row.postingDate),
                      formatDate(row.documentDate),
                      row.documentNo,
                      row.invoiceNo ?? "",
                      row.description,
                    ].map((value, index) => (
                      <td
                        key={LEFT[index].label}
                        style={stickyLeft(index)}
                        className={`z-10 border-b border-slate-200/70 bg-white px-3 py-3 text-[13px] text-slate-700 transition-colors group-hover:bg-blue-50 ${index === 4 ? "text-left" : "whitespace-nowrap text-center"}`}
                      >
                        {index === 2 && href ? (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-blue-700">
                            {value}
                            <ExternalLink size={12} />
                          </span>
                        ) : index === 4 ? (
                          <span className="line-clamp-2" title={value}>
                            {value}
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                    {accounts.flatMap((account) => {
                      const own = row.accountCode === account.code;
                      return [
                        <td
                          key={`${account.code}-thu`}
                          className="border-b border-r border-slate-200/70 px-3 py-3 text-right font-medium tabular-nums text-emerald-700"
                        >
                          {own ? formatCell(row.receipt) : ""}
                        </td>,
                        <td
                          key={`${account.code}-chi`}
                          className="border-b border-r border-slate-200/70 px-3 py-3 text-right font-medium tabular-nums text-rose-700"
                        >
                          {own ? formatCell(row.payment) : ""}
                        </td>,
                      ];
                    })}
                    {[row.partnerCode ?? "", row.partnerName ?? ""].map((value, index) => (
                      <td
                        key={RIGHT[index].label}
                        style={rightStyle(index)}
                        className="z-10 border-b border-slate-200/70 bg-white px-3 py-3 text-[13px] transition-colors group-hover:bg-blue-50"
                      >
                        <span className="line-clamp-1" title={value}>
                          {value}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}

              <tr className="bg-amber-50/90 font-semibold text-slate-900">
                {LEFT.map((column, index) => (
                  <td
                    key={column.label}
                    style={stickyLeft(index)}
                    className="z-10 border-b border-slate-200 bg-amber-50 px-3 py-3 text-left text-[13px]"
                  >
                    {index === 4 ? (totalPages > 1 ? "Cộng (toàn kỳ)" : "Cộng") : ""}
                  </td>
                ))}
                {accounts.flatMap((account) => [
                  <td
                    key={`${account.code}-thu`}
                    className="border-b border-r border-slate-200 px-3 py-3 text-right tabular-nums text-emerald-800"
                  >
                    {formatMoney(account.receipts)}
                  </td>,
                  <td
                    key={`${account.code}-chi`}
                    className="border-b border-r border-slate-200 px-3 py-3 text-right tabular-nums text-rose-800"
                  >
                    {formatMoney(account.payments)}
                  </td>,
                ])}
                {RIGHT.map((column, index) => (
                  <td
                    key={column.label}
                    style={rightStyle(index)}
                    className="z-10 border-b border-slate-200 bg-amber-50"
                  />
                ))}
              </tr>

              {balanceRow("Số dư cuối kỳ", (account) => account.closing, "bg-indigo-50/90")}
            </tbody>
          </table>
        </div>
      )}

      {data.totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 bg-slate-50/70 px-5 py-3 text-[12px] text-slate-600">
          <span>
            {data.totalRows.toLocaleString("vi-VN")} chứng từ · trang {data.page}/{totalPages}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => onPageChange(data.page - 1)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                type="button"
                disabled={data.page >= totalPages}
                onClick={() => onPageChange(data.page + 1)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </CashflowTableShell>
  );
}
