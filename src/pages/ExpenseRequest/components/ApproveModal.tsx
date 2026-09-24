import { useEffect, useState } from "react";
import DecimalInput from "@/components/DecimalInput";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelect from "@/components/MultiSelect";
import { employeeApi, type Employee } from "@/service/employee";
import {
  EQUIPMENT_SOURCE_META,
  KIND_META,
  type EquipmentSource,
  type ExpenseRequestKind,
  type RequestedEquipmentItem,
} from "@/types/expenseRequest";
import type { ApproveExpensePayload } from "@/service/expenseRequest";
import { warehouseApi } from "@/service/warehouse";
import type { WarehouseItem } from "@/types/warehouse";
import { getEmployeeId } from "@/utils/auth";
import { formatVnd } from "@/utils/decimal";
import { mainAssigneeLabel } from "../lib";
import StockInItemsEditor, {
  stockInDraftTotal,
  toStockInDrafts,
  validateStockInDrafts,
  type StockInDraft,
} from "./StockInItemsEditor";

const KINDS: ExpenseRequestKind[] = ["CASH", "EQUIPMENT", "REPAIR"];
const EQUIPMENT_SOURCES: EquipmentSource[] = ["STOCK", "SUPPLIER"];
const TECHNICAL_ROLE = "ky_thuat";

// Kèm SĐT để tìm được cả theo số điện thoại, và phân biệt người trùng tên.
const employeeLabel = (e: Employee) =>
  [e.name || `NV #${e.id}`, e.phone].filter(Boolean).join(" · ");

