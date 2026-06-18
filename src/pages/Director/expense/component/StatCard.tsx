export function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}

        <p className="text-sm text-slate-500">{title}</p>
      </div>

      <p
        className={`text-xl font-bold mt-3 ${
          color === "blue"
            ? "text-blue-600"
            : color === "red"
            ? "text-red-500"
            : color === "orange"
            ? "text-orange-500"
            : "text-emerald-600"
        }`}
      >
        {value} đ
      </p>
    </div>
  );
}
