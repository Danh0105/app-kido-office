import { ExternalLink } from "lucide-react";
import type { CashflowIssue } from "@/service/cashflowReport";
import { formatDate, formatMoney, ISSUE_KIND_LABELS, sourceHref } from "./cashflowFormat";

type Props = { issues: CashflowIssue[] };

/**
 * Chứng từ chưa đưa được vào sổ (lỗi) hoặc vẫn tính nhưng cần kế toán kiểm tra
 * (cảnh báo). Báo cáo không đoán tài khoản thay người dùng.
 */
export default function IssuesTable({ issues }: Props) {
  const errors = issues.filter((item) => !item.warningOnly).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold text-slate-900">Chứng từ chưa phân loại / cần kiểm tra</h2>
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-rose-700">{errors} lỗi</span> (chưa tính vào sổ) ·{" "}
          <span className="font-semibold text-amber-700">{issues.length - errors} cảnh báo</span>{" "}
          (đã tính hoặc chỉ để đối chiếu). Bổ sung thông tin ở chứng từ gốc rồi bấm Làm mới.
        </p>
      </div>
      {issues.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-emerald-700">Không có chứng từ nào cần xử lý.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-900 text-xs text-white">
              <tr>
                {["Mức", "Loại", "Ngày", "Số chứng từ", "Diễn giải", "TK", "Số tiền", "Chi tiết", ""].map(
                  (label) => (
                    <th key={label} className="border border-slate-700 px-2 py-2 font-semibold">
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
                  <tr key={`${item.kind}:${item.key}`} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-[2px] rounded-full text-xs font-medium ${
                          item.warningOnly
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.warningOnly ? "Cảnh báo" : "Lỗi"}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                      {ISSUE_KIND_LABELS[item.kind] ?? item.kind}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{item.documentNo}</td>
                    <td className="border border-slate-200 px-2 py-1.5">
                      <span className="line-clamp-2" title={item.description}>
                        {item.description}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">{item.accountCode ?? ""}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                      {item.amount === null ? "" : formatMoney(item.amount)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-xs text-slate-600">{item.message}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline"
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
    </div>
  );
}
