import { useEffect, useState } from "react";
import { formatCurrency, parseCurrency } from "../utils";

type MoneyInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function MoneyInput({
  value,
  onChange,
  disabled = false,
  className = "",
  ariaLabel,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

  useEffect(() => {
    setDisplayValue(formatCurrency(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={displayValue}
      disabled={disabled}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const nextValue = parseCurrency(event.target.value);
        setDisplayValue(formatCurrency(nextValue));
        onChange(nextValue);
      }}
      className={`h-9 min-w-[108px] rounded-lg border border-slate-200 bg-white px-2.5 text-right text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
    />
  );
}

