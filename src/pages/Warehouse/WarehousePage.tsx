import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Plus, Pencil } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { hasRole } from "@/utils/auth";
import { getApiErrorMessage } from "@/utils/apiError";
import { warehouseApi } from "@/service/warehouse";
import type { WarehouseItem, WarehouseReceipt } from "@/types/warehouse";

import WarehouseItemModal from "./components/WarehouseItemModal";
import WarehouseReceiptModal from "./components/WarehouseReceiptModal";

type Tab = "items" | "receipts";

const fmtDate = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function WarehousePage() {
  const canManage = hasRole("ky_thuat", "director", "director_la", "saleadmin", "salesadmin_la");

  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModal, setItemModal] = useState<WarehouseItem | null | undefined>(undefined);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemList, receiptList] = await Promise.all([
        warehouseApi.listItems(),
        canManage ? warehouseApi.listReceipts() : Promise.resolve([]),
      ]);
      setItems(itemList);
      setReceipts(receiptList);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được dữ liệu kho"));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col pb-20">
      <HeaderWithBack title="Quản lý kho thiết bị" />

      <div className="flex-1 mt-[60px] px-3 pb-6 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("items")}
            className={`py-2 text-sm rounded-lg border font-medium ${
              tab === "items"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            Tồn kho
          </button>
          {canManage && (
            <button
              onClick={() => setTab("receipts")}
              className={`py-2 text-sm rounded-lg border font-medium ${
                tab === "receipts"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              Phiếu nhập/xuất
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Đang tải…</p>
        ) : tab === "items" ? (
          <>
            {canManage && (
              <button
                onClick={() => setItemModal(null)}
                className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-600 active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus size={16} /> Thêm thiết bị
              </button>
            )}
            {items.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Kho chưa có thiết bị nào
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {item.code}
                        {item.imei ? ` · IMEI: ${item.imei}` : ""}
                      </p>
                      {item.note && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          item.quantity > 0 ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {item.quantity} {item.unit}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => setItemModal(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setReceiptModalOpen(true)}
              className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-600 active:scale-95 flex items-center justify-center gap-1"
            >
              <Plus size={16} /> Lập phiếu kho
            </button>
            {receipts.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Chưa có phiếu nhập/xuất kho
              </p>
            ) : (
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-800">
                        {r.type === "IN" ? "📥" : "📤"} {r.code}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(r.createdAt)}</p>
                    </div>
                    <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                      {r.items.map((line, i) => (
                        <li key={i}>
                          • {line.name} × {line.quantity} {line.unit}
                        </li>
                      ))}
                    </ul>
                    {r.note && (
                      <p className="mt-1 text-xs text-gray-400">{r.note}</p>
                    )}
                    {r.relatedSuggestId && (
                      <p className="mt-1 text-xs text-blue-500">
                        Liên quan đề xuất #{r.relatedSuggestId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {itemModal !== undefined && (
        <WarehouseItemModal
          item={itemModal}
          onClose={() => setItemModal(undefined)}
          onSaved={() => {
            setItemModal(undefined);
            load();
            toast.success("Đã lưu thiết bị");
          }}
        />
      )}

      {receiptModalOpen && (
        <WarehouseReceiptModal
          items={items}
          onClose={() => setReceiptModalOpen(false)}
          onSaved={() => {
            setReceiptModalOpen(false);
            load();
            toast.success("Đã lập phiếu kho");
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
