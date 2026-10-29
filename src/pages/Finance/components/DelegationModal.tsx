import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import SearchableSelect from "@/components/SearchableSelect";
import { financeApi } from "@/service/finance";
import type { FinanceRequestType } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { useFinanceMeta } from "../FinanceRoutes";
import {
  TYPE_LABELS,
  formatDateTime,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "../lib";
import { Badge, Modal } from "./FinanceUi";

const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Uỷ quyền duyệt có thời hạn: người được uỷ quyền duyệt thay trong phạm vi đã chọn. */
export default function DelegationModal({ onClose }: { onClose: () => void }) {
  const meta = useFinanceMeta();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["finance-delegations"], queryFn: financeApi.myDelegations });
  const [delegateId, setDelegateId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [requestType, setRequestType] = useState("");
  const [startsAt, setStartsAt] = useState(localInput(new Date()));
  const [endsAt, setEndsAt] = useState(localInput(new Date(Date.now() + 7 * 86_400_000)));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!delegateId) {
      toast.error("Chọn người được uỷ quyền");
      return;
    }
    setSaving(true);
    try {
      await financeApi.createDelegation({
        delegateId: Number(delegateId),
        companyId: companyId ? Number(companyId) : null,
        requestType: requestType || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason || null,
      });
      toast.success("Đã tạo uỷ quyền");
      setDelegateId("");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["finance-delegations"] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tạo được uỷ quyền."));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: number) => {
    try {
      await financeApi.revokeDelegation(id);
      toast.success("Đã thu hồi uỷ quyền");
      await queryClient.invalidateQueries({ queryKey: ["finance-delegations"] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thu hồi được."));
    }
  };

  const now = Date.now();
  return (
    <Modal open title="Uỷ quyền duyệt" onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={`${labelClass} md:col-span-2`}>
          Người được uỷ quyền
          <SearchableSelect
            value={delegateId}
            onChange={setDelegateId}
            options={(query.data?.employees ?? []).map((e) => ({ id: e.id, name: e.name }))}
            placeholder="Chọn nhân viên"
            searchPlaceholder="Tìm tên…"
            className="mt-1"
          />
        </label>
        <label className={labelClass}>
          Phạm vi công ty
          <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Mọi công ty</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Loại chứng từ
          <select className={inputClass} value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="">Mọi loại</option>
            {(Object.keys(TYPE_LABELS) as FinanceRequestType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Từ
          <input type="datetime-local" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className={labelClass}>
          Đến
          <input type="datetime-local" className={inputClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Lý do
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nghỉ phép, công tác…" />
        </label>
        <div className="flex justify-end md:col-span-2">
          <button type="button" className={primaryButton} disabled={saving} onClick={() => void create()}>
            {saving ? "Đang lưu…" : "Tạo uỷ quyền"}
          </button>
        </div>
      </div>

      <h4 className="mb-2 mt-5 text-sm font-bold text-slate-800">Uỷ quyền liên quan đến tôi</h4>
      <div className="space-y-2">
        {(query.data?.delegations ?? []).length === 0 && <p className="text-sm text-slate-400">Chưa có uỷ quyền nào.</p>}
        {(query.data?.delegations ?? []).map((d) => {
          const active = !d.revokedAt && new Date(d.startsAt).getTime() <= now && new Date(d.endsAt).getTime() > now;
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-800">
                  {d.delegatorName} → {d.delegateName}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(d.startsAt)} – {formatDateTime(d.endsAt)}
                  {d.requestType ? ` · ${TYPE_LABELS[d.requestType]}` : ""}
                  {d.reason ? ` · ${d.reason}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={d.revokedAt ? "slate" : active ? "emerald" : "amber"}>
                  {d.revokedAt ? "Đã thu hồi" : active ? "Đang hiệu lực" : "Chưa/hết hiệu lực"}
                </Badge>
                {d.canRevoke && (
                  <button type="button" className={secondaryButton} onClick={() => void revoke(d.id)}>
                    Thu hồi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
