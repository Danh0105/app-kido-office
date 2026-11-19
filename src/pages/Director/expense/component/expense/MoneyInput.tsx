import { useState } from "react";

import { formatMoneyInput, parseMoneyInput } from "../../utils/moneyInput";

/**
 * Ô số tiền 2 số lẻ kiểu Việt Nam ("59.843,52"); dán "68.983.200" vẫn đúng.
 * Ghi khi rời ô / Enter; xoá trống = null (chưa nhập).
 */
export default function MoneyInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = "0",
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? formatMoneyInput(value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setDraft(formatMoneyInput(value))}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={() => {
        const next = parseMoneyInput(draft ?? "");
        setDraft(null);
        if (next !== (value ?? null)) onChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={className}
    />
  );
}
