import { useEffect, useState } from "react";
import { formatDecimal, parseLocalizedDecimal } from "@/utils/decimal";

type DecimalInputProps = {
  value?: number | string | null;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
};

export default function DecimalInput({
  value,
  onValueChange,
  className = "",
  placeholder = "0",
  min = 0,
  max,
  disabled = false,
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatDecimal(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatDecimal(value));
    }
  }, [focused, value]);

  const clampValue = (nextValue: number) => {
    const minimumApplied = Math.max(min, nextValue);
    return max === undefined ? minimumApplied : Math.min(max, minimumApplied);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setDraft(value === null || value === undefined ? "" : String(value));
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        onValueChange(clampValue(parseLocalizedDecimal(nextDraft)));
      }}
      onBlur={() => {
        setFocused(false);
        setDraft(formatDecimal(value));
      }}
      className={className}
    />
  );
}