export default function ApproveModal({
  defaultAmount,
  requestedItems,
  loading,
  onClose,
  onSubmit,
}: {
  defaultAmount?: number | null;
  /** Thiết bị kinh doanh mong muốn — điền sẵn phiếu nhập kho khi mua từ nhà cung cấp. */
  requestedItems?: RequestedEquipmentItem[] | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: ApproveExpensePayload) => void;
}) {
  const [amount, setAmount] = useState<number>(defaultAmount || 0);
  const [kind, setKind] = useState<ExpenseRequestKind | "">("");
  const [equipmentSource, setEquipmentSource] = useState<EquipmentSource>("STOCK");
  const [technicianId, setTechnicianId] = useState<number | null>(null);
  // Người hỗ trợ người bàn giao — không chọn = không có người hỗ trợ.
  const [supporterIds, setSupporterIds] = useState<number[]>([]);
  const [technicians, setTechnicians] = useState<Employee[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [note, setNote] = useState("");
  const [stockItems, setStockItems] = useState<WarehouseItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [error, setError] = useState("");
  // --- thiết bị từ nhà cung cấp: phiếu nhập kho dự kiến + người xử lý + người nghiệm thu ---
  const [stockInDrafts, setStockInDrafts] = useState<StockInDraft[]>(() =>
    toStockInDrafts(requestedItems),
  );
  const [stockInNote, setStockInNote] = useState("");
  const [handlerId, setHandlerId] = useState<number | null>(null);
  const [acceptorId, setAcceptorId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Thiết bị từ nhà cung cấp không qua phòng kỹ thuật mà qua người xử lý /
  // người nghiệm thu do Giám đốc chỉ định.
  const isPurchase = kind === "EQUIPMENT" && equipmentSource === "SUPPLIER";
  const needsTechnician =
    (kind === "EQUIPMENT" && !isPurchase) || kind === "REPAIR";
  const showStock = kind === "EQUIPMENT" && !isPurchase;
  const me = Number(getEmployeeId());
  const purchaseTotal = stockInDraftTotal(stockInDrafts);

  // Danh sách toàn bộ nhân viên: chọn người xử lý/nghiệm thu (nhà cung cấp)
  // hoặc người hỗ trợ người bàn giao (có thể thuộc bất kỳ phòng ban nào).
  const needsEmployees = isPurchase || (needsTechnician && !!technicianId);

  useEffect(() => {
    if (!needsEmployees || employees.length > 0) return;
    setLoadingEmployees(true);
    employeeApi
      .getAll()
      .then((list: Employee[]) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setError("Không tải được danh sách nhân viên"))
      .finally(() => setLoadingEmployees(false));
  }, [needsEmployees, employees.length]);

  useEffect(() => {
    if (!showStock || stockItems.length > 0) return;
    setLoadingStock(true);
    warehouseApi
      .listItems()
      .then((list) => setStockItems(Array.isArray(list) ? list : []))
      .catch(() => setError("Không tải được danh sách thiết bị trong kho"))
      .finally(() => setLoadingStock(false));
  }, [showStock, stockItems.length]);

  useEffect(() => {
    if (!needsTechnician || technicians.length > 0) return;
    setLoadingTechnicians(true);
    employeeApi
      .getAll()
      .then((list: Employee[]) => {
        setTechnicians(
          (list || []).filter((e) => e.roles?.includes(TECHNICAL_ROLE)),
        );
      })
      .catch(() => setError("Không tải được danh sách nhân viên kỹ thuật"))
      .finally(() => setLoadingTechnicians(false));
  }, [needsTechnician, technicians.length]);

  const handleSubmit = () => {
    if (!kind) {
      setError("Vui lòng chọn loại đề xuất");
      return;
    }
    if (amount < 0) {
      setError("Số tiền không được âm");
      return;
    }
    if (isPurchase) {
      const result = validateStockInDrafts(stockInDrafts);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!handlerId) {
        setError("Vui lòng chọn nhân viên xử lý phiếu nhập");
        return;
      }
      if (!acceptorId) {
        setError("Vui lòng chọn người nghiệm thu bàn giao");
        return;
      }
      if (handlerId === acceptorId) {
        setError("Người xử lý và người nghiệm thu phải là hai người khác nhau");
        return;
      }
      // Số tiền = tổng thành tiền thiết bị; BE cũng tự tính lại từ phiếu.
      onSubmit({
        amount: purchaseTotal,
        requestKind: kind,
        equipmentSource: "SUPPLIER",
        note: note.trim() || undefined,
        stockInItems: result.items,
        stockInNote: stockInNote.trim() || undefined,
        stockInHandlerId: handlerId,
        acceptorId,
      });
      return;
    }
    onSubmit({
      amount: amount || undefined,
      requestKind: kind,
      equipmentSource: kind === "EQUIPMENT" ? "STOCK" : undefined,
      assignedTechnicianId:
        needsTechnician && technicianId ? technicianId : undefined,
      supporterIds:
        needsTechnician && technicianId && supporterIds.length > 0
          ? supporterIds
          : undefined,
      note: note.trim() || undefined,
    });
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
          <h2 className="font-semibold">Duyệt đề xuất</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-600">Số tiền</label>
            {isPurchase ? (
              <>
                {/* Mua từ nhà cung cấp: tự tính theo phiếu nhập, không gõ tay. */}
                <div className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-50 font-semibold text-gray-800">
                  {formatVnd(purchaseTotal) || "0"} đ
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Tự tính = tổng (số lượng × đơn giá) các thiết bị trong phiếu nhập kho.
                </p>
              </>
            ) : (
              <DecimalInput
                value={amount}
                onValueChange={setAmount}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="0"
                keepZero
                allowDecimal={false}
              />
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Loại đề xuất <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mt-1">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    if (k === "CASH") {
                      setTechnicianId(null);
                      setSupporterIds([]);
                    }
                  }}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium ${
                    kind === k
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {KIND_META[k].icon} {KIND_META[k].short}
                </button>
              ))}
            </div>
          </div>

          {kind === "EQUIPMENT" && (
            <div>
              <label className="text-sm text-gray-600">
                Nguồn thiết bị <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {EQUIPMENT_SOURCES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setEquipmentSource(src);
                      setError("");
                    }}
                    className={`py-2 text-xs rounded-lg border font-medium ${
                      equipmentSource === src
                        ? "bg-cyan-600 text-white border-cyan-600"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {EQUIPMENT_SOURCE_META[src].icon} {EQUIPMENT_SOURCE_META[src].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsTechnician && (
            <div>
              <label className="text-sm text-gray-600">
                {mainAssigneeLabel(kind || null)}
              </label>
              <SearchableSelect
                value={technicianId ? String(technicianId) : ""}
                onChange={(v) => {
                  const next = v ? Number(v) : null;
                  setTechnicianId(next);
                  // Không có người bàn giao thì cũng không có người hỗ trợ;
                  // người vừa thành người bàn giao thì bỏ khỏi người hỗ trợ.
                  setSupporterIds((prev) =>
                    next ? prev.filter((id) => id !== next) : [],
                  );
                }}
                options={technicians.map((t) => ({
                  id: t.id,
                  name: employeeLabel(t),
                }))}
                placeholder={
                  loadingTechnicians
                    ? "Đang tải…"
                    : "Không chỉ định (cả phòng kỹ thuật)"
                }
                searchPlaceholder="Tìm theo tên hoặc SĐT…"
                emptyLabel="Không tìm thấy nhân viên"
                disabled={loadingTechnicians}
                className="mt-1"
                portal
              />
              {!loadingTechnicians && technicians.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Không tìm thấy nhân viên phòng kỹ thuật
                </p>
              )}
            </div>
          )}

          {needsTechnician && technicianId && (
            <div>
              <label className="text-sm text-gray-600">Người hỗ trợ</label>
              <MultiSelect
                values={supporterIds}
                onChange={setSupporterIds}
                options={employees
                  .filter((e) => e.id !== technicianId)
                  .map((e) => ({ id: e.id, name: employeeLabel(e) }))}
                placeholder="Không có người hỗ trợ"
                searchPlaceholder="Tìm theo tên hoặc SĐT…"
                emptyLabel="Không tìm thấy nhân viên"
                loading={loadingEmployees}
                className="mt-1"
                portal
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Không bắt buộc. {mainAssigneeLabel(kind || null)} và người hỗ trợ đều có thể từ chối
                kèm lý do, khi đó bạn chọn người thay thế.
              </p>
            </div>
          )}

          {isPurchase && (
            <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
              <p className="text-xs text-cyan-800">
                Mua từ nhà cung cấp — lập phiếu nhập kho dự kiến và chỉ định người
                xử lý. Người xử lý sẽ lập phiếu nhập kho thật, sau đó người nghiệm
                thu xác nhận hoàn thành để đề xuất chạy về Quản lý thu chi.
              </p>

              <div>
                <label className="text-sm text-gray-600">
                  Phiếu nhập kho dự kiến <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <StockInItemsEditor
                    value={stockInDrafts}
                    onChange={setStockInDrafts}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">
                  Nhân viên xử lý phiếu nhập <span className="text-red-500">*</span>
                </label>
                {/* Ẩn chính người duyệt và người nghiệm thu: BE không cho trùng. */}
                <SearchableSelect
                  value={handlerId ? String(handlerId) : ""}
                  onChange={(v) => setHandlerId(v ? Number(v) : null)}
                  options={employees
                    .filter((e) => e.id !== me && e.id !== acceptorId)
                    .map((e) => ({ id: e.id, name: employeeLabel(e) }))}
                  placeholder={loadingEmployees ? "Đang tải…" : "Chọn nhân viên…"}
                  searchPlaceholder="Tìm theo tên hoặc SĐT…"
                  emptyLabel="Không tìm thấy nhân viên"
                  disabled={loadingEmployees}
                  className="mt-1"
                  portal
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">
                  Người nghiệm thu bàn giao <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={acceptorId ? String(acceptorId) : ""}
                  onChange={(v) => setAcceptorId(v ? Number(v) : null)}
                  options={employees
                    .filter((e) => e.id !== handlerId)
                    .map((e) => ({ id: e.id, name: employeeLabel(e) }))}
                  placeholder={
                    loadingEmployees ? "Đang tải…" : "Chọn người nghiệm thu…"
                  }
                  searchPlaceholder="Tìm theo tên hoặc SĐT…"
                  emptyLabel="Không tìm thấy nhân viên"
                  disabled={loadingEmployees}
                  className="mt-1"
                  portal
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Ghi chú cho người xử lý</label>
                <textarea
                  value={stockInNote}
                  onChange={(e) => setStockInNote(e.target.value)}
                  placeholder="VD: mua tại nhà cung cấp…, cần trước ngày…"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm resize-none bg-white"
                />
              </div>
            </div>
          )}

          {showStock && (
            <div>
              <label className="text-sm text-gray-600">
                Thiết bị đang có trong kho
              </label>
              <div className="mt-1 max-h-40 overflow-y-auto border rounded-lg divide-y">
                {loadingStock && (
                  <p className="text-xs text-gray-400 p-2">Đang tải…</p>
                )}
                {!loadingStock && stockItems.length === 0 && (
                  <p className="text-xs text-gray-400 p-2">Kho chưa có thiết bị nào</p>
                )}
                {!loadingStock &&
                  stockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-500 text-xs">
                        Tồn: {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">Ghi chú chung</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cho đề xuất này (không bắt buộc)"
              rows={2}
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
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-blue-500 active:scale-95 disabled:opacity-60"
          >
            {loading ? "Đang xử lý…" : "Duyệt đề xuất"}
          </button>
        </div>
      </div>
    </div>
  );
}
