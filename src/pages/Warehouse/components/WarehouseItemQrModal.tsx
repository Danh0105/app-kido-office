import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Camera, Download, ImagePlus } from "lucide-react";

import type { WarehouseItem } from "@/types/warehouse";
import { warehouseApi } from "@/service/warehouse";
import { getApiErrorMessage } from "@/utils/apiError";

import {
  compressImage,
  exportQrLabel,
  renderQrLabel,
  toFileUrl,
} from "../warehouseQr";

/** Ảnh chụp thiết bị + tem QR để tải/chia sẻ/in dán lên thiết bị. */
export default function WarehouseItemQrModal({
  item: initialItem,
  canManage,
  onClose,
  onImageChanged,
}: {
  item: WarehouseItem;
  canManage: boolean;
  onClose: () => void;
  onImageChanged: (item: WarehouseItem) => void;
}) {
  const [item, setItem] = useState(initialItem);
  const [qrPreview, setQrPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    renderQrLabel(item)
      .then(setQrPreview)
      .catch(() => toast.error("Không tạo được mã QR"));
  }, [item]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const updated = await warehouseApi.uploadItemImage(item.id, blob);
      setItem(updated);
      onImageChanged(updated);
      toast.success("Đã lưu ảnh thiết bị");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Tải ảnh thất bại"));
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportQrLabel(item);
    } catch (err) {
      // Người dùng đóng hộp chia sẻ — không phải lỗi.
      if (!/cancel/i.test(String((err as Error)?.message))) {
        toast.error("Xuất mã QR thất bại");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{item.name}</h2>
            <p className="text-xs text-gray-400">{item.code}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Ảnh thiết bị</p>
            {item.imageUrl ? (
              <a
                href={toFileUrl(item.imageUrl)}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={toFileUrl(item.imageUrl)}
                  alt={item.name}
                  className="w-full max-h-64 object-contain rounded-xl bg-gray-50 border"
                />
              </a>
            ) : (
              <div className="h-32 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-400">
                Chưa có ảnh
              </div>
            )}
            {canManage && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => cameraInput.current?.click()}
                  className="py-2 rounded-lg bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
                >
                  <Camera size={16} /> {uploading ? "Đang tải…" : "Chụp ảnh"}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => galleryInput.current?.click()}
                  className="py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
                >
                  <ImagePlus size={16} /> Chọn ảnh
                </button>
                <input
                  ref={cameraInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFile}
                />
                <input
                  ref={galleryInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Tem QR</p>
            <div className="rounded-xl border bg-gray-50 p-3 flex justify-center">
              {qrPreview ? (
                <img src={qrPreview} alt={`QR ${item.code}`} className="w-56" />
              ) : (
                <p className="text-sm text-gray-400 py-8">Đang tạo mã QR…</p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Quét mã sẽ thấy mã, tên, serial/IMEI và link ảnh thiết bị.
            </p>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleExport}
            disabled={exporting || !qrPreview}
            className="w-full py-2 text-sm rounded-xl text-white font-medium bg-violet-500 flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
          >
            <Download size={16} /> {exporting ? "Đang xuất…" : "Xuất mã QR"}
          </button>
        </div>
      </div>
    </div>
  );
}
