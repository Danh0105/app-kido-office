// ListExpense.tsx

import HeaderWithBack from "@/components/HeaderWithBack";
import { useEffect, useState } from "react";

export default function ListExpense() {
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    // TODO:
    // fetch api expenses
    setExpenses([
      {
        id: 1,
        title: "Chi tiếp khách",
        amount: 500000,
        note: "Tiếp đoàn trường",
        createdAt: "20/05/2026",
      },
      {
        id: 2,
        title: "Chi xăng xe",
        amount: 300000,
        note: "Đi công tác",
        createdAt: "19/05/2026",
      },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <HeaderWithBack title="Danh sách chi tiền thực" />

      <div className="p-4 mt-[60px] space-y-3">
        {expenses.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900">{item.title}</p>

                <p className="text-sm text-gray-500 mt-1">{item.note}</p>
              </div>

              <p className="text-green-600 font-bold">
                {Number(item.amount).toLocaleString()} đ
              </p>
            </div>

            <div className="mt-3 pt-3 border-t text-xs text-gray-400">
              {item.createdAt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
