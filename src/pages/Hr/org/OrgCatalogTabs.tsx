import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus } from "lucide-react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass, tdClass, thClass, theadClass, trClass } from "@/pages/Teaching/components/Shared";
import { hrOrgApi, type HrOrgUnit, type HrPosition } from "@/service/hr/hr.api";
import { HrCard, HrEmpty, HrErrorState, HrFormError, HrLoading, StatusBadge, buttonDanger, buttonPrimary, buttonSecondary } from "../components/HrUi";
import ReasonDialog from "../components/ReasonDialog";
import { ORG_UNIT_TYPE_LABELS } from "../lib/hrOrg";

export function PositionsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const positions = useQuery({ queryKey: ["hr", "positions"], queryFn: hrOrgApi.positions, retry: false });
  const [editing, setEditing] = useState<HrPosition | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<HrPosition | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hr", "positions"] });

  return (
    <HrCard
      title="Chức danh"
      action={canManage && <button className={buttonPrimary} onClick={() => setEditing("new")}><Plus size={16} /> Thêm</button>}
    >
      {positions.isLoading ? <HrLoading /> : positions.isError ? <HrErrorState error={positions.error} onRetry={() => positions.refetch()} /> :
        !positions.data?.length ? <HrEmpty title="Chưa có chức danh" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}><tr><th className={thClass}>Mã</th><th className={thClass}>Tên</th><th className={thClass}>Cấp</th><th className={thClass}>Trạng thái</th><th className={thClass}></th></tr></thead>
              <tbody>
                {positions.data.map((p) => (
                  <tr key={p.id} className={trClass}>
                    <td className={`${tdClass} font-mono`}>{p.code}</td>
                    <td className={tdClass}>{p.name}</td>
                    <td className={tdClass}>{p.level ?? "—"}</td>
                    <td className={tdClass}><StatusBadge value={p.isActive ? "ACTIVE" : "INACTIVE"} label={p.isActive ? "Đang dùng" : "Ngừng dùng"} /></td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {canManage && p.isActive && (
                        <div className="flex gap-2">
                          <button className={buttonSecondary} onClick={() => setEditing(p)}>Sửa</button>
                          <button className={buttonDanger} onClick={() => setDeactivating(p)}>Ngừng dùng</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {editing && <PositionDialog position={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} />}
      {deactivating && (
        <ReasonDialog
          title={`Ngừng dùng chức danh — ${deactivating.name}`}
          submitLabel="Ngừng dùng"
          submitColor="bg-red-500"
          loading={loading}
          error={error}
          onClose={() => { setDeactivating(null); setError(null); }}
          onSubmit={async (reason) => {
            setLoading(true); setError(null);
            try {
              await hrOrgApi.deactivatePosition(deactivating.id, { version: deactivating.version, reason });
              toast.success("Đã ngừng dùng chức danh.");
              setDeactivating(null); refresh();
            } catch (err) { setError(err); } finally { setLoading(false); }
          }}
        />
      )}
    </HrCard>
  );
}

function PositionDialog({ position, onClose, onDone }: { position: HrPosition | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(position?.name ?? "");
  const [level, setLevel] = useState(position?.level === null || position?.level === undefined ? "" : String(position.level));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = name.trim().length > 0;
  const submit = async () => {
    setLoading(true); setError(null);
    try {
      if (position) {
        await hrOrgApi.updatePosition(position.id, { version: position.version, name: name.trim(), level: level === "" ? null : Number(level) });
        toast.success("Đã lưu chức danh.");
      } else {
        const created = await hrOrgApi.createPosition({ name: name.trim(), level: level === "" ? undefined : Number(level) });
        toast.success(`Đã tạo chức danh ${created.code}.`);
      }
      onDone();
    } catch (err) { setError(err); } finally { setLoading(false); }
  };
  return (
    <Modal title={position ? "Sửa chức danh" : "Thêm chức danh"} submitLabel="Lưu" loading={loading} disabled={!valid} onClose={onClose} onSubmit={submit}>
      {position ? (
        <Field label="Mã" hint="Mã do hệ thống sinh, không đổi được.">
          <p className="font-mono text-sm text-gray-700">{position.code}</p>
        </Field>
      ) : (
        <p className="text-xs text-gray-500">Mã chức danh do hệ thống tự sinh (CD + 4 số) sau khi tạo, không đổi được.</p>
      )}
      <Field label="Tên" required><input className={inputClass} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Cấp bậc"><input className={inputClass} inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value.replace(/\D/g, ""))} /></Field>
      <HrFormError error={error} />
    </Modal>
  );
}

/** Mapping phòng ban / role cũ → đơn vị HR: chỉ để script import (Phase 1.2) đề xuất đơn vị. */
export function MappingsTab({ units, canManage }: { units: HrOrgUnit[]; canManage: boolean }) {
  const queryClient = useQueryClient();
  const mappings = useQuery({ queryKey: ["hr", "legacy-mappings"], queryFn: hrOrgApi.mappings, enabled: canManage, retry: false });
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<{ id: number; version: number; label: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const unitName = (id: number) => units.find((u) => u.id === id)?.name ?? `#${id}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hr", "legacy-mappings"] });
  if (!canManage) return <HrEmpty title="Chỉ quản lý cơ cấu toàn công ty mới cấu hình mapping import" />;

  return (
    <HrCard title="Mapping dữ liệu cũ → đơn vị" action={<button className={buttonPrimary} onClick={() => setCreating(true)}><Plus size={16} /> Thêm</button>}>
      <p className="text-xs text-gray-500">Dùng để script nhập nhân viên đề xuất đơn vị từ phòng ban/role của tài khoản cũ. Kết quả luôn được HR xác nhận trước khi nhập.</p>
      {mappings.isLoading ? <HrLoading /> : mappings.isError ? <HrErrorState error={mappings.error} /> : !mappings.data?.length ? <HrEmpty title="Chưa có mapping" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}><tr><th className={thClass}>Nguồn</th><th className={thClass}>Giá trị</th><th className={thClass}>Đơn vị</th><th className={thClass}>Ưu tiên</th><th className={thClass}>Trạng thái</th><th className={thClass}></th></tr></thead>
            <tbody>
              {mappings.data.map((m) => (
                <tr key={m.id} className={trClass}>
                  <td className={tdClass}>{m.sourceType === "ROLE" ? "Role cũ" : "Phòng ban cũ"}</td>
                  <td className={`${tdClass} font-mono`}>{m.sourceValue}</td>
                  <td className={tdClass}>{unitName(m.orgUnitId)}</td>
                  <td className={tdClass}>{m.priority}</td>
                  <td className={tdClass}><StatusBadge value={m.isActive ? "ACTIVE" : "INACTIVE"} label={m.isActive ? "Đang dùng" : "Ngừng"} /></td>
                  <td className={tdClass}>{m.isActive && <button className={buttonDanger} onClick={() => setTarget({ id: m.id, version: m.version, label: m.sourceValue })}>Ngừng</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <MappingDialog units={units} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {target && (
        <ReasonDialog title={`Ngừng mapping — ${target.label}`} submitLabel="Ngừng" submitColor="bg-red-500" loading={loading} error={error}
          onClose={() => { setTarget(null); setError(null); }}
          onSubmit={async (reason) => {
            setLoading(true); setError(null);
            try { await hrOrgApi.deactivateMapping(target.id, { version: target.version, reason }); toast.success("Đã ngừng mapping."); setTarget(null); refresh(); }
            catch (err) { setError(err); } finally { setLoading(false); }
          }} />
      )}
    </HrCard>
  );
}

function MappingDialog({ units, onClose, onDone }: { units: HrOrgUnit[]; onClose: () => void; onDone: () => void }) {
  const [sourceType, setSourceType] = useState<"ROLE" | "DEPARTMENT">("ROLE");
  const [sourceValue, setSourceValue] = useState("");
  const [orgUnitId, setOrgUnitId] = useState("");
  const [priority, setPriority] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = sourceValue.trim() && orgUnitId;
  return (
    <Modal title="Thêm mapping" submitLabel="Lưu" loading={loading} disabled={!valid} onClose={onClose}
      onSubmit={async () => {
        setLoading(true); setError(null);
        try { await hrOrgApi.createMapping({ sourceType, sourceValue: sourceValue.trim(), orgUnitId: Number(orgUnitId), priority: Number(priority || 100) }); toast.success("Đã thêm mapping."); onDone(); }
        catch (err) { setError(err); } finally { setLoading(false); }
      }}>
      <Field label="Nguồn" required>
        <select className={`${selectClass} w-full`} value={sourceType} onChange={(e) => setSourceType(e.target.value as "ROLE" | "DEPARTMENT")}>
          <option value="ROLE">Role cũ (vd: giaovu, ketoan_truong)</option>
          <option value="DEPARTMENT">Tên phòng ban cũ</option>
        </select>
      </Field>
      <Field label="Giá trị" required><input className={inputClass} value={sourceValue} maxLength={100} onChange={(e) => setSourceValue(e.target.value)} /></Field>
      <Field label="Đơn vị HR" required>
        <select className={`${selectClass} w-full`} value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
          <option value="">— Chọn đơn vị —</option>
          {units.filter((u) => u.status === "ACTIVE").map((u) => <option key={u.id} value={u.id}>{u.name} ({ORG_UNIT_TYPE_LABELS[u.unitType]})</option>)}
        </select>
      </Field>
      <Field label="Ưu tiên" hint="Số nhỏ ưu tiên trước khi nhiều mapping cùng khớp."><input className={inputClass} inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value.replace(/\D/g, ""))} /></Field>
      <HrFormError error={error} />
    </Modal>
  );
}
