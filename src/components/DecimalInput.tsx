import { useEffect, useRef, useState } from "react";
import { formatDecimal, parseLocalizedDecimal } from "@/utils/decimal";
import { formatDecimalDraft, parseDecimalDraft } from "@/utils/decimalInput";

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
type DecimalInputProps = {
  value?: number | string | null;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  /** Gọi khi giá trị gõ vào vượt `max` (ô vẫn giữ giá trị đã chặn về `max`). */
  onOverMax?: (max: number) => void;
  disabled?: boolean;
  /** Hiện "0" thật thay vì để trống khi giá trị bằng 0 (mặc định ẩn để trống). */
  keepZero?: boolean;
  /** false = số nguyên, không cho gõ phần thập phân (VD số tiền VND). Mặc định true. */
  allowDecimal?: boolean;
  /** Chỉ đẩy giá trị ra component cha khi blur/Enter, để không tính khi đang gõ dở. */
  commitOnBlur?: boolean;
  /** Số chữ số thập phân khi hiển thị và khi đọc ở chế độ `commitOnBlur`. Mặc định 2. */
  fractionDigits?: number;
};

export default function DecimalInput({
  value,
  onValueChange,
  className = "",
  placeholder = "0",
  min = 0,
  max,
  onOverMax,
  disabled = false,
  keepZero = false,
  allowDecimal = true,
  commitOnBlur = false,
  fractionDigits = 2,
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const display = (v: typeof value) =>
    keepZero && Number(v ?? 0) === 0 ? "0" : formatDecimal(v, fractionDigits);
  const [draft, setDraft] = useState(display(value));
  // Chỉ bấm qua ô mà không gõ gì thì không ghi lại: giá trị cũ giữ nguyên độ chính xác.
  const dirty = useRef(false);

  useEffect(() => {
    if (!focused) {
      setDraft(display(value));
    }
  }, [focused, value]);

  const clampValue = (nextValue: number) => {
    const minimumApplied = Math.max(min, nextValue);
    return max === undefined ? minimumApplied : Math.min(max, minimumApplied);
  };

  const emit = (parsed: number) => {
    if (max !== undefined && parsed > max) onOverMax?.(max);
    const next = clampValue(parsed);
    onValueChange(next);
    return next;
  };

  const integerDraftValue = (nextDraft: string) =>
    Number(nextDraft.replace(/[^\d-]/g, "")) || 0;

  const commitDraft = () => {
    const parsed = allowDecimal
      ? parseDecimalDraft(draft, fractionDigits)
      : integerDraftValue(draft);
    setDraft(display(emit(parsed)));
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
        const nextDraft = formatDecimalDraft(
          event.target.value,
          allowDecimal,
          !commitOnBlur,
        );
        setDraft(nextDraft);
        dirty.current = true;
        if (commitOnBlur) return;
        emit(
          allowDecimal
            ? parseLocalizedDecimal(nextDraft)
            : integerDraftValue(nextDraft),
        );
      }}
      onBlur={() => {
        setFocused(false);
        if (commitOnBlur && dirty.current) {
          commitDraft();
        } else {
          setDraft(display(value));
        }
        dirty.current = false;
      }}
      onKeyDown={(event) => {
        if (commitOnBlur && event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
