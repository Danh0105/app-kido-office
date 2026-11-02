import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus, ShieldAlert } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass, tdClass, thClass, theadClass, trClass } from "@/pages/Teaching/components/Shared";
import { hrAccessApi, hrOrgApi, type HrAssignment, type HrPermissionGrant, type HrRole } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import {
  HrAlert,
  HrBadge,
  HrCard,
  HrEmpty,
  HrErrorState,
  HrFormError,
  HrLoading,
  StatusBadge,
  buttonDanger,
  buttonPrimary,
} from "./components/HrUi";
import ReasonDialog from "./components/ReasonDialog";
import { useAccountNames, useAccounts } from "./hooks/useAccountNames";
import { useHrAccess } from "./hooks/useHrAccess";
import {
  DIRECT_GRANT_PERMISSIONS,
  HR_SCOPES,
  HR_SCOPE_LABELS,
  MAX_SENSITIVE_ACCESS_DAYS,
  assignmentStatus,
  formatVnDate,
  hrCapabilities,
  isSensitiveRole,
  latestSensitiveEffectiveTo,
  permissionLabel,
  vnToday,
  type HrScope,
} from "./lib/hrAccess";
import { describeHrError } from "./lib/hrErrors";
import { ORG_UNIT_TYPE_LABELS } from "./lib/hrOrg";
import {
  SCOPE_UNIT_TYPES,
  isValidScopeOption,
  scopeNeedsUnit,
  scopeOptionItems,
  scopeRefIdFor,
  scopeUnitLabel,
} from "./lib/hrScopeUnits";

const STATUS_LABEL = { ACTIVE: "Đang hiệu lực", UPCOMING: "Sắp hiệu lực", EXPIRED: "Hết hạn", REVOKED: "Đã thu hồi" };

