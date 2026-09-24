import { useEffect, useState } from "react";

import DecimalInput from "@/components/DecimalInput";
import type { StockInItem } from "@/types/expenseRequest";
import { warehouseApi } from "@/service/warehouse";
import type { WarehouseItem } from "@/types/warehouse";
import { formatVnd } from "@/utils/decimal";

/** Dòng đang nhập: số lượng để dạng chuỗi cho ô input rỗng được. */
export type StockInDraft = {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: number;
  /** Chọn thiết bị đã có mã trong kho; "" = thiết bị mới, kho tự tạo mã khi nhập. */
  warehouseItemId: string;
};

export const emptyStockInDraft = (): StockInDraft => ({
  name: "",
  quantity: "1",
  unit: "",
  unitPrice: 0,
  warehouseItemId: "",
});

export const toStockInDrafts = (
  items?: { name?: string; quantity?: number; unit?: string | null; unitPrice?: number | null; warehouseItemId?: number | null }[] | null,
): StockInDraft[] =>
  items?.length
    ? items.map((it) => ({
        name: it.name || "",
        quantity: String(it.quantity ?? 1),
        unit: it.unit || "",
        unitPrice: Number(it.unitPrice) || 0,
        warehouseItemId: it.warehouseItemId ? String(it.warehouseItemId) : "",
      }))
    : [emptyStockInDraft()];

/** Số lượng phải là số nguyên dương — cùng luật với `StockInItemDto` bên BE. */
const isValidQuantity = (value: string) =>
  /^\d+$/.test(value.trim()) && Number(value) > 0;

/** Kiểm tra + chuyển các dòng đang nhập thành payload; trả về chuỗi lỗi nếu sai. */
export const validateStockInDrafts = (
  drafts: StockInDraft[],
): { items: StockInItem[] } | { error: string } => {
  const filled = drafts.filter((d) => d.name.trim() || d.warehouseItemId);
  if (filled.length === 0) return { error: "Phiếu nhập kho phải có ít nhất 1 thiết bị" };

  for (let i = 0; i < filled.length; i++) {
    if (!filled[i].name.trim()) return { error: `Dòng ${i + 1}: thiếu tên thiết bị` };
    if (!isValidQuantity(filled[i].quantity)) {
      return { error: `Dòng ${i + 1}: số lượng phải là số nguyên > 0` };
    }
  }

  return {
    items: filled.map((d) => ({
      name: d.name.trim(),
      quantity: Number(d.quantity),
      unit: d.unit.trim() || undefined,
      unitPrice: d.unitPrice > 0 ? d.unitPrice : undefined,
      warehouseItemId: d.warehouseItemId ? Number(d.warehouseItemId) : undefined,
    })),
  };
};

export const stockInDraftTotal = (drafts: StockInDraft[]) =>
  drafts.reduce(
    (sum, d) => sum + (isValidQuantity(d.quantity) ? Number(d.quantity) : 0) * (d.unitPrice || 0),
    0,
  );

/**
 * Bảng nhập các dòng thiết bị của phiếu nhập kho (thiết bị từ nhà cung cấp). Dùng
 * chung cho Giám đốc lập phiếu dự kiến và người xử lý lập phiếu thật.
 */
export default function StockInItemsEditor({
  value,
  onChange,
}: {
  value: StockInDraft[];
  onChange: (next: StockInDraft[]) => void;
}) {
  const [stockItems, setStockItems] = useState<WarehouseItem[]>([]);

  useEffect(() => {
    // Người xử lý có thể không có quyền xem kho — khi đó chỉ nhập thiết bị mới.
    warehouseApi
      .listItems()
      .then((list) => setStockItems(Array.isArray(list) ? list : []))
      .catch(() => setStockItems([]));
  }, []);

  const change = (index: number, patch: Partial<StockInDraft>) =>
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const pickFromStock = (index: number, warehouseItemId: string) => {
    const stock = stockItems.find((it) => String(it.id) === warehouseItemId);
    change(index, {
      warehouseItemId,
      name: stock ? stock.name : "",
      unit: stock ? stock.unit : "",
    });
  };

  const total = stockInDraftTotal(value);

  return (
    <div>
      <div className="space-y-2">
        {value.map((d, index) => {
          const fromStock = !!d.warehouseItemId;
          return (
            <div key={index} className="rounded-xl border border-gray-200 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 w-5 shrink-0">
                  {index + 1}.
                </span>
                {stockItems.length > 0 && (
                  <select
                    value={d.warehouseItemId}
                    onChange={(e) => pickFromStock(index, e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-xs bg-white"
                  >
                    <option value="">🆕 Thiết bị mới (chưa có mã trong kho)</option>
                    {stockItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} · {it.name} (tồn {it.quantity} {it.unit})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  disabled={value.length <= 1}
                  className="ml-auto w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:text-gray-300"
                  aria-label="Xoá dòng"
                >
                  ✕
                </button>
              </div>

              <input
                value={d.name}
                onChange={(e) => change(index, { name: e.target.value })}
                disabled={fromStock}
                placeholder="Tên thiết bị"
                className="w-full px-2 py-1.5 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />

              <div className="grid grid-cols-[4.5rem_4.5rem_1fr] gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={d.quantity}
                  onChange={(e) => change(index, { quantity: e.target.value })}
                  placeholder="SL"
                  className="px-2 py-1.5 border rounded-lg text-sm"
                />
                <input
                  value={d.unit}
                  onChange={(e) => change(index, { unit: e.target.value })}
                  disabled={fromStock}
                  placeholder="Đơn vị"
                  className="px-2 py-1.5 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
                <DecimalInput
                  value={d.unitPrice}
                  onValueChange={(v) => change(index, { unitPrice: v })}
                  placeholder="Đơn giá (đ)"
                  className="px-2 py-1.5 border rounded-lg text-sm min-w-0"
                  allowDecimal={false}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...value, emptyStockInDraft()])}
        className="mt-2 w-full py-2 rounded-lg border border-dashed border-cyan-300 text-sm font-medium text-cyan-700 active:scale-95"
      >
        + Thêm thiết bị
      </button>

      {total > 0 && (
        <p className="mt-2 text-right text-sm text-gray-600">
          Tổng tiền: <span className="font-semibold text-gray-900">{formatVnd(total)} đ</span>
        </p>
      )}
    </div>
  );
}
