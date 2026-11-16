import DecimalInput from "@/components/DecimalInput";
import type { PolicySupport, PolicySupportRowUsage } from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";

const money = (value: number | null | undefined) =>
  `${formatVnd(Number(value ?? 0)) || "0"} đ`;

/** Số tiền kinh doanh nhập cho từng dòng đã tích, theo `rowKey`. */
export type PolicySupportSelection = Record<string, number>;

type Row = PolicySupportRowUsage & {
  subjectName: string | null;
  subjectId: number;
  title: string;
  detail: string;
};

function SupportRow({
  row,
  selection,
  onSelectionChange,
}: {
  row: Row;
  selection?: PolicySupportSelection;
  onSelectionChange?: (next: PolicySupportSelection) => void;
}) {
  const selectable = !!onSelectionChange && !!selection;
  const checked = selectable && row.rowKey in selection!;
  const amount = checked ? selection![row.rowKey] : 0;
  const over = checked && amount > row.remainingAmount;
  const disabled = selectable && !checked && !(row.remainingAmount > 0);

  const toggle = () => {
    if (!selectable || disabled) return;
    const next = { ...selection! };
    if (checked) delete next[row.rowKey];
    else next[row.rowKey] = row.remainingAmount;
    onSelectionChange!(next);
  };

  return (
    <li
      className={`rounded-lg border px-2.5 py-2 text-xs ${
        checked ? "border-blue-300 bg-blue-50/60" : "border-gray-100 bg-white"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <label className={`flex items-start gap-2 ${selectable && !disabled ? "cursor-pointer" : ""}`}>
        {selectable && (
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            checked={checked}
            disabled={disabled}
            onChange={toggle}
            aria-label={`Chọn ${row.subjectName ?? ""} ${row.title}`}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-medium text-gray-800">
              {row.subjectName || `Môn #${row.subjectId}`} · {row.title}
            </span>
            <span className="text-gray-500">
              Còn lại{" "}
              <b className={row.remainingAmount > 0 ? "text-orange-600" : "text-gray-400"}>
                {money(row.remainingAmount)}
              </b>
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] text-gray-500">
            {row.detail} · Chính sách {money(row.capAmount)} · Đã chi{" "}
            <span className="text-emerald-700">{money(row.spentAmount)}</span>
            {row.heldAmount > 0 && <> · Đang đề xuất {money(row.heldAmount)}</>}
          </span>
        </span>
      </label>
      {checked && (
        <div className="mt-1.5 pl-6">
          <label className="text-[11px] text-gray-600">
            Số tiền đề xuất (tối đa {money(row.remainingAmount)})
          </label>
          <DecimalInput
            value={amount}
            onValueChange={(value) =>
              onSelectionChange!({ ...selection!, [row.rowKey]: Number(value) || 0 })
            }
            className={`mt-0.5 w-full rounded-lg border px-3 py-1.5 text-sm ${
              over || !(amount > 0) ? "border-red-300" : ""
            }`}
            placeholder="0"
            allowDecimal={false}
          />
          {over && (
            <p className="mt-0.5 text-[11px] text-red-600">
              Vượt phần còn lại của dòng ({money(row.remainingAmount)})
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Hỗ trợ tiền mặt và hỗ trợ thiết bị trong chính sách đã duyệt của trường, kèm
 * Đã chi / đang đề xuất / còn lại từng dòng. Màn tạo Đề xuất chi Năm truyền
 * `selection` + `onSelectionChange` để kinh doanh tích dòng và nhập số tiền
 * (không vượt phần còn lại); không truyền thì chỉ xem.
 */
export default function PolicySupportTables({
  support,
  loading,
  error,
  selection,
  onSelectionChange,
}: {
  support: PolicySupport | null;
  loading?: boolean;
  error?: string;
  selection?: PolicySupportSelection;
  onSelectionChange?: (next: PolicySupportSelection) => void;
}) {
  if (loading) {
    return <p className="text-xs text-gray-400">Đang tải chính sách của trường…</p>;
  }
  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!support) return null;

  if (!support.hasCash && !support.hasEquipment) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
        Chính sách đã duyệt của trường năm học {support.schoolYear} không có hỗ
        trợ tiền mặt hoặc thiết bị nên chưa lập được đề xuất chi Năm cho trường
        này.
      </div>
    );
  }

  const cashRows: Row[] = support.cash.map((row) => ({
    ...row,
    title: row.type || "Tiền mặt",
    detail: `Số tiền ${money(row.money)}`,
  }));
  const equipmentRows: Row[] = support.equipment.map((row) => ({
    ...row,
    title: row.category || "Thiết bị",
    detail: row.qty ? `${row.qty} × ${money(row.price)}` : "Thiết bị",
  }));
  const selectedTotal = selection
    ? Object.values(selection).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : 0;

  const section = (
    title: string,
    tone: string,
    total: number,
    rows: Row[],
  ) => (
    <section className={`rounded-xl border overflow-hidden ${tone}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-white/60">
        <h4 className="text-xs font-semibold">{title}</h4>
        <span className="text-xs font-semibold">{money(total)}</span>
      </div>
      <ul className="space-y-1.5 p-2">
        {rows.map((row) => (
          <SupportRow
            key={row.rowKey}
            row={row}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        ))}
      </ul>
    </section>
  );

  return (
    <div className="space-y-3">
      {onSelectionChange && (
        <p className="text-xs text-blue-700">
          Tích dòng tiền mặt / thiết bị muốn đề xuất và nhập số tiền (không vượt
          phần còn lại của dòng). Khi đề xuất hoàn thành, số này ghi vào Đã chi
          của dòng ở Chính sách năm.
        </p>
      )}
      {support.hasCash &&
        section(
          "💵 Hỗ trợ tiền mặt (Thành tiền thực tế)",
          "border-emerald-100 bg-emerald-50 text-emerald-800",
          support.cashActualTotal,
          cashRows,
        )}
      {support.hasEquipment &&
        section(
          "🧰 Hỗ trợ thiết bị",
          "border-indigo-100 bg-indigo-50 text-indigo-800",
          support.equipmentTotal,
          equipmentRows,
        )}
      <div className="flex flex-wrap justify-between gap-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
        <span>
          Đã chi <b className="text-emerald-700">{money(support.spentTotal)}</b> · Còn lại{" "}
          <b className="text-orange-600">{money(support.remainingTotal)}</b>
        </span>
        {selection && (
          <span>
            Đề xuất lần này <b className="text-blue-700">{money(selectedTotal)}</b>
          </span>
        )}
      </div>
    </div>
  );
}
