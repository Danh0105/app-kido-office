import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import SearchableSelect from "@/components/SearchableSelect";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass } from "@/pages/Teaching/components/Shared";
import { hrOrgApi, type HrOrgUnit, type HrOrgUnitDetail } from "@/service/hr/hr.api";
import HrEmployeePicker from "../components/HrEmployeePicker";
import { HrAlert, HrFormError } from "../components/HrUi";
import { formatVnDate, isValidReason, MIN_REASON_LENGTH, vnToday } from "../lib/hrAccess";
import {
  ALLOWED_PARENT_TYPES,
  ORG_LEADER_ROLE_LABELS,
  ORG_UNIT_TYPE_LABELS,
  leaderRolesFor,
  parentCandidates,
  type OrgLeaderRole,
  type OrgUnitStatus,
  type OrgUnitType,
} from "../lib/hrOrg";

const TYPES = Object.keys(ORG_UNIT_TYPE_LABELS) as OrgUnitType[];

function ReasonInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Lý do" required hint={`Tối thiểu ${MIN_REASON_LENGTH} ký tự — ghi vào nhật ký HR.`}>
      <textarea className={inputClass} rows={2} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function useSubmit(onDone: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async <T,>(fn: () => Promise<T>, success: string | ((result: T) => string)) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      toast.success(typeof success === "function" ? success(result) : success);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, run };
}

