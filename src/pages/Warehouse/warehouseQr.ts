import QRCode from "qrcode";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import type { WarehouseItem } from "@/types/warehouse";

const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/** URL tuyệt đối tới file do BE phục vụ (ảnh thiết bị lưu dạng `/uploads/...`). */
export const toFileUrl = (path?: string | null) =>
  !path ? "" : /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;

/**
 * Nội dung mã QR — dạng chữ để quét bằng bất kỳ app camera nào cũng đọc được
 * thông tin thiết bị, kèm link ảnh chụp nếu có.
 */
export const buildQrText = (item: WarehouseItem) =>
  [
    `KIDO - ${item.code}`,
    `Thiết bị: ${item.name}`,
    item.imei ? `Serial/IMEI: ${item.imei}` : "",
    item.imageUrl ? `Ảnh: ${toFileUrl(item.imageUrl)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

/** Thu nhỏ ảnh chụp (cạnh dài tối đa `maxSize`) và nén JPEG trước khi upload. */
export const compressImage = async (
  file: File,
  maxSize = 1600,
  quality = 0.85
): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Không nén được ảnh")),
      "image/jpeg",
      quality
    )
  );
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** Vẽ tem QR (mã QR + tên + mã thiết bị) ra PNG data URL để tải/in. */
export const renderQrLabel = async (item: WarehouseItem): Promise<string> => {
  const width = 600;
  const padding = 40;
  const qrSize = width - padding * 2;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, buildQrText(item), {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 32px sans-serif";
  const nameLines = wrapText(ctx, item.name, qrSize).slice(0, 3);
  const subLines = [
    item.code,
    item.imei ? `Serial/IMEI: ${item.imei}` : "",
  ].filter(Boolean);

  canvas.width = width;
  canvas.height =
    padding +
    qrSize +
    24 +
    nameLines.length * 42 +
    subLines.length * 34 +
    padding;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);

  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  let y = padding + qrSize + 24 + 32;
  ctx.font = "bold 32px sans-serif";
  for (const line of nameLines) {
    ctx.fillText(line, width / 2, y);
    y += 42;
  }
  ctx.fillStyle = "#4b5563";
  ctx.font = "26px sans-serif";
  for (const line of subLines) {
    ctx.fillText(line, width / 2, y);
    y += 34;
  }

  return canvas.toDataURL("image/png");
};

/** Tải tem QR về máy — trên app native thì mở hộp chia sẻ (lưu ảnh, gửi Zalo, in…). */
export const exportQrLabel = async (item: WarehouseItem) => {
  const dataUrl = await renderQrLabel(item);
  const fileName = `QR-${item.code}.png`;

  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({
      path: fileName,
      data: dataUrl.split(",")[1],
      directory: Directory.Cache,
    });
    await Share.share({
      title: `QR ${item.code}`,
      files: [saved.uri],
    });
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};