/** Quyền của từng role — 1 request / role (backend chưa có API gộp). */
function useRolePermissions(roles: HrRole[] | undefined) {
  const results = useQueries({
    queries: (roles ?? []).map((r) => ({
      queryKey: ["hr", "role-permissions", r.code],
      queryFn: () => hrAccessApi.rolePermissions(r.code),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  return useMemo(() => {
    const map = new Map<string, string[]>();
    results.forEach((q, i) => {
      if (roles && q.data) map.set(roles[i].code, q.data.permissions);
    });
    return map;
  }, [results, roles]);
}

export default function HrAccessPage() {
  const [tab, setTab] = useState<"roles" | "assignments">("roles");
  const { access, has } = useHrAccess();
  const roles = useQuery({ queryKey: ["hr", "roles"], queryFn: hrAccessApi.roles, retry: false });
  const rolePermissions = useRolePermissions(roles.data);
  const admin = useQuery({
    queryKey: ["hr", "admin-status"],
    queryFn: hrAccessApi.adminStatus,
    enabled: has("ACCESS_VIEW"),
    retry: false,
  });

  return (
    <HrLayout title="HRM — Phân quyền" require={(h) => h("ACCESS_VIEW") || h("ACCESS_ADMIN")}>
      {admin.data && (
        <HrCard title="Quản trị HR được bảo vệ">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge
              value={admin.data.healthy ? "HEALTHY" : "UNHEALTHY"}
              label={admin.data.healthy ? "Đạt" : "Không đạt"}
            />
            <span className="text-gray-600">
              {admin.data.protectedAdminCount} quản trị lâu dài (tối thiểu {admin.data.minimum})
            </span>
          </div>
          {!admin.data.healthy && (
            <HrAlert tone="danger">
              Số quản trị HR lâu dài dưới mức tối thiểu. Hãy cấp thêm quản trị HR (không thời hạn, phạm vi toàn
              công ty). Khôi phục khẩn cấp chỉ thực hiện qua công cụ vận hành.
            </HrAlert>
          )}
        </HrCard>
      )}

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 w-full md:w-fit">
        {(
          [
            ["roles", "Role"],
            ["assignments", "Cấp quyền theo tài khoản"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg ${
              tab === key ? "bg-blue-500 text-white" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {roles.isLoading ? (
        <HrLoading />
      ) : roles.isError ? (
        <HrErrorState error={roles.error} onRetry={() => roles.refetch()} />
      ) : tab === "roles" ? (
        <RolesTab roles={roles.data ?? []} rolePermissions={rolePermissions} />
      ) : (
        <AssignmentsTab roles={roles.data ?? []} rolePermissions={rolePermissions} canAdmin={hrCapabilities(access).canGrantRoles} />
      )}
    </HrLayout>
  );
}

function RolesTab({ roles, rolePermissions }: { roles: HrRole[]; rolePermissions: Map<string, string[]> }) {
  if (!roles.length) return <HrEmpty title="Chưa có HR role" />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => {
        const perms = rolePermissions.get(role.code) ?? [];
        return (
          <HrCard
            key={role.code}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {role.name}
                {isSensitiveRole(perms) && <HrBadge tone="danger">Dữ liệu nhạy cảm</HrBadge>}
                {!role.isActive && <HrBadge tone="neutral">Đã tắt</HrBadge>}
              </span>
            }
          >
            <p className="text-[11px] font-mono text-gray-400">{role.code}</p>
            <p className="text-sm text-gray-600">{role.description}</p>
            <div className="flex flex-wrap gap-1">
              {perms.map((p) => (
                <HrBadge key={p} tone="info" title={p}>
                  {permissionLabel(p)}
                </HrBadge>
              ))}
            </div>
          </HrCard>
        );
      })}
      <p className="text-xs text-gray-400 md:col-span-2 xl:col-span-3">
        Quyền của role được quản lý bằng migration ở backend — chưa có chức năng sửa trên giao diện.
      </p>
    </div>
  );
}

function AssignmentsTab({
  roles,
  rolePermissions,
  canAdmin,
}: {
  roles: HrRole[];
  rolePermissions: Map<string, string[]>;
  canAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const names = useAccountNames();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<HrAssignment | null>(null);
  const [revokeError, setRevokeError] = useState<unknown>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const assignments = useQuery({
    queryKey: ["hr", "assignments", accountId],
    queryFn: () => hrAccessApi.accountAssignments(accountId!),
    enabled: accountId !== null,
    retry: false,
  });

  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code;
  const today = assignments.data?.on ?? vnToday();
  // Nhãn đơn vị cho phạm vi đã cấp (qua scope-options, cần ACCESS_ADMIN). Không
  // tra được (không có quyền, đơn vị ngoài phạm vi quản trị, đã đóng) → giữ "#id".
  const hasUnitScopes = (assignments.data?.assignments ?? []).some((a) => a.scopeRefId !== null);
  const labelUnits = useQueries({
    queries: (["BRANCH", "ORG_UNIT"] as const).map((scopeType) => ({
      queryKey: ["hr", "scope-options", scopeType, today],
      queryFn: () => hrOrgApi.scopeOptions(scopeType, today),
      enabled: canAdmin && hasUnitScopes,
      retry: false,
    })),
  });
  const knownUnits = labelUnits.flatMap((q) => q.data?.options ?? []);
  const unitLabel = (id: number | null) => (id === null ? "" : ` ${scopeUnitLabel(knownUnits, id)}`);
  const options = (accounts.data ?? []).map((a) => ({
    id: a.id,
    name: `${a.name || a.email || "Tài khoản"} (#${a.id})`,
  }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "assignments", accountId] });
    queryClient.invalidateQueries({ queryKey: ["hr", "admin-status"] });
  };

  const submitRevoke = async (reason: string) => {
    if (!revoking) return;
    setRevokeLoading(true);
    setRevokeError(null);
    try {
      await hrAccessApi.revoke(revoking.id, { reason, version: revoking.version });
      toast.success("Đã thu hồi quyền.");
      setRevoking(null);
      refresh();
    } catch (err) {
      setRevokeError(err);
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <HrCard>
        <p className="text-xs text-gray-500">
          Backend hiện chỉ trả danh sách cấp quyền theo từng tài khoản — hãy chọn tài khoản.
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1">
            <Field label="Tài khoản">
              <SearchableSelect
                value={accountId === null ? "" : String(accountId)}
                onChange={(v) => setAccountId(v ? Number(v) : null)}
                options={options}
                className={`${selectClass} w-full text-left`}
                placeholder={accounts.isLoading ? "Đang tải…" : "— Chọn tài khoản —"}
                searchPlaceholder="Tìm theo tên / email"
              />
            </Field>
          </div>
          {canAdmin && accountId !== null && (
            <button className={buttonPrimary} onClick={() => setGranting(true)}>
              <Plus size={16} /> Cấp quyền
            </button>
          )}
        </div>
      </HrCard>

      {accountId === null ? (
        <HrEmpty title="Chọn một tài khoản để xem quyền HR" />
      ) : assignments.isLoading ? (
        <HrLoading />
      ) : assignments.isError ? (
        <HrErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
      ) : !assignments.data?.assignments.length ? (
        <HrEmpty title="Tài khoản chưa được cấp HR role" />
      ) : (
        <>
          {/* Desktop: bảng */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Phạm vi</th>
                  <th className={thClass}>Hiệu lực</th>
                  <th className={thClass}>Hết hạn</th>
                  <th className={thClass}>Trạng thái</th>
                  <th className={thClass}>Nhạy cảm</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {assignments.data.assignments.map((a) => {
                  const status = assignmentStatus(a, today);
                  const sensitive = isSensitiveRole(rolePermissions.get(a.roleCode) ?? []);
                  return (
                    <tr key={a.id} className={trClass}>
                      <td className={tdClass}>
                        <p className="font-medium">{roleName(a.roleCode)}</p>
                        <p className="text-[11px] font-mono text-gray-400">{a.roleCode}</p>
                      </td>
                      <td className={tdClass}>
                        {HR_SCOPE_LABELS[a.scope]}
                        {unitLabel(a.scopeRefId)}
                      </td>
                      <td className={tdClass}>{formatVnDate(a.effectiveFrom)}</td>
                      <td className={tdClass}>{a.effectiveTo ? formatVnDate(a.effectiveTo) : "Không thời hạn"}</td>
                      <td className={tdClass}>
                        <StatusBadge value={status} label={STATUS_LABEL[status]} />
                      </td>
                      <td className={tdClass}>{sensitive ? <HrBadge tone="danger">Có</HrBadge> : "—"}</td>
                      <td className={tdClass}>
                        {canAdmin && status !== "REVOKED" && (
                          <button className={buttonDanger} onClick={() => setRevoking(a)}>
                            Thu hồi
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile: thẻ */}
          <div className="md:hidden space-y-2">
            {assignments.data.assignments.map((a) => {
              const status = assignmentStatus(a, today);
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{roleName(a.roleCode)}</p>
                    <StatusBadge value={status} label={STATUS_LABEL[status]} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {HR_SCOPE_LABELS[a.scope]}
                    {unitLabel(a.scopeRefId)} · {formatVnDate(a.effectiveFrom)} →{" "}
                    {a.effectiveTo ? formatVnDate(a.effectiveTo) : "không thời hạn"}
                  </p>
                  {canAdmin && status !== "REVOKED" && (
                    <button className={`${buttonDanger} w-full`} onClick={() => setRevoking(a)}>
                      Thu hồi
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {accountId !== null && (
        <PermissionGrantsSection
          accountId={accountId}
          accountName={names.get(accountId) ?? `#${accountId}`}
          canAdmin={canAdmin}
          unitLabel={unitLabel}
          roles={roles}
          rolePermissions={rolePermissions}
        />
      )}

      {granting && accountId !== null && (
        <GrantDialog
          accountId={accountId}
          accountName={names.get(accountId) ?? `#${accountId}`}
          roles={roles.filter((r) => r.isActive)}
          rolePermissions={rolePermissions}
          onClose={() => setGranting(false)}
          onDone={() => {
            setGranting(false);
            refresh();
          }}
        />
      )}

      {revoking && (
        <ReasonDialog
          title="Thu hồi quyền HR"
          submitLabel="Thu hồi"
          submitColor="bg-red-500"
          loading={revokeLoading}
          error={revokeError}
          description={
            <div className="space-y-2">
              <p>
                Bạn có chắc muốn thu hồi quyền <b>{revoking.roleCode}</b> của{" "}
                <b>{names.get(revoking.accountId) ?? `tài khoản #${revoking.accountId}`}</b>?
              </p>
              {(revoking.roleCode === "HR_ADMIN" ||
                isSensitiveRole(rolePermissions.get(revoking.roleCode) ?? [])) && (
                <HrAlert tone="warning">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <ShieldAlert size={14} /> Quyền quản trị / dữ liệu nhạy cảm
                  </span>
                  <p className="text-xs mt-1">
                    Thu hồi có hiệu lực ngay. Hệ thống sẽ từ chối nếu làm công ty thiếu quản trị HR tối thiểu.
                  </p>
                </HrAlert>
              )}
            </div>
          }
          onClose={() => {
            setRevoking(null);
            setRevokeError(null);
          }}
          onSubmit={submitRevoke}
        />
      )}
    </div>
  );
}

/**
 * Cấp quyền — MỘT hộp thoại cho cả cấp role và cấp quyền lẻ (Phase 1.3): cùng
 * phạm vi/đơn vị/thời hạn/lý do; backend áp cùng luật M1/M2/audit.
 */
function GrantDialog({
  accountId,
  accountName,
  roles,
  rolePermissions,
  kind = "role",
  onClose,
  onDone,
}: {
  accountId: number;
  accountName: string;
  roles: HrRole[];
  rolePermissions: Map<string, string[]>;
  kind?: "role" | "permission";
  onClose: () => void;
  onDone: () => void;
}) {
  const today = vnToday();
  const isPermission = kind === "permission";
  const [roleCode, setRoleCode] = useState("");
  const [scope, setScope] = useState<HrScope>("COMPANY");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const sensitive = isSensitiveRole(isPermission ? [roleCode] : (rolePermissions.get(roleCode) ?? []));
  const maxTo = sensitive && effectiveFrom ? latestSensitiveEffectiveTo(effectiveFrom) : undefined;
  const needsUnit = scopeNeedsUnit(scope);
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom);
  // Đơn vị đang hoạt động TẠI ngày bắt đầu hiệu lực, trong phạm vi quản trị của mình (backend lọc).
  const units = useQuery({
    queryKey: ["hr", "scope-options", scope, effectiveFrom],
    queryFn: () => hrOrgApi.scopeOptions(scope as "BRANCH" | "ORG_UNIT", effectiveFrom),
    enabled: needsUnit && validFrom,
    retry: false,
  });
  const scopeOptions = units.data?.options ?? [];
  const unitOptions = scopeOptionItems(scopeOptions, ORG_UNIT_TYPE_LABELS);
  const changeScope = (next: HrScope) => {
    setScope(next);
    // Đổi phạm vi → bỏ đơn vị đã chọn (loại đơn vị hợp lệ khác nhau).
    setUnitId(null);
  };

  const problems: string[] = [];
  if (!roleCode) problems.push(isPermission ? "Chọn quyền." : "Chọn role.");
  if (needsUnit && !isValidScopeOption(scopeOptions, unitId))
    problems.push("Chọn đơn vị đang hoạt động tại ngày hiệu lực cho phạm vi đã chọn.");
  if (effectiveFrom < today) problems.push("Ngày hiệu lực không được ở quá khứ.");
  if (effectiveTo && effectiveTo < effectiveFrom) problems.push("Ngày hết hạn phải sau ngày hiệu lực.");
  if (sensitive && !effectiveTo) problems.push("Quyền dữ liệu nhạy cảm bắt buộc có ngày hết hạn.");
  if (maxTo && effectiveTo > maxTo) problems.push(`Ngày hết hạn tối đa: ${formatVnDate(maxTo)}.`);
  if (reason.trim().length < 5) problems.push("Lý do tối thiểu 5 ký tự.");

  const submit = async () => {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const body = {
        scope,
        scopeRefId: scopeRefIdFor(scope, unitId),
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        reason: reason.trim(),
      };
      if (isPermission) await hrAccessApi.grantPermission(accountId, { ...body, permissionCode: roleCode });
      else await hrAccessApi.assign(accountId, { ...body, roleCode });
      toast.success("Đã cấp quyền.");
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`${isPermission ? "Cấp quyền lẻ" : "Cấp quyền HR"} — ${accountName}`}
      submitLabel="Cấp quyền"
      loading={loading}
      disabled={problems.length > 0}
      onClose={onClose}
      onSubmit={submit}
      wide
    >
      {isPermission ? (
        <Field label="Quyền" required hint="Một quyền cho một người. Quản trị phân quyền chỉ cấp qua role HR_ADMIN.">
          <select className={`${selectClass} w-full`} value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
            <option value="">— Chọn quyền —</option>
            {DIRECT_GRANT_PERMISSIONS.map((c) => (
              <option key={c} value={c}>
                {permissionLabel(c)} ({c})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Role" required>
          <select className={`${selectClass} w-full`} value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
            <option value="">— Chọn role —</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </Field>
      )}
      {roleCode && !isPermission && (
        <div className="flex flex-wrap gap-1">
          {(rolePermissions.get(roleCode) ?? []).map((p) => (
            <HrBadge key={p} tone="info">
              {permissionLabel(p)}
            </HrBadge>
          ))}
        </div>
      )}
      {sensitive && (
        <HrAlert tone="warning">
          Quyền truy cập dữ liệu nhạy cảm chỉ được cấp tối đa {MAX_SENSITIVE_ACCESS_DAYS} ngày.
        </HrAlert>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Phạm vi" required>
          <select className={`${selectClass} w-full`} value={scope} onChange={(e) => changeScope(e.target.value as HrScope)}>
            {HR_SCOPES.map((s) => (
              <option key={s} value={s}>
                {HR_SCOPE_LABELS[s]} ({s})
              </option>
            ))}
          </select>
        </Field>
        {needsUnit && (
          <Field
            label="Đơn vị"
            required
            hint={`Chọn ${(SCOPE_UNIT_TYPES[scope] ?? []).map((t) => ORG_UNIT_TYPE_LABELS[t].toLowerCase()).join(" / ")} đang hoạt động — tìm theo tên, mã DV hoặc đường dẫn.`}
          >
            {units.isError ? (
              <p className="text-sm text-red-600">{describeHrError(units.error).message}</p>
            ) : !units.isLoading && !unitOptions.length ? (
              <p className="text-sm text-gray-500">
                Không có đơn vị phù hợp đang hoạt động tại ngày hiệu lực trong phạm vi quản trị của bạn.
              </p>
            ) : (
              <SearchableSelect
                value={unitId === null ? "" : String(unitId)}
                onChange={(v) => setUnitId(v ? Number(v) : null)}
                options={unitOptions}
                className={`${selectClass} w-full text-left`}
                placeholder={units.isLoading ? "Đang tải cơ cấu…" : "— Chọn đơn vị —"}
                searchPlaceholder="Tìm theo tên, mã DV, đường dẫn"
              />
            )}
          </Field>
        )}
        <Field label="Hiệu lực từ" required>
          <input
            type="date"
            className={inputClass}
            min={today}
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field
          label="Hết hạn (ngày cuối còn hiệu lực)"
          required={sensitive}
          hint={sensitive ? `Tối đa ${maxTo ? formatVnDate(maxTo) : ""}` : "Bỏ trống = không thời hạn"}
        >
          <input
            type="date"
            className={inputClass}
            min={effectiveFrom}
            max={maxTo}
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Lý do" required>
        <textarea className={inputClass} rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {problems.length > 0 && (reason || roleCode) && (
        <ul className="text-xs text-amber-700 list-disc pl-4">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <HrFormError error={error} />
    </Modal>
  );
}

/** Phase 1.3 — quyền lẻ của tài khoản: danh sách, cấp, thu hồi (cùng luật với cấp role). */
function PermissionGrantsSection({
  accountId,
  accountName,
  canAdmin,
  unitLabel,
  roles,
  rolePermissions,
}: {
  accountId: number;
  accountName: string;
  canAdmin: boolean;
  unitLabel: (id: number | null) => string;
  roles: HrRole[];
  rolePermissions: Map<string, string[]>;
}) {
  const queryClient = useQueryClient();
  const key = ["hr", "permission-grants", accountId];
  const grants = useQuery({ queryKey: key, queryFn: () => hrAccessApi.permissionGrants(accountId), retry: false });
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<HrPermissionGrant | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const today = grants.data?.on ?? vnToday();
  const statusOf = (g: HrPermissionGrant) =>
    g.revokedAt ? "REVOKED" : g.effectiveFrom > today ? "UPCOMING" : g.active ? "ACTIVE" : "EXPIRED";

  const submitRevoke = async (reason: string) => {
    if (!revoking) return;
    setLoading(true);
    setError(null);
    try {
      await hrAccessApi.revokePermissionGrant(revoking.id, { reason, version: revoking.version });
      toast.success("Đã thu hồi quyền lẻ.");
      setRevoking(null);
      refresh();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <HrCard
      title="Quyền lẻ"
      action={
        canAdmin && (
          <button className={buttonPrimary} onClick={() => setGranting(true)}>
            <Plus size={16} /> Cấp quyền lẻ
          </button>
        )
      }
    >
      <p className="text-xs text-gray-500">
        Cấp riêng một quyền cho một người (vd. Xem giấy khám sức khỏe). Quyền dữ liệu nhạy cảm bắt buộc có hạn, tối đa{" "}
        {MAX_SENSITIVE_ACCESS_DAYS} ngày.
      </p>
      {grants.isLoading ? (
        <HrLoading />
      ) : grants.isError ? (
        <HrErrorState error={grants.error} onRetry={() => grants.refetch()} />
      ) : !grants.data?.grants.length ? (
        <p className="text-sm text-gray-500">Chưa có quyền lẻ.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {grants.data.grants.map((g) => {
            const status = statusOf(g);
            return (
              <li key={g.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {permissionLabel(g.permissionCode)} <span className="text-[11px] font-mono text-gray-400">{g.permissionCode}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {HR_SCOPE_LABELS[g.scope]}
                    {unitLabel(g.scopeRefId)} · {formatVnDate(g.effectiveFrom)} →{" "}
                    {g.effectiveTo ? formatVnDate(g.effectiveTo) : "không thời hạn"}
                    {g.revokeReason && ` · Thu hồi: ${g.revokeReason}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {g.sensitive && <HrBadge tone="danger">Nhạy cảm</HrBadge>}
                  <StatusBadge value={status} label={STATUS_LABEL[status]} />
                  {canAdmin && status !== "REVOKED" && status !== "EXPIRED" && (
                    <button className={buttonDanger} onClick={() => setRevoking(g)}>
                      Thu hồi
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {granting && (
        <GrantDialog
          kind="permission"
          accountId={accountId}
          accountName={accountName}
          roles={roles}
          rolePermissions={rolePermissions}
          onClose={() => setGranting(false)}
          onDone={() => {
            setGranting(false);
            refresh();
          }}
        />
      )}
      {revoking && (
        <ReasonDialog
          title="Thu hồi quyền lẻ"
          submitLabel="Thu hồi"
          submitColor="bg-red-500"
          loading={loading}
          error={error}
          description={
            <p>
              Thu hồi quyền <b>{permissionLabel(revoking.permissionCode)}</b> của <b>{accountName}</b>? Có hiệu lực ngay.
            </p>
          }
          onClose={() => {
            setRevoking(null);
            setError(null);
          }}
          onSubmit={submitRevoke}
        />
      )}
    </HrCard>
  );
}
