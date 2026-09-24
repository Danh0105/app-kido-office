import { useState } from "react";

import type { WarehouseItem } from "@/types/warehouse";
import {
  warehouseApi,
  type CreateWarehouseItemPayload,
} from "@/service/warehouse";
import { getApiErrorMessage } from "@/utils/apiError";

/** Tạo mới / sửa thông tin một thiết bị trong kho. Sửa không đổi được tồn — tồn chỉ đổi qua phiếu nhập/xuất. */
export default function WarehouseItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: WarehouseItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [unit, setUnit] = useState(item?.unit || "cái");
  const [imei, setImei] = useState(item?.imei || "");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [note, setNote] = useState(item?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên thiết bị");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (item) {
        await warehouseApi.updateItem(item.id, {
          name: name.trim(),
          unit: unit.trim() || undefined,
          imei: imei.trim() || undefined,
          note: note.trim() || undefined,
        });
      } else {
        const payload: CreateWarehouseItemPayload = {
          name: name.trim(),
          unit: unit.trim() || undefined,
          imei: imei.trim() || undefined,
          note: note.trim() || undefined,
          initialQuantity: initialQuantity.trim()
            ? Number(initialQuantity)
            : undefined,
        };
        await warehouseApi.createItem(payload);
      }
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Lưu thiết bị thất bại"));
    } finally {
      setSaving(false);
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
          <h2 className="font-semibold">
            {item ? "Sửa thiết bị" : "Thêm thiết bị vào kho"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-600">
              Tên thiết bị <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder='VD: Màn hình tương tác 65"'
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Đơn vị</label>
            <input
              type="text"
              value={unit}
              maxLength={50}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="cái, bộ, chiếc…"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Số IMEI (không bắt buộc)</label>
            <input
              type="text"
              value={imei}
              maxLength={50}
              onChange={(e) => setImei(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: 356938035643809"
            />
          </div>

          {!item && (
            <div>
              <label className="text-sm text-gray-600">Số lượng tồn ban đầu</label>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Nếu &gt; 0, hệ thống tự tạo 1 phiếu nhập kho tương ứng.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">Ghi chú</label>
            <textarea
              value={note}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-violet-500 active:scale-95 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
