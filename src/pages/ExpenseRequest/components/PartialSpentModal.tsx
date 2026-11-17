import { useMemo, useState } from "react";

import type { ExpenseMonthlyItem } from "@/types/expenseRequest";
import { monthlyItemLabel } from "../lib";

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const money = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")} đ`;

/**
 * Chi tháng nhiều trường mà chỉ chi một số trường: kinh doanh tích trường đã
 * chi, không nhập số. Số đã chi = phần của các trường đó lúc Giám đốc duyệt,
 * phần còn lại Thủ quỹ nhận lại.
 */
export default function PartialSpentModal({
  items,
  orderAmount,
  loading,
  onClose,
  onSubmit,
}: {
  items: ExpenseMonthlyItem[];
  orderAmount: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    spentItemIds: number[];
    reason: string;
    files: File[];
  }) => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const spentAmount = useMemo(
    () =>
      items
        .filter((item) => item.id != null && checked.has(item.id))
        .reduce((sum, item) => sum + Number(item.approvedAmount || 0), 0),
    [items, checked]
  );
  const returnAmount = Math.round((orderAmount - spentAmount) * 100) / 100;

  const toggle = (id: number) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickFiles = (list: FileList | null) => {
    const arr = Array.from(list || []);
    if (arr.length + files.length > MAX_FILES) {
      setError(`Tối đa ${MAX_FILES} tệp`);
      return;
    }
    if (arr.some((file) => file.size > MAX_SIZE)) {
      setError("Mỗi tệp tối đa 50MB");
      return;
    }
    setError("");
    setFiles((current) => [...current, ...arr]);
  };

  const submit = () => {
    if (checked.size === 0) return setError("Chọn ít nhất một trường đã chi");
    if (checked.size === items.length)
      return setError('Đã chi tất cả các trường — dùng nút "Đã chi"');
    if (!reason.trim()) return setError("Nhập lý do các trường không chi");
    setError("");
    onSubmit({ spentItemIds: [...checked], reason: reason.trim(), files });
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
          <h2 className="font-semibold">Xác nhận đã chi một phần</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Tích các trường <b>đã chi</b>. Số tiền mỗi trường lấy theo cột Còn
            chi lúc Giám đốc duyệt; phần của các trường không chi sẽ hoàn về
            quỹ.
          </p>

          <ul className="space-y-2">
            {items.map((item) => {
              const id = Number(item.id);
              const on = checked.has(id);
              return (
                <li key={id}>
                  <label
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                      on
                        ? "border-teal-300 bg-teal-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={on}
                      onChange={() => toggle(id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-800">
                        {item.school?.name || `Trường #${item.schoolId}`}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {monthlyItemLabel(item)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-gray-800">
                      {money(Number(item.approvedAmount || 0))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-teal-50 px-3 py-2">
              <div className="text-xs text-teal-700">Đã chi</div>
              <div className="font-semibold text-teal-800">
                {money(spentAmount)}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              <div className="text-xs text-amber-700">Hoàn quỹ</div>
              <div className="font-semibold text-amber-800">
                {money(Math.max(returnAmount, 0))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Lý do các trường không chi <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: TH B tạm dừng lớp tháng này"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Chứng từ đã chi (tối đa {MAX_FILES})
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => pickFiles(e.target.files)}
              className="w-full mt-1 text-sm"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1"
                  >
                    <span className="truncate">📎 {file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                      className="text-red-500 ml-2"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-medium disabled:opacity-60"
          >
            {loading ? "Đang gửi…" : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
