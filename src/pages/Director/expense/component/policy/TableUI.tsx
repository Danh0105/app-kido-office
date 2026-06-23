// components/policy/TableUI.tsx

import clsx from "clsx";

type Align = "left" | "center" | "right";

const money = (v: number) =>
  Number(v || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  });

/* -------------------------------- */
/* TABLE HEAD */
/* -------------------------------- */

export function TableHead({
  children,
  align = "left",
  sticky = false,
}: {
  children: React.ReactNode;
  align?: Align;
  sticky?: boolean;
}) {
  return (
    <th
      className={clsx(
        "px-5 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50 whitespace-nowrap",
        align === "center" && "text-center",
        align === "right" && "text-right",
        sticky && "sticky left-0 z-20 bg-slate-50 min-w-[220px]",
      )}
    >
      {children}
    </th>
  );
}

/* -------------------------------- */
/* TD */
/* -------------------------------- */

export function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: Align;
}) {
  return (
    <td
      className={clsx(
        "px-5 text-sm py-4 border-b border-slate-100 whitespace-nowrap text-slate-700",
        align === "center" && "text-center",
        align === "right" && "text-right",
      )}
    >
      {children}
    </td>
  );
}

/* -------------------------------- */
/* STICKY TD */
/* -------------------------------- */

export function StickyTd({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="
        sticky left-0 z-10
        bg-white
        px-5 py-4
        border-b border-slate-100
        min-w-[220px]
      "
    >
      {children}
    </td>
  );
}

/* -------------------------------- */
/* CENTER TD */
/* -------------------------------- */

export function CenterTd({ children }: { children: React.ReactNode }) {
  return <Td align="center">{children}</Td>;
}

/* -------------------------------- */
/* MONEY TD */
/* -------------------------------- */

export function MoneyTd({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: Align;
}) {
  return (
    <Td align={align}>
      <span className="text-sm font-semibold text-slate-900">
        {money(Number(children || 0))}
      </span>
    </Td>
  );
}

/* -------------------------------- */
/* BADGE */
/* -------------------------------- */

const badgeMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
};

export function BadgeMini({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-3 py-1 rounded-xl border text-xs font-semibold",
        badgeMap[color],
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------- */
/* FINANCE ROW */
/* -------------------------------- */
type FinanceRowProps = {
  name: string;
  group: string;
  value: number;
  fee?: number;
  color?: string;
  highlight?: boolean;
  note?: string;
};
export function FinanceRow({
  name,
  group,
  value,
  fee = 0,
  color = "slate",
  highlight = false,
  note,
}: FinanceRowProps) {
  const feeValue = Number(fee || 0);
  const rowValue = Number(value || 0);
  const percent = feeValue > 0 ? ((rowValue / feeValue) * 100).toFixed(1) : "0";

  return (
    <tr
      className={clsx(
        "transition-colors hover:bg-slate-50",
        highlight && "bg-emerald-50/40",
      )}
    >
      <StickyTd>
        <div>
          <p className="text-sm font-semibold text-slate-800">{name}</p>

          <p className="text-xs text-slate-400 mt-1">Khoản mục tài chính</p>
        </div>
      </StickyTd>

      <Td>
        <BadgeMini color={color}>{group}</BadgeMini>
      </Td>

      <MoneyTd>{value}</MoneyTd>

      <CenterTd>
        <span className="text-sm font-semibold text-slate-700">{percent}%</span>
      </CenterTd>

      <CenterTd>
        {note ? (
          <span className="text-xs text-slate-600">{note}</span>
        ) : highlight ? (
          <span className="text-emerald-600 font-semibold"></span>
        ) : (
          "-"
        )}
      </CenterTd>
    </tr>
  );
}
