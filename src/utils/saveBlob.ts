type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;

export type SaveFileType = { description: string; accept: Record<string, string[]> };

export const IMAGE_FILE_TYPE: SaveFileType = {
  description: "Hình ảnh",
  accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
};

export const EXCEL_FILE_TYPE: SaveFileType = {
  description: "Excel",
  accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
};

/** Mở hộp thoại "Lưu thành..." khi có File System Access API, nếu không thì
 * rơi về cách tải mặc định của trình duyệt (blob URL + thẻ <a download>). */
export async function saveBlob(blob: Blob, fileName: string, fileType: SaveFileType) {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: fileName, types: [fileType] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      // Người dùng bấm huỷ thì dừng hẳn, lỗi khác mới dùng cách dự phòng.
      if ((error as DOMException)?.name === "AbortError") return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
