// components/expense/Item.tsx

type Props = {
  label: string;
  value: number | string;
  color?: "blue" | "red" | "orange" | "emerald";
};

export default function Item({ label, value, color = "blue" }: Props) {
  const amount = Number(value || 0);

  const colorClass =
    color === "blue"
      ? "text-blue-600"
      : color === "red"
      ? "text-red-500"
      : color === "orange"
      ? "text-orange-500"
      : "text-emerald-600";

  return (
    <div className="bg-slate-100 rounded-2xl p-3">
      {/* LABEL */}
      <p className="text-xs text-slate-400">{label}</p>

      {/* VALUE */}
      <p className={`font-bold mt-2 ${colorClass}`}>
        {amount.toLocaleString("vi-VN")} đ
      </p>
    </div>
  );
}
