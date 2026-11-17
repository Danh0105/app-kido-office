import { ExternalLink, ShieldAlert } from "lucide-react";
import type { CashflowIssue } from "@/service/cashflowReport";
import { formatDate, formatMoney, ISSUE_KIND_LABELS, sourceHref } from "./cashflowFormat";
import CashflowTableShell, {
  appleCell,
  appleHeaderCell,
  appleTableHead,
} from "./CashflowTableShell";

type Props = { issues: CashflowIssue[] };

/**
 * Chứng từ chưa đưa được vào sổ (lỗi) hoặc vẫn tính nhưng cần kế toán kiểm tra
 * (cảnh báo). Báo cáo không đoán tài khoản thay người dùng.
 */
export default function IssuesTable({ issues }: Props) {
  const errors = issues.filter((item) => !item.warningOnly).length;

  return (
    <CashflowTableShell
      title="Chứng từ cần kiểm tra"
      icon={<ShieldAlert size={21} />}
      description={
        <>
          <span className="font-semibold text-rose-700">{errors} lỗi</span> (chưa tính vào sổ) ·{" "}
          <span className="font-semibold text-amber-700">{issues.length - errors} cảnh báo</span>{" "}
          (đã tính hoặc chỉ để đối chiếu). Bổ sung thông tin ở chứng từ gốc rồi bấm Làm mới.
        </>
      }
    >
      {issues.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <ShieldAlert size={22} />
          </div>
          <p className="text-[14px] font-medium text-emerald-700">Không có chứng từ nào cần xử lý.</p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto overscroll-contain">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0">
            <thead className={`${appleTableHead} sticky top-0 z-20`}>
              <tr>
                {["Mức", "Loại", "Ngày", "Số chứng từ", "Diễn giải", "Tài khoản", "Số tiền", "Chi tiết", ""].map(
                  (label) => (
                    <th key={label} className={`${appleHeaderCell} text-center`}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {issues.map((item) => {
                const href = sourceHref(item.source);
                return (
                  <tr key={`${item.kind}:${item.key}`} className="group bg-white transition-colors hover:bg-blue-50/45">
                    <td className={`${appleCell} text-center`}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                          item.warningOnly
                            ? "bg-amber-50 text-amber-700 ring-amber-200"
                            : "bg-rose-50 text-rose-700 ring-rose-200"
                        }`}
                      >
                        {item.warningOnly ? "Cảnh báo" : "Lỗi"}
                      </span>
                    </td>
                    <td className={`${appleCell} whitespace-nowrap font-medium text-slate-900`}>
                      {ISSUE_KIND_LABELS[item.kind] ?? item.kind}
                    </td>
                    <td className={`${appleCell} whitespace-nowrap text-center`}>
                      {formatDate(item.date)}
                    </td>
                    <td
                      className={`${appleCell} whitespace-nowrap font-mono text-[13px] font-semibold text-blue-700`}
                    >
                      {item.documentNo}
                    </td>
                    <td className={appleCell}>
                      <span className="line-clamp-2" title={item.description}>
                        {item.description}
                      </span>
                    </td>
                    <td className={`${appleCell} text-center font-mono`}>{item.accountCode ?? ""}</td>
                    <td
                      className={`${appleCell} whitespace-nowrap text-right font-semibold tabular-nums text-slate-950`}
                    >
                      {item.amount === null ? "" : formatMoney(item.amount)}
                    </td>
                    <td className={`${appleCell} text-[13px] text-slate-600`}>{item.message}</td>
                    <td className={`${appleCell} text-center`}>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                        >
                          Mở <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CashflowTableShell>
  );
}
