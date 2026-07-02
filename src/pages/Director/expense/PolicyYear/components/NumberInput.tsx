type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
};

export default function NumberInput({
  value,
  onChange,
  disabled = false,
  min = 0,
  max,
  className = "",
  ariaLabel,
}: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      min={min}
      max={max}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(Number(event.target.value || 0))}
      className={`h-9 min-w-[76px] rounded-lg border border-slate-200 bg-white px-2.5 text-right text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
    />
  );
}

