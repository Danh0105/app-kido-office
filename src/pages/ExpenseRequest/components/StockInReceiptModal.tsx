import { useState } from "react";

import type { StockInReceiptPayload } from "@/service/expenseRequest";
import type { StockInOrder } from "@/types/expenseRequest";

import StockInItemsEditor, {
  toStockInDrafts,
  validateStockInDrafts,
  type StockInDraft,
} from "./StockInItemsEditor";

/**
 * Người xử lý (do Giám đốc chỉ định) lập phiếu nhập kho thật cho đề xuất
 * thiết bị từ nhà cung cấp. Điền sẵn theo phiếu dự kiến của Giám đốc; sửa lại theo hàng
 * thực nhận (số lượng, đơn giá). Lập xong tồn kho tăng ngay.
 */
export default function StockInReceiptModal({
  order,
  loading,
  onClose,
  onSubmit,
}: {
  order?: StockInOrder | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: StockInReceiptPayload) => void;
}) {
  const [drafts, setDrafts] = useState<StockInDraft[]>(() =>
    toStockInDrafts(order?.draftItems),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const result = validateStockInDrafts(drafts);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    onSubmit({ items: result.items, note: note.trim() || undefined });
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
          <h2 className="font-semibold">📥 Lập phiếu nhập kho</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {order?.draftNote && (
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-800">
              <span className="font-medium">Ghi chú của Giám đốc: </span>
              {order.draftNote}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Đã điền sẵn theo phiếu dự kiến {order?.code ? `${order.code} ` : ""}
            của Giám đốc — sửa lại theo hàng thực nhận. Thiết bị mới sẽ được tạo
            mã trong kho khi lập phiếu.
          </p>

          <StockInItemsEditor value={drafts} onChange={setDrafts} />

          <div>
            <label className="text-sm text-gray-600">Ghi chú</label>
            <textarea
              value={note}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: nhà cung cấp, số hoá đơn…"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm resize-none"
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
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-cyan-600 active:scale-95 disabled:opacity-60"
          >
            {loading ? "Đang lưu…" : "Lập phiếu nhập kho"}
          </button>
        </div>
      </div>
    </div>
  );
}
