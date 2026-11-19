import { formatDecimal } from "@/utils/decimal";
import {
  type CashAccountAmount,
  invoiceCashAccountLabel,
} from "../../RealExpenseDetail/utils/invoiceCashAccounts";

/**
 * Dòng được đề xuất chi trả từ nhiều nguồn chi (19/11/2026): liệt kê riêng
 * từng nguồn + số tiền, ngay dưới ô Nguồn chi.
 */
export default function SuggestSourcesNote({
  sources,
}: {
  sources?: CashAccountAmount[];
}) {
  if (!sources || sources.length < 2) return null;
  return (
    <ul
      className="mt-1 space-y-0.5 text-[11px] leading-tight text-emerald-800"
      title={sources
        .map((s) => `${invoiceCashAccountLabel(s.cashAccount)}: ${formatDecimal(s.amount)} đ`)
        .join("\n")}
    >
      {sources.map((source) => (
        <li
          key={source.cashAccount ?? "none"}
          className="flex justify-between gap-1 rounded bg-emerald-50 px-1.5 py-0.5"
        >
          <span className="font-semibold">{source.cashAccount ?? "—"}</span>
          <span className="tabular-nums">{formatDecimal(source.amount) || "0"}</span>
        </li>
      ))}
    </ul>
  );
}
