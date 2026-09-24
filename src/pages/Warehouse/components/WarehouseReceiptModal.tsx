import { useState } from "react";

import type { WarehouseItem, WarehouseReceiptType } from "@/types/warehouse";
import {
  warehouseApi,
  type CreateWarehouseReceiptPayload,
} from "@/service/warehouse";
import { getApiErrorMessage } from "@/utils/apiError";

type LineDraft = { warehouseItemId: string; quantity: string };

const emptyLine = (): LineDraft => ({ warehouseItemId: "", quantity: "1" });

export default function WarehouseReceiptModal({
  items,
  onClose,
  onSaved,
}: {
  /** Danh sách thiết bị hiện có trong kho để chọn. */
  items: WarehouseItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<WarehouseReceiptType>("IN");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changeLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const itemById = (id: string) => items.find((it) => String(it.id) === id);

  const submit = async () => {
    const filled = lines.filter((l) => l.warehouseItemId);
    if (filled.length === 0) {
      setError("Chọn ít nhất 1 thiết bị");
      return;
    }
    const invalidQty = filled.findIndex(
      (l) => !/^\d+$/.test(l.quantity.trim()) || Number(l.quantity) <= 0,
    );
    if (invalidQty >= 0) {
      setError(`Dòng ${invalidQty + 1}: số lượng phải là số nguyên > 0`);
      return;
    }
    if (type === "OUT") {
      const overStock = filled.findIndex((l) => {
        const item = itemById(l.warehouseItemId);
        return item && Number(l.quantity) > item.quantity;
      });
      if (overStock >= 0) {
        setError(`Dòng ${overStock + 1}: vượt số lượng tồn trong kho`);
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const payload: CreateWarehouseReceiptPayload = {
        type,
        items: filled.map((l) => ({
          warehouseItemId: Number(l.warehouseItemId),
          quantity: Number(l.quantity),
        })),
        note: note.trim() || undefined,
      };
      await warehouseApi.createReceipt(payload);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Lập phiếu thất bại"));
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
        className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Lập phiếu kho</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["IN", "OUT"] as WarehouseReceiptType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 text-sm rounded-lg border font-medium ${
                  type === t
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {t === "IN" ? "📥 Phiếu nhập kho" : "📤 Phiếu xuất kho"}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Thiết bị <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 space-y-2">
              {lines.map((line, index) => {
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-2 flex items-center gap-2"
                  >
                    <select
                      value={line.warehouseItemId}
                      onChange={(e) =>
                        changeLine(index, { warehouseItemId: e.target.value })
                      }
                      className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Chọn thiết bị…</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} (tồn {it.quantity} {it.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) =>
                        changeLine(index, { quantity: e.target.value })
                      }
                      className="w-20 px-2 py-2 border rounded-lg text-sm"
                      placeholder="SL"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-2 w-full py-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-600 active:scale-95"
            >
              + Thêm dòng
            </button>
          </div>

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
            {saving ? "Đang lưu…" : "Lập phiếu"}
          </button>
        </div>
      </div>
    </div>
  );
}
