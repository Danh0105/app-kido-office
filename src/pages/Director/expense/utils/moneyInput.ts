/**
 * Đọc số tiền gõ/dán kiểu Việt Nam, tối đa 2 số lẻ (19/11/2026):
 * - có dấu ",": dấu "," cuối là dấu thập phân, mọi dấu "." là phân cách nghìn
 *   ("59.843,52" → 59843.52);
 * - không có ",": chỉ MỘT dấu "." và sau nó 1–2 chữ số thì là dấu thập phân
 *   ("59843.52" → 59843.52), còn lại "." là phân cách nghìn
 *   ("68.983.200" → 68983200, "1.200" → 1200).
 * Trống → null. Số âm không nhận.
 */
export function parseMoneyInput(raw: string): number | null {
  const text = String(raw ?? "").replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!text || !/\d/.test(text)) return null;
  let intPart: string;
  let decPart = "";
  const lastComma = text.lastIndexOf(",");
  if (lastComma >= 0) {
    intPart = text.slice(0, lastComma).replace(/[.,]/g, "");
    decPart = text.slice(lastComma + 1).replace(/[.,]/g, "");
  } else {
    const dots = text.split(".");
    if (dots.length === 2 && dots[1].length >= 1 && dots[1].length <= 2) {
      intPart = dots[0];
      decPart = dots[1];
    } else {
      intPart = text.replace(/\./g, "");
    }
  }
  const value = Number(`${intPart || "0"}.${decPart || "0"}`);
  if (!Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Hiện số tiền kiểu Việt Nam, tối đa 2 số lẻ: 59843.52 → "59.843,52". */
export const formatMoneyInput = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? ""
    : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
