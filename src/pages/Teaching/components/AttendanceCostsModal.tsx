import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { AttendanceOtherCost } from "@/types/teaching";
import Modal, { inputClass } from "./Modal";
import { formatMoney } from "../lib";

type CostInput = { name: string; amount: string; note: string };
const MAX_COSTS = 20;
const MAX_AMOUNT = 100_000_000;

export default function AttendanceCostsModal({
  costs,
  onClose,
  onSave,
  readOnly = false,
}: {
  costs: AttendanceOtherCost[];
  onClose: () => void;
  onSave: (costs: AttendanceOtherCost[]) => void;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<CostInput[]>(() =>
    costs.map((item) => ({
      name: item.name,
      amount: String(item.amount),
      note: item.note || "",
    })),
  );
  const [error, setError] = useState("");

  const add = (name: string) => {
    if (rows.length >= MAX_COSTS) {
      setError(`Tối đa ${MAX_COSTS} khoản cho một buổi`);
      return;
    }
    setRows((prev) => [...prev, { name, amount: "", note: "" }]);
    setError("");
  };

  const update = (index: number, patch: Partial<CostInput>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = () => {
    const normalized: AttendanceOtherCost[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const name = row.name.trim();
      const amount = Number(row.amount);
      if (!name) return setError(`Khoản ${index + 1}: vui lòng nhập tên khoản`);
      if (name.length > 100) return setError(`Khoản ${index + 1}: tên tối đa 100 ký tự`);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || !/^\d+(?:\.\d{1,2})?$/.test(row.amount.trim())) {
        return setError(`Khoản ${index + 1}: số tiền phải từ 0 đến 100.000.000, tối đa 2 số lẻ`);
      }
      if (row.note.length > 500) return setError(`Khoản ${index + 1}: ghi chú tối đa 500 ký tự`);
      normalized.push({ name, amount, note: row.note.trim() || null });
    }
    onSave(normalized);
    onClose();
  };

  const total = rows.reduce((sum, row) => {
    const value = Number(row.amount);
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);

  return (
    <Modal title="Chi phí khác" submitLabel="Áp dụng" cancelLabel={readOnly ? "Đóng" : "Hủy"} wide onClose={onClose} onSubmit={readOnly ? undefined : submit}>
      {!readOnly && <div className="flex flex-wrap gap-2">
        <Quick label="Xăng xe" onClick={() => add("Xăng xe")} />
        <Quick label="Phụ cấp" onClick={() => add("Phụ cấp")} />
        <Quick label="Khoản khác" onClick={() => add("")} />
      </div>}

      {rows.length === 0 && <p className="py-5 text-center text-sm text-gray-400">Chưa có chi phí phát sinh.</p>}
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-xl border border-gray-200 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_11rem_auto]">
              <input disabled={readOnly} value={row.name} maxLength={100} onChange={(e) => update(index, { name: e.target.value })} placeholder="Tên khoản *" className={`${inputClass} disabled:bg-gray-50`} />
              <input disabled={readOnly} type="number" min={0} max={MAX_AMOUNT} step="0.01" value={row.amount} onChange={(e) => update(index, { amount: e.target.value })} placeholder="Số tiền *" className={`${inputClass} disabled:bg-gray-50`} />
              {!readOnly && <button type="button" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} className="flex min-h-10 items-center justify-center rounded-lg border border-red-100 px-3 text-red-500" aria-label="Xóa khoản"><Trash2 size={16} /></button>}
            </div>
            <input disabled={readOnly} value={row.note} maxLength={500} onChange={(e) => update(index, { note: e.target.value })} placeholder="Ghi chú (không bắt buộc)" className={`${inputClass} mt-2 disabled:bg-gray-50`} />
          </div>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <p className="text-right text-sm text-gray-600">Tổng chi phí: <b className="text-blue-700">{formatMoney(total)}</b></p>
    </Modal>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><Plus size={13} /> {label}</button>;
}
