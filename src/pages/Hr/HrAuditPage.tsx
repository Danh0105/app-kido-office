import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SearchableSelect from "@/components/SearchableSelect";
import { inputClass } from "@/pages/Teaching/components/Modal";
import { FilterCard, Pagination, selectClass, tdClass, thClass, theadClass, trClass } from "@/pages/Teaching/components/Shared";
import { hrAuditApi, type HrAuditLogItem, type HrAuditQuery } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import { HrEmpty, HrErrorState, HrLoading } from "./components/HrUi";
import { useAccounts } from "./hooks/useAccountNames";
import { formatVnDate } from "./lib/hrAccess";
import {
  HR_AUDIT_ACTION_LABELS,
  HR_AUDIT_ENTITY_LABELS,
  auditActionLabel,
  auditEmployeeId,
  auditEntityLabel,
  summarizeAuditValue,
} from "./lib/hrAudit";

const LIMIT = 20;

/** Nhật ký HR — lọc bằng tham số backend hỗ trợ (không lọc client trên toàn bộ dữ liệu). */
export default function HrAuditPage() {
  const [filters, setFilters] = useState<HrAuditQuery>({});
  const [page, setPage] = useState(1);
  const accounts = useAccounts();
  const query = { ...filters, page, limit: LIMIT };
  const logs = useQuery({
    queryKey: ["hr", "audit", query],
    queryFn: () => hrAuditApi.list(query),
    retry: false,
  });

  const set = (patch: Partial<HrAuditQuery>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / LIMIT)) : 1;

  return (
    <HrLayout title="HRM — Nhật ký" require={(_has, hasUnrestricted) => hasUnrestricted("AUDIT_VIEW")}>
      <FilterCard>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <select className={selectClass} value={filters.action ?? ""} onChange={(e) => set({ action: e.target.value || undefined })}>
            <option value="">Mọi thao tác</option>
            {Object.entries(HR_AUDIT_ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={selectClass} value={filters.entity ?? ""} onChange={(e) => set({ entity: e.target.value || undefined })}>
            <option value="">Mọi đối tượng</option>
            {Object.entries(HR_AUDIT_ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="Mã đối tượng (id)"
            value={filters.entityId ?? ""}
            onChange={(e) => set({ entityId: e.target.value.trim() || undefined })}
          />
          <SearchableSelect
            value={filters.actorAccountId ? String(filters.actorAccountId) : ""}
            onChange={(v) => set({ actorAccountId: v ? Number(v) : undefined })}
            options={(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name || a.email || `#${a.id}` }))}
            className={`${selectClass} w-full text-left`}
            placeholder="Mọi người thực hiện"
          />
          <input type="date" className={inputClass} value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
          <input type="date" className={inputClass} value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Lọc theo nhân viên chưa có ở backend — dùng "Đối tượng = Hồ sơ nhân viên" + mã hồ sơ.
        </p>
      </FilterCard>

      {logs.isLoading ? (
        <HrLoading />
      ) : logs.isError ? (
        <HrErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : !logs.data?.items.length ? (
        <HrEmpty title="Không có bản ghi nhật ký phù hợp" />
      ) : (
        <>
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Thời gian</th>
                  <th className={thClass}>Người thực hiện</th>
                  <th className={thClass}>Thao tác</th>
                  <th className={thClass}>Đối tượng</th>
                  <th className={thClass}>Nhân viên</th>
                  <th className={thClass}>Thông tin thay đổi</th>
                  <th className={thClass}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.items.map((a) => (
                  <tr key={a.id} className={`${trClass} align-top`}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatVnDate(a.occurredAt)}</td>
                    <td className={tdClass}>{a.actorName ?? (a.actorAccountId ? `#${a.actorAccountId}` : "Hệ thống")}</td>
                    <td className={tdClass} title={a.action}>
                      {auditActionLabel(a.action)}
                    </td>
                    <td className={tdClass}>
                      {auditEntityLabel(a.entity)}
                      {a.entityId ? ` #${a.entityId}` : ""}
                    </td>
                    <td className={tdClass}>{auditEmployeeId(a) ?? "—"}</td>
                    <td className={`${tdClass} max-w-md`}>
                      <AuditChange entry={a} />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-xs text-gray-500`}>{a.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden space-y-2">
            {logs.data.items.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{auditActionLabel(a.action)}</p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{formatVnDate(a.occurredAt)}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {a.actorName ?? "Hệ thống"} · {auditEntityLabel(a.entity)}
                  {a.entityId ? ` #${a.entityId}` : ""}
                </p>
                <AuditChange entry={a} />
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </HrLayout>
  );
}

function AuditChange({ entry }: { entry: HrAuditLogItem }) {
  const before = summarizeAuditValue(entry.oldValue);
  const after = summarizeAuditValue(entry.newValue);
  return (
    <div className="space-y-1 text-xs text-gray-600 break-words">
      {before.length > 0 && <p className="text-gray-400">Trước: {before.join(" · ")}</p>}
      {after.length > 0 && <p>{before.length > 0 ? "Sau: " : ""}{after.join(" · ")}</p>}
      {entry.reason && <p className="text-gray-500">Lý do: {entry.reason}</p>}
    </div>
  );
}
