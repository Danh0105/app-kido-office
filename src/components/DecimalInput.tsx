import { useEffect, useState } from "react";
import { formatDecimal, parseLocalizedDecimal } from "@/utils/decimal";

/**
 * Định dạng lại chuỗi đang gõ dở với dấu phân cách nghìn (VD "5000000" ->
 * "5.000.000") mà vẫn giữ nguyên phần thập phân đang gõ dở (dùng dấu `,` kiểu
 * vi-VN) — không dùng `formatDecimal` vì hàm đó làm tròn/chuẩn hoá, gõ dở sẽ
 * bị nhảy số.
 *
 * Khi `allowDecimal=false` (số tiền VND không có phần thập phân), MỌI dấu
 * `,`/`.` gõ vào bị coi là dấu phân cách nghìn và bị bỏ qua khi tính giá trị —
 * tránh trường hợp dấu `.` do chính hàm này chèn vào (phân cách nghìn) bị lượt
 * gõ tiếp theo hiểu nhầm thành dấu thập phân, làm mất số (VD gõ "5,000,000"
 * ra "5,00000000").
 */
const liveFormat = (raw: string, allowDecimal: boolean) => {
  const negative = raw.trim().startsWith("-");
  let cleaned = raw.replace(/[^\d,.-]/g, "").replace(/(?!^)-/g, "");
  if (negative) cleaned = cleaned.replace(/^-/, "");
  const sign = negative ? "-" : "";

  if (!allowDecimal) {
    const intPart = cleaned.replace(/[.,]/g, "").replace(/^0+(?=\d)/, "");
    return intPart ? `${sign}${Number(intPart).toLocaleString("vi-VN")}` : "";
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const sepIdx = Math.max(lastComma, lastDot);

  const rawIntPart = (sepIdx >= 0 ? cleaned.slice(0, sepIdx) : cleaned).replace(
    /[.,]/g,
    "",
  );
  const decPart = (sepIdx >= 0 ? cleaned.slice(sepIdx + 1) : "").replace(
    /[.,]/g,
    "",
  );
  const intPart = rawIntPart.replace(/^0+(?=\d)/, "");

  const groupedInt = intPart ? Number(intPart).toLocaleString("vi-VN") : "";

  if (sepIdx >= 0) return `${sign}${groupedInt},${decPart}`;
  return `${sign}${groupedInt}`;
};

type DecimalInputProps = {
  value?: number | string | null;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Hiện "0" thật thay vì để trống khi giá trị bằng 0 (mặc định ẩn để trống). */
  keepZero?: boolean;
  /** false = số nguyên, không cho gõ phần thập phân (VD số tiền VND). Mặc định true. */
  allowDecimal?: boolean;
};

export default function DecimalInput({
  value,
  onValueChange,
  className = "",
  placeholder = "0",
  min = 0,
  max,
  disabled = false,
  keepZero = false,
  allowDecimal = true,
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const display = (v: typeof value) =>
    keepZero && Number(v ?? 0) === 0 ? "0" : formatDecimal(v);
  const [draft, setDraft] = useState(display(value));

  useEffect(() => {
    if (!focused) {
      setDraft(display(value));
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
        // Giá trị 0/rỗng thì để trống khi bắt đầu gõ — nếu giữ "0" trên ô,
        // gõ tiếp sẽ chèn sau số 0 đó (VD gõ "5000000" ra "05000000").
        setDraft(
          value === null || value === undefined || Number(value) === 0
            ? ""
            : String(value),
        );
      }}
      onChange={(event) => {
        const nextDraft = liveFormat(event.target.value, allowDecimal);
        setDraft(nextDraft);
        const parsed = allowDecimal
          ? parseLocalizedDecimal(nextDraft)
          : Number(nextDraft.replace(/[^\d-]/g, "")) || 0;
        onValueChange(clampValue(parsed));
      }}
      onBlur={() => {
        setFocused(false);
        setDraft(display(value));
      }}
      className={className}
    />
  );
}
