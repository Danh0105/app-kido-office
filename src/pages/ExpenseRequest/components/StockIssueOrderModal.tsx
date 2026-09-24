import { useEffect, useState } from "react";

import type { StockIssueOrderPayload } from "@/service/expenseRequest";
import type { StockIssueItem } from "@/types/expenseRequest";
import { warehouseApi } from "@/service/warehouse";
import type { WarehouseItem } from "@/types/warehouse";

import { todayISO } from "../lib";

/** Dòng đang nhập: số lượng để dạng chuỗi cho ô input rỗng được. */
type ItemDraft = {
  name: string;
  quantity: string;
  unit: string;
  note: string;
  /** Nếu chọn từ thiết bị có sẵn trong kho — tên/đơn vị bị khoá theo kho. */
  warehouseItemId: string;
};

const emptyItem = (): ItemDraft => ({
  name: "",
  quantity: "1",
  unit: "",
  note: "",
  warehouseItemId: "",
});

/** Số lượng phải là số nguyên dương — cùng luật với `StockIssueItemDto` bên BE. */
const isValidQuantity = (value: string) => /^\d+$/.test(value.trim()) && Number(value) > 0;

export default function StockIssueOrderModal({
  retry = false,
  loading,
  defaultItems,
  onClose,
  onSubmit,
}: {
  /** Lập lại lệnh sau khi thiết bị đã nhập lại kho (EQUIPMENT_RETURNED). */
  retry?: boolean;
  loading?: boolean;
  /** Lệnh cũ (nếu lập lại) — điền sẵn để không phải gõ lại từ đầu. */
  defaultItems?: StockIssueItem[];
  onClose: () => void;
  onSubmit: (payload: StockIssueOrderPayload) => void;
}) {
  const [items, setItems] = useState<ItemDraft[]>(() =>
    defaultItems?.length
      ? defaultItems.map((item) => ({
          name: item.name || "",
          quantity: String(item.quantity ?? 1),
          unit: item.unit || "",
          note: item.note || "",
          warehouseItemId: item.warehouseItemId ? String(item.warehouseItemId) : "",
        }))
      : [emptyItem()],
  );
  const [warehouse, setWarehouse] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [stockItems, setStockItems] = useState<WarehouseItem[]>([]);

  useEffect(() => {
    warehouseApi
      .listItems()
      .then(setStockItems)
      .catch(() => setStockItems([]));
  }, []);

  const pickFromStock = (index: number, warehouseItemId: string) => {
    const stock = stockItems.find((it) => String(it.id) === warehouseItemId);
    changeItem(index, {
      warehouseItemId,
      name: stock ? stock.name : "",
      unit: stock ? stock.unit : "",
    });
  };

  const changeItem = (index: number, patch: Partial<ItemDraft>) =>
    setItems((prev) =>
      prev.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  // Luôn giữ lại 1 dòng: lệnh xuất kho rỗng thì backend trả 400 mà người dùng
  // lại không còn ô nào để gõ.
  const removeItem = (index: number) =>
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, position) => position !== index),
    );

  const handleSubmit = () => {
    const filled = items.filter(
      (item) => item.name.trim() || item.note.trim() || item.unit.trim(),
    );
    if (filled.length === 0) {
      setError("Lệnh xuất kho phải có ít nhất 1 thiết bị");
      return;
    }

    const invalidName = filled.findIndex((item) => !item.name.trim());
    if (invalidName >= 0) {
      setError(`Dòng ${invalidName + 1}: chưa nhập tên thiết bị`);
      return;
    }

    const tooLong = filled.findIndex((item) => item.name.trim().length > 255);
    if (tooLong >= 0) {
      setError(`Dòng ${tooLong + 1}: tên thiết bị tối đa 255 ký tự`);
      return;
    }

    const invalidQuantity = filled.findIndex(
      (item) => !isValidQuantity(item.quantity),
    );
    if (invalidQuantity >= 0) {
      setError(`Dòng ${invalidQuantity + 1}: số lượng phải là số nguyên > 0`);
      return;
    }

    setError("");
    onSubmit({
      items: filled.map((item) => ({
        name: item.name.trim(),
        quantity: Number(item.quantity),
        unit: item.unit.trim() || undefined,
        note: item.note.trim() || undefined,
        warehouseItemId: item.warehouseItemId
          ? Number(item.warehouseItemId)
          : undefined,
      })),
      warehouse: warehouse.trim() || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">
            {retry ? "Lên lại lệnh xuất kho" : "Lên lệnh xuất kho"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {retry && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Lệnh mới sẽ thay lệnh xuất kho cũ của đề xuất này. Lịch sử các lần
              xuất kho trước vẫn giữ nguyên trong phần Lịch sử.
            </p>
          )}

          <div>
            <label className="text-sm text-gray-600">
              Thiết bị xuất kho <span className="text-red-500">*</span>
            </label>

            <div className="mt-1 space-y-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 p-2 space-y-2"
                >
                  {stockItems.length > 0 && (
                    <select
                      value={item.warehouseItemId}
                      onChange={(e) => pickFromStock(index, e.target.value)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs text-gray-600"
                    >
                      <option value="">Gõ tay (thiết bị cần mua mới)</option>
                      {stockItems.map((stock) => (
                        <option key={stock.id} value={stock.id}>
                          Có sẵn trong kho: {stock.name} (tồn {stock.quantity}{" "}
                          {stock.unit})
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-xs font-semibold text-gray-400">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      maxLength={255}
                      disabled={!!item.warehouseItemId}
                      onChange={(e) => changeItem(index, { name: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder='Tên thiết bị — VD: Màn hình tương tác 65"'
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      title="Xoá dòng"
                      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex gap-2 pl-8">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) =>
                        changeItem(index, { quantity: e.target.value })
                      }
                      className="w-20 px-2 py-2 border rounded-lg text-sm"
                      placeholder="SL"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      maxLength={50}
                      disabled={!!item.warehouseItemId}
                      onChange={(e) => changeItem(index, { unit: e.target.value })}
                      className="w-24 px-2 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Đơn vị"
                    />
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => changeItem(index, { note: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
                      placeholder="Ghi chú (không bắt buộc)"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-2 w-full py-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-600 active:scale-95"
            >
              + Thêm thiết bị
            </button>
          </div>

          <div>
            <label className="text-sm text-gray-600">Kho xuất hàng</label>
            <input
              type="text"
              value={warehouse}
              maxLength={255}
              onChange={(e) => setWarehouse(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Kho Bình Dương (không bắt buộc)"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Ngày giao dự kiến</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              min={todayISO()}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Giao trước ngày khai giảng"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-violet-500 active:scale-95 disabled:opacity-60"
          >
            {loading
              ? "Đang xử lý…"
              : retry
                ? "Lên lại lệnh xuất kho"
                : "Lên lệnh xuất kho"}
          </button>
        </div>
      </div>
    </div>
  );
}
