export function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "blue" | "emerald" | "purple";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    purple: "bg-purple-100 text-purple-700",
  };

  return (
    <div
      className={`
        px-4 py-2 rounded-xl
        text-sm font-semibold
        ${colors[color]}
      `}
    >
      {children}
    </div>
  );
}

export function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4">
      <p className="text-xs text-slate-400 mb-2">{label}</p>

      <p className="font-semibold text-slate-700">{value || "--"}</p>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  );
}

export const SummaryCard = ({ title, value, color = "blue" }: any) => {
  const map: any = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div
      className={`
        rounded-3xl
        border
        p-5
        ${map[color]}
      `}
    >
      <p className="text-sm font-medium opacity-70">{title}</p>

      <h3 className="text-2xl font-bold mt-2">
        {Number(value || 0).toLocaleString()}
      </h3>
    </div>
  );
};

export const TableHead = ({ children, align, sticky }: any) => (
  <th
    className={`
      sticky top-0
      z-30

      bg-slate-900
      text-white

      px-5 py-4
      text-xs
      uppercase
      tracking-wide
      font-semibold
      whitespace-nowrap

      border-b border-slate-700

      ${align === "right" ? "text-right" : ""}
      ${align === "center" ? "text-center" : ""}

      ${
        sticky
          ? `
            left-0
            z-40
            min-w-[240px]
          `
          : ""
      }
    `}
  >
    {children}
  </th>
);

export const Td = ({ children }: any) => (
  <td className="px-5 py-4 whitespace-nowrap text-slate-700">{children}</td>
);

export const StickyTd = ({ children }: any) => (
  <td
    className="
      sticky left-0 z-20

      bg-white

      px-5 py-4
      min-w-[240px]

      border-r border-slate-100
      shadow-[6px_0_10px_-10px_rgba(0,0,0,0.15)]
    "
  >
    {children}
  </td>
);

export const CenterTd = ({ children }: any) => (
  <td className="px-5 py-4 text-center text-slate-700">{children}</td>
);

export const MoneyTd = ({ children }: any) => (
  <td className="px-5 py-4 text-right">
    <span className="font-semibold text-slate-900">
      {Number(children || 0).toLocaleString()}
    </span>
  </td>
);

export const SectionRow = ({ title }: any) => (
  <tr>
    <td
      colSpan={9}
      className="
        px-5 py-3
        bg-slate-100
        text-slate-700
        text-sm
        font-bold
        uppercase
        tracking-wide
      "
    >
      {title}
    </td>
  </tr>
);

export const BadgeMini = ({ children, color }: any) => {
  const map: any = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  return (
    <span
      className={`
        px-3 py-1
        rounded-full
        text-xs
        font-semibold
        border
        ${map[color]}
      `}
    >
      {children}
    </span>
  );
};
export const FinanceRow = ({
  name,
  group,
  value,
  color = "slate",
  highlight = false,
}: any) => {
  const colorMap: any = {
    blue: "text-blue-700 bg-blue-50",
    orange: "text-orange-700 bg-orange-50",
    rose: "text-rose-700 bg-rose-50",
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    slate: "text-slate-700 bg-slate-100",
  };

  return (
    <tr
      className={`
        border-b border-slate-100
        hover:bg-slate-50/70
        transition-colors
        ${highlight ? "bg-emerald-50/40" : ""}
      `}
    >
      {/* Sticky first column */}
      <td
        className="
          sticky left-0 z-10
          bg-white
          border-r border-slate-100
          px-5 py-4
          min-w-[240px]
        "
      >
        <div>
          <p
            className={`
              font-semibold
              ${highlight ? "text-emerald-700" : "text-slate-800"}
            `}
          >
            {name}
          </p>

          <p className="text-xs text-slate-400 mt-1">Khoản mục tài chính</p>
        </div>
      </td>

      {/* Group */}
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`
            inline-flex items-center
            px-3 py-1
            rounded-full
            text-xs font-semibold
            border
            ${colorMap[color]}
          `}
        >
          {group}
        </span>
      </td>

      {/* Value */}
      <td className="px-5 py-4 text-right whitespace-nowrap">
        <span
          className={`
            text-base font-bold
            ${highlight ? "text-emerald-700" : "text-slate-900"}
          `}
        >
          {Number(value || 0).toLocaleString()}
        </span>
      </td>

      {/* Empty columns */}
      <td className="px-5 py-4 text-center text-slate-300">—</td>

      <td className="px-5 py-4 text-center text-slate-300">—</td>

      <td className="px-5 py-4 text-center text-slate-300">—</td>

      <td className="px-5 py-4 text-center text-slate-300">—</td>

      <td className="px-5 py-4 text-center text-slate-300">—</td>

      <td className="px-5 py-4 text-center text-slate-300">—</td>
    </tr>
  );
};