/** Tạo đơn vị mới. Ngày hiệu lực được lùi khi thiết lập cơ cấu ban đầu. */
export function CreateUnitDialog({
  units,
  defaultParentId,
  onClose,
  onDone,
}: {
  units: HrOrgUnit[];
  defaultParentId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const hasCompany = units.some((u) => u.unitType === "COMPANY" && u.status === "ACTIVE");
  const defaultParent = units.find((u) => u.id === defaultParentId);
  const firstType: OrgUnitType = !hasCompany
    ? "COMPANY"
    : defaultParent
      ? (TYPES.find((t) => ALLOWED_PARENT_TYPES[t].includes(defaultParent.unitType)) ?? "DEPARTMENT")
      : "DEPARTMENT";
  const [unitType, setUnitType] = useState<OrgUnitType>(firstType);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(defaultParentId ? String(defaultParentId) : "");
  const [effectiveFrom, setEffectiveFrom] = useState(vnToday());
  const [reason, setReason] = useState("");
  const { loading, error, run } = useSubmit(onDone);
  const candidates = parentCandidates(units, unitType);
  const needsParent = unitType !== "COMPANY";
  const problems = [
    !name.trim() && "Nhập tên đơn vị.",
    needsParent && !parentId && "Chọn đơn vị cha.",
    !isValidReason(reason) && "Nhập lý do.",
  ].filter(Boolean) as string[];

  return (
    <Modal
      title="Thêm đơn vị"
      submitLabel="Tạo đơn vị"
      loading={loading}
      disabled={problems.length > 0}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            hrOrgApi.create({
              name: name.trim(),
              unitType,
              parentId: needsParent ? Number(parentId) : undefined,
              effectiveFrom,
              reason: reason.trim(),
            }),
          (created) => `Đã tạo đơn vị ${created.code}.`,
        )
      }
      wide
    >
      <p className="text-xs text-gray-500">Mã đơn vị do hệ thống tự sinh (DV + 4 số) sau khi tạo, không đổi được.</p>
      <Field label="Loại đơn vị" required>
          <select className={`${selectClass} w-full`} value={unitType} onChange={(e) => { setUnitType(e.target.value as OrgUnitType); setParentId(""); }}>
            {TYPES.filter((t) => t !== "COMPANY" || !hasCompany).map((t) => (
              <option key={t} value={t}>{ORG_UNIT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
      <Field label="Tên đơn vị" required>
        <input className={inputClass} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </Field>
      {needsParent && (
        <Field label="Đơn vị cha" required>
          <SearchableSelect
            value={parentId}
            onChange={setParentId}
            options={candidates.map((u) => ({ id: u.id, name: `${u.name} (${ORG_UNIT_TYPE_LABELS[u.unitType]})` }))}
            className={`${selectClass} w-full text-left`}
            placeholder={candidates.length ? "— Chọn đơn vị cha —" : "Không có đơn vị cha hợp lệ"}
          />
        </Field>
      )}
      <Field label="Hiệu lực từ" required hint="Có thể chọn ngày trong quá khứ khi thiết lập cơ cấu ban đầu.">
        <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
      </Field>
      <ReasonInput value={reason} onChange={setReason} />
      <HrFormError error={error} />
    </Modal>
  );
}

/** Thay đổi đơn vị = revision mới có hiệu lực từ một ngày (hôm nay trở đi). Không sửa đè lịch sử. */
export function ReviseUnitDialog({
  detail,
  units,
  onClose,
  onDone,
}: {
  detail: HrOrgUnitDetail;
  units: HrOrgUnit[];
  onClose: () => void;
  onDone: () => void;
}) {
  const last = detail.revisions[detail.revisions.length - 1];
  const today = vnToday();
  const minFrom = last && last.effectiveFrom >= today ? last.effectiveFrom : today;
  const [effectiveFrom, setEffectiveFrom] = useState(minFrom > today ? "" : today);
  const [name, setName] = useState(last?.name ?? "");
  const [unitType, setUnitType] = useState<OrgUnitType>((last?.unitType ?? "DEPARTMENT") as OrgUnitType);
  const [parentId, setParentId] = useState(last?.parentId ? String(last.parentId) : "");
  const [status, setStatus] = useState<OrgUnitStatus>((last?.status ?? "ACTIVE") as OrgUnitStatus);
  const [reason, setReason] = useState("");
  const { loading, error, run } = useSubmit(onDone);
  const candidates = parentCandidates(units, unitType, detail.id);
  const changed =
    name.trim() !== last?.name || unitType !== last?.unitType || (parentId ? Number(parentId) : null) !== last?.parentId || status !== last?.status;
  const problems = [
    (!effectiveFrom || effectiveFrom <= (last?.effectiveFrom ?? "") || effectiveFrom < today) &&
      `Ngày hiệu lực phải từ hôm nay và sau ${formatVnDate(last?.effectiveFrom)}.`,
    !changed && "Chưa có thay đổi nào.",
    unitType !== "COMPANY" && !parentId && "Chọn đơn vị cha.",
    !isValidReason(reason) && "Nhập lý do.",
  ].filter(Boolean) as string[];

  return (
    <Modal
      title={`Thay đổi đơn vị — ${detail.code}`}
      submitLabel="Tạo revision"
      loading={loading}
      disabled={problems.length > 0}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            hrOrgApi.revise(detail.id, {
              version: detail.version,
              effectiveFrom,
              name: name.trim() !== last?.name ? name.trim() : undefined,
              unitType: unitType !== last?.unitType ? unitType : undefined,
              parentId: (parentId ? Number(parentId) : null) !== last?.parentId ? (parentId ? Number(parentId) : null) : undefined,
              status: status !== last?.status ? status : undefined,
              reason: reason.trim(),
            }),
          "Đã tạo revision mới.",
        )
      }
      wide
    >
      <HrAlert tone="info">
        Thay đổi có hiệu lực từ ngày đã chọn. Lịch sử trước ngày đó giữ nguyên; revision hiện tại sẽ kết thúc vào ngày liền trước.
      </HrAlert>
      <Field label="Hiệu lực từ" required>
        <input type="date" className={inputClass} min={today} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên đơn vị">
          <input className={inputClass} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Loại đơn vị">
          <select className={`${selectClass} w-full`} value={unitType} onChange={(e) => setUnitType(e.target.value as OrgUnitType)}>
            {TYPES.map((t) => <option key={t} value={t}>{ORG_UNIT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
      </div>
      {unitType !== "COMPANY" && (
        <Field label="Đơn vị cha">
          <SearchableSelect
            value={parentId}
            onChange={setParentId}
            options={candidates.map((u) => ({ id: u.id, name: `${u.name} (${ORG_UNIT_TYPE_LABELS[u.unitType]})` }))}
            className={`${selectClass} w-full text-left`}
            placeholder="— Chọn đơn vị cha —"
          />
        </Field>
      )}
      <Field label="Trạng thái">
        <select className={`${selectClass} w-full`} value={status} onChange={(e) => setStatus(e.target.value as OrgUnitStatus)}>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Đóng đơn vị (ngừng hoạt động)</option>
        </select>
      </Field>
      <ReasonInput value={reason} onChange={setReason} />
      {problems.length > 0 && reason && (
        <ul className="text-xs text-amber-700 list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <HrFormError error={error} />
    </Modal>
  );
}

export function AssignLeaderDialog({
  unit,
  onClose,
  onDone,
}: {
  unit: { id: number; name: string; unitType: OrgUnitType };
  onClose: () => void;
  onDone: () => void;
}) {
  const roles = leaderRolesFor(unit.unitType);
  const today = vnToday();
  const positions = useQuery({ queryKey: ["hr", "positions"], queryFn: hrOrgApi.positions, retry: false });
  const [employee, setEmployee] = useState<{ id: number; fullName: string; employeeCode: string } | null>(null);
  const [leaderRole, setLeaderRole] = useState<OrgLeaderRole>(roles.find((r) => r !== "DEPUTY") ?? roles[0]);
  const [isApprovalAuthority, setIsApprovalAuthority] = useState(true);
  const [positionId, setPositionId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");
  const { loading, error, run } = useSubmit(onDone);
  const authority = leaderRole !== "DEPUTY" && isApprovalAuthority;
  const problems = [
    !employee && "Chọn nhân viên.",
    effectiveFrom < today && "Ngày bắt đầu từ hôm nay trở đi.",
    effectiveTo && effectiveTo < effectiveFrom && "Ngày kết thúc phải sau ngày bắt đầu.",
    !isValidReason(reason) && "Nhập lý do.",
  ].filter(Boolean) as string[];

  return (
    <Modal
      title={`Đặt lãnh đạo — ${unit.name}`}
      submitLabel="Lưu"
      loading={loading}
      disabled={problems.length > 0}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            hrOrgApi.assignLeader(unit.id, {
              employeeId: employee!.id,
              leaderRole,
              positionId: positionId ? Number(positionId) : undefined,
              isApprovalAuthority: authority,
              effectiveFrom,
              effectiveTo: effectiveTo || undefined,
              reason: reason.trim(),
            }),
          "Đã đặt lãnh đạo đơn vị.",
        )
      }
      wide
    >
      <Field label="Nhân viên" required hint="Chọn trong hồ sơ nhân sự HR (không phải tài khoản đăng nhập).">
        <HrEmployeePicker value={employee} onChange={setEmployee} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vai trò" required>
          <select className={`${selectClass} w-full`} value={leaderRole} onChange={(e) => setLeaderRole(e.target.value as OrgLeaderRole)}>
            {roles.map((r) => <option key={r} value={r}>{ORG_LEADER_ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <Field label="Chức danh">
          <select className={`${selectClass} w-full`} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
            <option value="">— Không chọn —</option>
            {(positions.data ?? []).filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={authority} disabled={leaderRole === "DEPUTY"} onChange={(e) => setIsApprovalAuthority(e.target.checked)} />
        <span>
          Người duyệt chính của đơn vị cho vai trò này
          <span className="block text-xs text-gray-500">Mỗi đơn vị chỉ có một người duyệt chính cho mỗi vai trò tại một thời điểm. Phó không làm người duyệt chính.</span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Từ ngày" required>
          <input type="date" className={inputClass} min={today} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày" hint="Bỏ trống = chưa xác định.">
          <input type="date" className={inputClass} min={effectiveFrom} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
        </Field>
      </div>
      <ReasonInput value={reason} onChange={setReason} />
      <HrFormError error={error} />
    </Modal>
  );
}

export function EndLeaderDialog({
  leader,
  onClose,
  onDone,
}: {
  leader: { id: number; employeeName: string; leaderRole: string; effectiveFrom: string; version: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const today = vnToday();
  const min = leader.effectiveFrom > today ? leader.effectiveFrom : today;
  const [effectiveTo, setEffectiveTo] = useState(min);
  const [reason, setReason] = useState("");
  const { loading, error, run } = useSubmit(onDone);
  return (
    <Modal
      title="Kết thúc vai trò lãnh đạo"
      submitLabel="Kết thúc"
      submitColor="bg-red-500"
      loading={loading}
      disabled={!isValidReason(reason) || effectiveTo < min}
      onClose={onClose}
      onSubmit={() => run(() => hrOrgApi.endLeader(leader.id, { version: leader.version, effectiveTo, reason: reason.trim() }), "Đã kết thúc vai trò.")}
    >
      <p className="text-sm text-gray-700">
        {leader.employeeName} — {ORG_LEADER_ROLE_LABELS[leader.leaderRole as OrgLeaderRole] ?? leader.leaderRole}. Lịch sử được giữ lại, không xoá.
      </p>
      <Field label="Ngày cuối còn giữ vai trò" required>
        <input type="date" className={inputClass} min={min} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
      </Field>
      <ReasonInput value={reason} onChange={setReason} />
      <HrFormError error={error} />
    </Modal>
  );
}
