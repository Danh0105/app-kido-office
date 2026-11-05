/**
 * Định dạng chuỗi đang gõ dở với dấu phân cách nghìn mà vẫn giữ
 * phần thập phân chưa hoàn tất, ví dụ `0.` → `0,`.
 */
export const formatDecimalDraft = (
  raw: string,
  allowDecimal: boolean,
  groupThousands = true,
) => {
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
  const groupedInt =
    intPart && groupThousands
      ? Number(intPart).toLocaleString("vi-VN")
      : intPart;

  if (sepIdx >= 0) return `${sign}${groupedInt},${decPart}`;
  return `${sign}${groupedInt}`;
};

/**
 * Đọc chuỗi do `formatDecimalDraft` tạo ra, nơi dấu `,` luôn là dấu thập phân.
 * Không dùng `parseLocalizedDecimal`: hàm đó coi `1,234` là một nghìn hai trăm
 * ba mươi tư, nên số tháng 1,234 sẽ thành 1234.
 */
export const parseDecimalDraft = (draft: string, fractionDigits = 2) => {
  const normalized = draft.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.round((parsed + Number.EPSILON) * factor) / factor;
};
