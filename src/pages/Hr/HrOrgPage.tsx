import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { inputClass } from "@/pages/Teaching/components/Modal";
import { hrOrgApi, type HrOrgUnit } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import { HrBadge, HrCard, HrEmpty, HrErrorState, HrLoading, StatusBadge, buttonDanger, buttonPrimary, buttonSecondary } from "./components/HrUi";
import { useHrAccess } from "./hooks/useHrAccess";
import { formatVnDate, hrCapabilities, vnToday } from "./lib/hrAccess";
import { APPROVER_KIND_LABELS, ORG_LEADER_ROLE_LABELS, ORG_UNIT_TYPE_LABELS, buildOrgTree, flattenOrgTree, type OrgLeaderRole, type OrgUnitType } from "./lib/hrOrg";
import { AssignLeaderDialog, CreateUnitDialog, EndLeaderDialog, ReviseUnitDialog } from "./org/OrgDialogs";
import { MappingsTab, PositionsTab } from "./org/OrgCatalogTabs";

/**
 * Cơ cấu tổ chức có ngày hiệu lực: xem cây tại bất kỳ ngày nào, lịch sử
 * revision và lãnh đạo của từng đơn vị, xem trước người duyệt resolve được.
 * Nút thao tác hiện theo ORG_MANAGE; phạm vi từng đơn vị do backend kiểm tra.
 */
