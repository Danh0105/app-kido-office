import {
  BadgePercent,
  Building2,
  School,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react";
import { PolicySummary } from "../types";
import { formatCurrency } from "../utils";

type PolicySummaryCardsProps = {
  summary: PolicySummary;
};

export default function PolicySummaryCards({
  summary,
}: PolicySummaryCardsProps) {
  const cards = [
    {
      label: "Tổng lượt học sinh",
      value: formatCurrency(summary.totalStudents),
      suffix: "HS",
      icon: Users,
      className: "border-slate-200 bg-white text-slate-700",
      iconClassName: "bg-slate-100 text-slate-600",
    },
    {
      label: "Tổng doanh thu",
      value: formatCurrency(summary.totalRevenue),
      suffix: "đ",
      icon: WalletCards,
      className: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
      iconClassName: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Để lại trường",
      value: formatCurrency(summary.totalSchoolRetain),
      suffix: "đ",
      icon: School,
      className: "border-blue-200 bg-blue-50/70 text-blue-800",
      iconClassName: "bg-blue-100 text-blue-700",
    },
    {
      label: "Công ty nhận",
      value: formatCurrency(summary.totalCompanyPayment),
      suffix: "đ",
      icon: Building2,
      className: "border-violet-200 bg-violet-50/70 text-violet-800",
      iconClassName: "bg-violet-100 text-violet-700",
    },
    {
      label: "Chính sách sau thuế",
      value: formatCurrency(Math.round(summary.totalPolicyAfterTax)),
      suffix: "đ",
      icon: BadgePercent,
      className: "border-orange-200 bg-orange-50/70 text-orange-800",
      iconClassName: "bg-orange-100 text-orange-700",
    },
    {
      label: "Còn lại chi",
      value: formatCurrency(Math.round(summary.totalRemaining)),
      suffix: "đ",
      icon: TriangleAlert,
      className:
        summary.totalRemaining > 0
          ? "border-rose-200 bg-rose-50/70 text-rose-800"
          : "border-emerald-200 bg-emerald-50/70 text-emerald-800",
      iconClassName:
        summary.totalRemaining > 0
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            key={card.label}
            className={`rounded-2xl border p-4 shadow-sm ${card.className}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                  {card.label}
                </p>
                <p className="mt-3 truncate text-xl font-black">
                  {card.value}
                  <span className="ml-1 text-xs font-bold opacity-70">
                    {card.suffix}
                  </span>
                </p>
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconClassName}`}
              >
                <Icon size={20} />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

