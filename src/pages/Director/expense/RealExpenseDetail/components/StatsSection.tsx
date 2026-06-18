// components/StatsSection.tsx

import { BadgeDollarSign, Landmark, Receipt, Wallet } from "lucide-react";

import { StatCard } from "./StatCard";

type Props = {
  totalRevenue: number;

  totalExpense: number;

  totalCashPolicy: number;

  profit: number;

  money: (value: number) => string;
};

export default function StatsSection({
  totalRevenue,
  totalExpense,
  totalCashPolicy,
  profit,
  money,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* REVENUE */}
      <StatCard
        title="Doanh thu"
        value={money(totalRevenue)}
        icon={<Receipt className="text-blue-600" />}
        color="blue"
      />

      {/* EXPENSE */}
      <StatCard
        title="Chi phí"
        value={money(totalExpense)}
        icon={<Wallet className="text-red-500" />}
        color="red"
      />

      {/* CASH POLICY */}
      <StatCard
        title="CS tiền mặt"
        value={money(totalCashPolicy)}
        icon={<Landmark className="text-orange-500" />}
        color="orange"
      />

      {/* PROFIT */}
      <StatCard
        title="Lợi nhuận"
        value={money(profit)}
        icon={<BadgeDollarSign className="text-emerald-600" />}
        color="emerald"
      />
    </div>
  );
}