export default function HrOrgPage() {
  const { access } = useHrAccess();
  const caps = hrCapabilities(access);
  const [tab, setTab] = useState<"tree" | "positions" | "mappings">("tree");
  const [asOf, setAsOf] = useState(vnToday());
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState<{ parentId?: number } | null>(null);
  const queryClient = useQueryClient();
  const units = useQuery({ queryKey: ["hr", "org-units", asOf, includeInactive], queryFn: () => hrOrgApi.units(asOf, includeInactive), retry: false });
  const allUnits = useQuery({ queryKey: ["hr", "org-units", vnToday(), true], queryFn: () => hrOrgApi.units(vnToday(), true), retry: false });
  const rows = useMemo(() => flattenOrgTree(buildOrgTree(units.data?.units ?? []), collapsed), [units.data, collapsed]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hr", "org-units"] });
  const toggle = (id: number) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <HrLayout title="HRM — Tổ chức" require={(has) => has("EMPLOYEE_VIEW") || has("ORG_MANAGE")}>
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 w-full md:w-fit overflow-x-auto">
        {([["tree", "Cơ cấu"], ["positions", "Chức danh"], ["mappings", "Mapping import"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg ${tab === k ? "bg-blue-500 text-white" : "text-gray-500"}`}>{label}</button>
        ))}
      </div>

      {tab === "positions" && <PositionsTab canManage={caps.canManageOrgCatalog} />}
      {tab === "mappings" && <MappingsTab units={allUnits.data?.units ?? []} canManage={caps.canManageOrgCatalog} />}

      {tab === "tree" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <HrCard
            title="Cơ cấu"
            action={caps.canManageOrg && <button className={buttonPrimary} onClick={() => setCreating({})}><Plus size={16} /> Thêm</button>}
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-gray-500">Xem tại ngày</label>
              <input type="date" className={`${inputClass} w-auto`} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
              {asOf !== vnToday() && <button className="text-xs text-blue-600" onClick={() => setAsOf(vnToday())}>Hôm nay</button>}
              <label className="ml-auto flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Gồm đơn vị đã đóng
              </label>
            </div>
            {units.isLoading ? <HrLoading /> : units.isError ? <HrErrorState error={units.error} onRetry={() => units.refetch()} /> : !rows.length ? (
              <HrEmpty title={`Chưa có đơn vị nào tại ngày ${formatVnDate(asOf)}`} description={caps.canManageOrg ? "Bắt đầu bằng việc tạo đơn vị Công ty." : undefined} />
            ) : (
              <ul className="divide-y divide-gray-50">
                {rows.map(({ unit, depth, children }) => (
                  <li key={unit.id}>
                    <div className={`flex items-center gap-1 rounded-lg py-2 pr-2 ${selected === unit.id ? "bg-blue-50" : "hover:bg-gray-50"}`} style={{ paddingLeft: 4 + depth * 16 }}>
                      <button className="h-6 w-6 shrink-0 text-gray-400" onClick={() => children.length && toggle(unit.id)} aria-label="Mở/đóng nhánh">
                        {children.length ? (collapsed.has(unit.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />) : null}
                      </button>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(unit.id)}>
                        <span className="block truncate text-sm font-medium text-gray-800">{unit.name}</span>
                        <span className="block text-[11px] text-gray-400">
                          {ORG_UNIT_TYPE_LABELS[unit.unitType as OrgUnitType]} · {unit.code}
                          {(unit as HrOrgUnit).leaders?.filter((l) => l.isApprovalAuthority).map((l) => ` · ${l.employeeName}`).join("")}
                        </span>
                      </button>
                      {unit.status !== "ACTIVE" && <StatusBadge value="INACTIVE" label="Đã đóng" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </HrCard>

          {selected !== null ? (
            <UnitDetail
              key={`${selected}-${asOf}`}
              id={selected}
              asOf={asOf}
              canManage={caps.canManageOrg}
              allUnits={allUnits.data?.units ?? []}
              onAddChild={() => setCreating({ parentId: selected })}
              onChanged={refresh}
            />
          ) : (
            <HrEmpty title="Chọn một đơn vị để xem chi tiết" />
          )}
        </div>
      )}

      {creating && (
        <CreateUnitDialog
          units={allUnits.data?.units ?? []}
          defaultParentId={creating.parentId}
          onClose={() => setCreating(null)}
          onDone={() => { setCreating(null); refresh(); }}
        />
      )}
    </HrLayout>
  );
}

function UnitDetail({ id, asOf, canManage, allUnits, onAddChild, onChanged }: {
  id: number; asOf: string; canManage: boolean; allUnits: HrOrgUnit[]; onAddChild: () => void; onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["hr", "org-unit", id, asOf], queryFn: () => hrOrgApi.unit(id, asOf), retry: false });
  const approvers = useQuery({ queryKey: ["hr", "org-approvers", id, asOf], queryFn: () => hrOrgApi.approvers(id, asOf), retry: false });
  const [revising, setRevising] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState<null | { id: number; employeeName: string; leaderRole: string; effectiveFrom: string; version: number }>(null);
  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "org-unit", id] });
    queryClient.invalidateQueries({ queryKey: ["hr", "org-approvers", id] });
    onChanged();
  };
  if (detail.isLoading) return <HrCard><HrLoading /></HrCard>;
  if (detail.isError || !detail.data) return <HrErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const d = detail.data;
  const cur = d.current;
  const parentName = (pid: number | null) => (pid === null ? "—" : allUnits.find((u) => u.id === pid)?.name ?? `#${pid}`);
  const today = vnToday();

  return (
    <div className="space-y-3">
      <HrCard
        title={<span className="flex flex-wrap items-center gap-2">{cur?.name ?? d.code}{cur && <HrBadge tone="info">{ORG_UNIT_TYPE_LABELS[cur.unitType as OrgUnitType]}</HrBadge>}</span>}
        action={canManage && (
          <div className="flex flex-wrap gap-2">
            {cur?.status === "ACTIVE" && cur.unitType !== "TEAM" && <button className={buttonSecondary} onClick={onAddChild}>Thêm đơn vị con</button>}
            <button className={buttonSecondary} onClick={() => setRevising(true)}>Thay đổi</button>
          </div>
        )}
      >
        {!cur ? <p className="text-sm text-gray-500">Đơn vị chưa tồn tại hoặc đã kết thúc tại ngày {formatVnDate(asOf)}.</p> : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500">Mã</dt><dd className="font-mono">{d.code}</dd></div>
            <div><dt className="text-xs text-gray-500">Trạng thái</dt><dd><StatusBadge value={cur.status} label={cur.status === "ACTIVE" ? "Hoạt động" : "Đã đóng"} /></dd></div>
            <div><dt className="text-xs text-gray-500">Đơn vị cha</dt><dd>{parentName(cur.parentId)}</dd></div>
            <div><dt className="text-xs text-gray-500">Hiệu lực của thông tin này</dt><dd>{formatVnDate(cur.effectiveFrom)} → {cur.effectiveTo ? formatVnDate(cur.effectiveTo) : "nay"}</dd></div>
          </dl>
        )}
      </HrCard>

      <HrCard title="Người duyệt resolve được" action={<span className="text-[11px] text-gray-400">tại {formatVnDate(asOf)}</span>}>
        {approvers.isLoading ? <HrLoading /> : approvers.isError ? <HrErrorState error={approvers.error} /> : (
          <ul className="space-y-1 text-sm">
            {approvers.data!.approvers.map((a) => (
              <li key={a.kind} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-gray-600">{APPROVER_KIND_LABELS[a.kind] ?? a.kind}</span>
                {a.status === "RESOLVED" ? <span className="font-medium">{a.approver?.employeeName}</span> : <span className="text-xs text-amber-700">{a.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </HrCard>

      <HrCard title="Lãnh đạo đơn vị" action={canManage && cur?.status === "ACTIVE" && <button className={buttonSecondary} onClick={() => setAssigning(true)}><Plus size={14} /> Đặt lãnh đạo</button>}>
        {!d.leaders.length ? <HrEmpty title="Chưa có lãnh đạo" /> : (
          <ul className="space-y-2">
            {d.leaders.map((l) => {
              const active = l.effectiveFrom <= today && (l.effectiveTo === null || l.effectiveTo >= today);
              return (
                <li key={l.id} className="rounded-xl border border-gray-100 p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{l.employeeName} <span className="text-xs text-gray-400">({l.employeeCode})</span></span>
                    <span className="flex gap-1">
                      <HrBadge tone="info">{ORG_LEADER_ROLE_LABELS[l.leaderRole as OrgLeaderRole] ?? l.leaderRole}</HrBadge>
                      {l.isApprovalAuthority && <HrBadge tone="success">Duyệt chính</HrBadge>}
                      {!active && <HrBadge tone="neutral">{l.effectiveFrom > today ? "Sắp hiệu lực" : "Đã kết thúc"}</HrBadge>}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{l.positionName ? `${l.positionName} · ` : ""}{formatVnDate(l.effectiveFrom)} → {l.effectiveTo ? formatVnDate(l.effectiveTo) : "chưa xác định"}</p>
                  {canManage && l.effectiveTo === null && (
                    <button className={buttonDanger} onClick={() => setEnding({ id: l.id, employeeName: l.employeeName, leaderRole: l.leaderRole, effectiveFrom: l.effectiveFrom, version: l.version })}>Kết thúc vai trò</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </HrCard>

      <HrCard title="Lịch sử thay đổi">
        <ol className="space-y-2 text-sm">
          {[...d.revisions].reverse().map((r) => (
            <li key={r.id} className="border-l-2 border-blue-200 pl-3">
              <p className="font-medium">{formatVnDate(r.effectiveFrom)} → {r.effectiveTo ? formatVnDate(r.effectiveTo) : "nay"}</p>
              <p className="text-xs text-gray-600">{r.name} · {ORG_UNIT_TYPE_LABELS[r.unitType as OrgUnitType]} · cha: {parentName(r.parentId)} · {r.status === "ACTIVE" ? "hoạt động" : "đã đóng"}</p>
              <p className="text-xs text-gray-400">Lý do: {r.reason}</p>
            </li>
          ))}
        </ol>
      </HrCard>

      {revising && <ReviseUnitDialog detail={d} units={allUnits} onClose={() => setRevising(false)} onDone={() => { setRevising(false); reload(); }} />}
      {assigning && cur && <AssignLeaderDialog unit={{ id: d.id, name: cur.name, unitType: cur.unitType as OrgUnitType }} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); reload(); }} />}
      {ending && <EndLeaderDialog leader={ending} onClose={() => setEnding(null)} onDone={() => { setEnding(null); reload(); }} />}
    </div>
  );
}
