export const roundDecimal = (value: number, fractionDigits = 2) => {
  const factor = 10 ** fractionDigits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const parseLocalizedDecimal = (
  rawValue: string,
  fractionDigits = 2,
) => {
  const cleaned = rawValue.replace(/[^\d,.-]/g, "").replace(/(?!^)-/g, "");
  if (!cleaned || cleaned === "-") return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator =
    lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";

  let normalized = cleaned;

  if (decimalSeparator) {
    const separatorIndex = cleaned.lastIndexOf(decimalSeparator);
    const decimals = cleaned.length - separatorIndex - 1;
    const isThousandsSeparator =
      decimals === 3 &&
      !cleaned.includes(decimalSeparator === "," ? "." : ",");

    if (isThousandsSeparator) {
      normalized = cleaned.replace(/[.,]/g, "");
    } else {
      const integerPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, "");
      const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "");
      normalized = `${integerPart}.${decimalPart}`;
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundDecimal(parsed, fractionDigits) : 0;
};

export const formatDecimal = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed === 0) return "";

  return parsed.toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
};

export const formatVnd = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed === 0) return "";

  return parsed.toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  });
};

export const parseVnd = (rawValue: string) => {
  const cleaned = rawValue.replace(/\D/g, "");
  return cleaned ? Number(cleaned) : 0;
};
