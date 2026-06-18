// components/StatCard.tsx

type Props = {
  title: string;

  value: string | number;

  icon: React.ReactNode;

  color?: "blue" | "red" | "orange" | "emerald";
};

export function StatCard({ title, value, icon, color = "blue" }: Props) {
  const bgColor =
    color === "blue"
      ? "bg-blue-100"
      : color === "red"
      ? "bg-red-100"
      : color === "orange"
      ? "bg-orange-100"
      : "bg-emerald-100";

  return (
    <div
      className="
        bg-white
        rounded-3xl
        p-4
        shadow-sm
        border border-slate-100
      "
    >
      <div className="flex items-start justify-between">
        {/* CONTENT */}
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p
            className="
              text-xl md:text-2xl
              font-bold
              text-slate-900
              mt-2
            "
          >
            {value}
          </p>
        </div>

        {/* ICON */}
        <div
          className={`
            w-12 h-12
            rounded-2xl
            flex items-center justify-center
            ${bgColor}
          `}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
