// components/expense/ExpenseTableHeader.tsx

import { icons } from "lucide-react";

const headers = [
  { label: "Số tiết", icon: "🕒", color: "text-blue-300" },
  { label: "Số HS", icon: "👨‍🎓", color: "text-blue-300" },
  { label: "Số tháng", icon: "📅", color: "text-blue-300" },

  { label: "Đơn giá", icon: "💵", color: "text-emerald-300" },
  { label: "Thành tiền", icon: "🧾", color: "text-emerald-300" },

  { label: "Chi trường", icon: "🏫", color: "text-red-300" },
  { label: "Chi QL1", icon: "👤", color: "text-red-300" },
  { label: "Chi QL2", icon: "👤", color: "text-red-300" },
  { label: "Chi ngoài", icon: "💸", color: "text-red-300" },

  { label: "Đã chi", icon: "🏦", color: "text-orange-300" },
  { label: "Còn chi", icon: "📊", color: "text-purple-300" },

  { label: "Tiền HĐ", icon: "💰", color: "text-yellow-300" },

  { label: "Ngày thu", icon: "📅", color: "text-cyan-300" },
  { label: "Ngày chi", icon: "📆", color: "text-cyan-300" },

  { label: "Người chi", icon: "👤", color: "text-slate-300" },
  { label: "Ghi chú", icon: "📝", color: "text-slate-300" },

  { label: "TT", icon: "⚙️", color: "text-slate-300" },
];

export default function ExpenseTableHeader() {
  return (
    <div
      className="
        sticky top-0 z-30
        grid
        grid-cols-[110px_110px_110px_130px_160px_160px_160px_160px_160px_140px_140px_140px_140px_140px_160px_220px_80px]
        bg-slate-900
        border-b border-slate-700
        shadow-lg
      "
    >
      {headers.map((item, index) => (
        <div
          key={index}
          className="
            h-14
            px-3
            border-r border-slate-700
            flex flex-col items-center justify-center
            text-center
          "
        >
          <div className={`text-base ${item.color}`}>{item.icon}</div>

          <div
            className="
              text-[11px]
              text-slate-200
              font-semibold
              uppercase
              tracking-wide
            "
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
