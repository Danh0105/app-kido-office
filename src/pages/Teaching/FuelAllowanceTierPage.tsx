import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  fuelAllowanceTierApi,
  type FuelAllowanceTier,
} from "@/service/fuelAllowanceTier.api";
import { getApiErrorMessage } from "@/utils/apiError";
import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import Modal, { ConfirmModal, Field, inputClass } from "./components/Modal";
import {
  EmptyState,
  Loading,
  TableCard,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "./components/Shared";
import { formatMoney } from "./lib";

function TierForm({
  tier,
  onClose,
  onSaved,
}: {
  tier: FuelAllowanceTier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [min, setMin] = useState(tier ? String(tier.minDistanceKm) : "");
  const [max, setMax] = useState(tier?.maxDistanceKm == null ? "" : String(tier.maxDistanceKm));
  const [unlimited, setUnlimited] = useState(tier ? tier.maxDistanceKm == null : false);
  const [amount, setAmount] = useState(tier ? String(tier.amount) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const minValue = Number(min);
    const maxValue = unlimited ? null : Number(max);
    const amountValue = Number(amount);
    if (!min.trim() || minValue < 0 || !Number.isFinite(minValue)) {
      setError("Khoảng cách tối thiểu không hợp lệ"); return;
    }
    if (!unlimited && (!max.trim() || !Number.isFinite(maxValue) || (maxValue as number) <= minValue)) {
      setError("Khoảng cách tối đa phải lớn hơn khoảng cách tối thiểu"); return;
    }
    if (!amount.trim() || amountValue < 0 || !Number.isFinite(amountValue)) {
      setError("Số tiền phụ cấp không hợp lệ"); return;
    }

    setSaving(true); setError("");
    try {
      const payload = { minDistanceKm: minValue, maxDistanceKm: maxValue, amount: amountValue };
      if (tier) await fuelAllowanceTierApi.update(tier.id, payload);
      else await fuelAllowanceTierApi.create(payload);
      toast.success(tier ? "Đã cập nhật bậc phụ cấp" : "Đã thêm bậc phụ cấp");
      onSaved();
    } catch (err) {
      // Giữ nguyên message 400/409 từ backend để Nhân sự biết chính xác khoảng bị lỗi.
      setError(getApiErrorMessage(err, "Lưu bậc phụ cấp thất bại"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={tier ? "Sửa bậc phụ cấp xăng" : "Thêm bậc phụ cấp xăng"} submitLabel="Lưu" loading={saving} onClose={onClose} onSubmit={submit}>
      <Field label="Khoảng cách tối thiểu (km)" required>
        <input type="number" min="0" step="0.01" value={min} onChange={(e) => setMin(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Khoảng cách tối đa (km)" required={!unlimited}>
        <input type="number" min="0" step="0.01" value={max} onChange={(e) => setMax(e.target.value)} disabled={unlimited} className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} /> Không giới hạn
      </label>
      <Field label="Phụ cấp (đồng)" required>
        <input type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
      </Field>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

export default function FuelAllowanceTierPage() {
  const [tiers, setTiers] = useState<FuelAllowanceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState<FuelAllowanceTier | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<FuelAllowanceTier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fuelAllowanceTierApi.list();
      setTiers([...data].sort((a, b) => a.minDistanceKm - b.minDistanceKm));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được bậc phụ cấp xăng"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError("");
    try {
      await fuelAllowanceTierApi.remove(deleteTarget.id);
      toast.success("Đã xoá bậc phụ cấp"); setDeleteTarget(null); load();
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, "Xoá bậc phụ cấp thất bại"));
    } finally { setDeleting(false); }
  };

  return (
    <TeachingLayout title="Phụ cấp xăng">
      <TeachingTabs />
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <p className="text-xs leading-relaxed text-gray-500">Phụ cấp được tra theo khoảng cách và chốt khi tạo buổi dạy. Các bậc có thể liền kề nhưng không được chồng nhau.</p>
        <button onClick={() => setFormTarget(null)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white active:scale-95"><Plus size={16} /> Thêm bậc</button>
      </div>
      {loading ? <Loading /> : tiers.length === 0 ? (
        <EmptyState icon="⛽" title="Chưa có bậc phụ cấp xăng" description="Thêm các khoảng cách để hệ thống tự chốt phụ cấp cho buổi dạy mới." />
      ) : (
        <TableCard minWidth={680}>
          <thead className={theadClass}><tr><th className={thClass}>Từ khoảng cách</th><th className={thClass}>Đến dưới</th><th className={`${thClass} text-right`}>Mức phụ cấp</th><th className={`${thClass} text-right`}>Thao tác</th></tr></thead>
          <tbody>{tiers.map((tier) => <tr key={tier.id} className={trClass}>
            <td className={`${tdClass} font-medium text-gray-800`}>{tier.minDistanceKm.toLocaleString("vi-VN")} km</td>
            <td className={tdClass}>{tier.maxDistanceKm == null ? "Không giới hạn" : `${tier.maxDistanceKm.toLocaleString("vi-VN")} km`}</td>
            <td className={`${tdClass} text-right font-semibold text-emerald-700`}>{formatMoney(tier.amount)}</td>
            <td className={`${tdClass} text-right`}><div className="flex justify-end gap-2"><button onClick={() => setFormTarget(tier)} title="Sửa" className="rounded-lg border border-gray-200 p-2 text-gray-600"><Pencil size={14} /></button><button onClick={() => { setDeleteError(""); setDeleteTarget(tier); }} title="Xoá" className="rounded-lg border border-red-100 p-2 text-red-500"><Trash2 size={14} /></button></div></td>
          </tr>)}</tbody>
        </TableCard>
      )}
      {formTarget !== undefined && <TierForm tier={formTarget} onClose={() => setFormTarget(undefined)} onSaved={() => { setFormTarget(undefined); load(); }} />}
      {deleteTarget && <ConfirmModal title="Xoá bậc phụ cấp" message={deleteError ? <span className="text-red-600">{deleteError}</span> : <>Xoá bậc từ <b>{deleteTarget.minDistanceKm} km</b> đến <b>{deleteTarget.maxDistanceKm == null ? "không giới hạn" : `${deleteTarget.maxDistanceKm} km`}</b>?</>} submitLabel={deleteError ? "Đóng" : "Xoá"} submitColor={deleteError ? "bg-gray-400" : "bg-red-500"} loading={deleting} onClose={() => setDeleteTarget(null)} onSubmit={deleteError ? () => setDeleteTarget(null) : remove} />}
    </TeachingLayout>
  );
}
