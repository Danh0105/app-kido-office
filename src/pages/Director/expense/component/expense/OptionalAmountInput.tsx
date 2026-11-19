import { useState } from "react";

import { formatDecimal } from "@/utils/decimal";

/**
 * Ô số tiền có giá trị tự tính: để trống = tự tính (placeholder hiện số tự
 * tính), nhập số (kể cả 0) = số nhập tay. Ghi khi rời ô / Enter; xoá trống để
 * về tự tính. Dùng cho Thuế TNCN (Giáo viên trường) và Tổng thanh toán công ty.
 */
export default function OptionalAmountInput({
  value,
  autoValue,
  disabled,
  onChange,
  className,
  title,
}: {
  value: number | string | null | undefined;
  autoValue: number;
  disabled?: boolean;
  onChange: (value: number | "") => void;
  className?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const empty = value === "" || value === undefined || value === null;
  const shown = draft ?? (empty ? "" : formatDecimal(Number(value)) || "0");
  return (
    <input
      type="text"
      inputMode="numeric"
      value={shown}
      title={title}
      placeholder={formatDecimal(autoValue) || "0"}
      disabled={disabled}
      onFocus={() =>
        setDraft(empty ? "" : String(Math.round(Number(value) || 0)))
      }
      onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const next = (draft ?? "").trim();
        setDraft(null);
        onChange(next === "" ? "" : Number(next));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={className}
    />
  );
}
