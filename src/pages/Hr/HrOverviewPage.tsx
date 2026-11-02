import { useQuery } from "@tanstack/react-query";
import { FileClock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hrAccessApi, hrDocumentApi } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import {
  CRYPTO_UNAVAILABLE_TEXT,
  HrAlert,
  HrBadge,
  HrCard,
  HrErrorState,
  HrLoading,
  StatusBadge,
} from "./components/HrUi";
import { useHrAccess, useHrCryptoStatus } from "./hooks/useHrAccess";
import { HR_SCOPE_LABELS, permissionLabel } from "./lib/hrAccess";
import { DOCUMENT_POLICY, EXPIRY_STATUS_VIEW } from "./lib/hrDocuments";

function StatusRow({ label, value, tone, note }: { label: string; value: string; tone: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-gray-100">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        {note && <p className="text-[11px] text-gray-400">{note}</p>}
      </div>
      <StatusBadge value={tone} label={value} />
    </div>
  );
}

/**
 * Phase 0: chỉ hiển thị trạng thái bảo mật / thiết lập mà backend thật sự
 * cung cấp — không có số liệu nhân sự (chưa có API).
 */
export default function HrOverviewPage() {
  const { access, has } = useHrAccess();
  const canViewAccess = has("ACCESS_VIEW");
  const crypto = useHrCryptoStatus(canViewAccess);
  const admin = useQuery({
    queryKey: ["hr", "admin-status"],
    queryFn: hrAccessApi.adminStatus,
    enabled: canViewAccess,
    retry: false,
  });

  return (
    <HrLayout title="HRM — Tổng quan">
      {crypto.writeUnavailable && <HrAlert tone="danger">{CRYPTO_UNAVAILABLE_TEXT}</HrAlert>}
      {admin.data && !admin.data.healthy && (
        <HrAlert tone="danger">
          Số quản trị HR lâu dài ({admin.data.protectedAdminCount}) thấp hơn mức tối thiểu (
          {admin.data.minimum}). Cần cấp thêm quản trị HR — việc khôi phục khẩn cấp chỉ làm qua
          công cụ vận hành (CLI), không làm từ giao diện.
        </HrAlert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <HrCard title="Trạng thái hệ thống">
          {!canViewAccess ? (
            <p className="text-sm text-gray-500">
              Cần quyền "{permissionLabel("ACCESS_VIEW")}" để xem trạng thái hệ thống.
            </p>
          ) : crypto.isLoading || admin.isLoading ? (
            <HrLoading />
          ) : (
            <div>
              <StatusRow label="Phân quyền HR" value="Sẵn sàng" tone="AVAILABLE" />
              {crypto.status ? (
                <>
                  <StatusRow
                    label="Mã hóa dữ liệu"
                    value={crypto.status.encryptionKeyringReady ? "Sẵn sàng" : "Chưa sẵn sàng"}
                    tone={crypto.status.encryptionKeyringReady ? "AVAILABLE" : "UNAVAILABLE"}
                  />
                  <StatusRow
                    label="Chỉ mục tra cứu (HMAC)"
                    value={crypto.status.hmacKeyringReady ? "Sẵn sàng" : "Chưa sẵn sàng"}
                    tone={crypto.status.hmacKeyringReady ? "AVAILABLE" : "UNAVAILABLE"}
                  />
                </>
              ) : (
                <StatusRow label="Mã hóa dữ liệu" value="Không đọc được" tone="EXPIRED" />
              )}
              <StatusRow
                label="Kho tài liệu riêng tư"
                value="Chưa có API trạng thái"
                tone="EXPIRED"
                note="Kiểm tra bằng thao tác tải lên/tải xuống"
              />
              {admin.data && (
                <StatusRow
                  label="Quản trị HR lâu dài"
                  value={`${admin.data.protectedAdminCount}/${admin.data.minimum} tối thiểu`}
                  tone={admin.data.healthy ? "HEALTHY" : "UNHEALTHY"}
                />
              )}
            </div>
          )}
          {admin.isError && <HrErrorState error={admin.error} onRetry={() => admin.refetch()} />}
        </HrCard>

        <HrCard
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" /> Quyền HR của tôi
            </span>
          }
        >
          {!access ? (
            <HrLoading />
          ) : (
            <ul className="divide-y divide-gray-100">
              {access.permissions.map((p) => (
                <li key={p.code} className="py-2">
                  <p className="text-sm text-gray-700">{permissionLabel(p.code)}</p>
                  <p className="text-[11px] text-gray-400">
                    {p.code} ·{" "}
                    {p.scopes
                      .map((s) => `${HR_SCOPE_LABELS[s.scope] ?? s.scope}${s.scopeRefId ? ` #${s.scopeRefId}` : ""}`)
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </HrCard>

        {has("DOCUMENT_VIEW") && <ExpiringDocumentsCard />}
      </div>
    </HrLayout>
  );
}

/** Phase 1.3 — tài liệu sắp hết hạn (≤ 30 ngày) hoặc đã hết hạn, trong phạm vi DOCUMENT_VIEW. */
function ExpiringDocumentsCard() {
  const navigate = useNavigate();
  const expiring = useQuery({ queryKey: ["hr", "documents", "expiring"], queryFn: () => hrDocumentApi.expiring(30), retry: false });
  const items = expiring.data?.items ?? [];
  return (
    <HrCard
      title={
        <span className="inline-flex items-center gap-2">
          <FileClock size={16} className="text-amber-500" /> Tài liệu sắp hết hạn
        </span>
      }
    >
      {expiring.isLoading ? (
        <HrLoading />
      ) : expiring.isError ? (
        <HrErrorState error={expiring.error} onRetry={() => expiring.refetch()} />
      ) : !items.length ? (
        <p className="text-sm text-gray-500">Không có tài liệu nào hết hạn trong 30 ngày tới.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.slice(0, 10).map((d) => (
            <li key={d.id} className="py-2">
              <button className="w-full text-left" onClick={() => navigate(`/hr/employees/${d.employeeId}`)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-700 truncate">
                    {d.fullName} <span className="text-[11px] text-gray-400">({d.employeeCode})</span>
                  </p>
                  <HrBadge tone={EXPIRY_STATUS_VIEW[d.expiryStatus].tone}>{EXPIRY_STATUS_VIEW[d.expiryStatus].label}</HrBadge>
                </div>
                <p className="text-[11px] text-gray-500">
                  {DOCUMENT_POLICY[d.documentType]?.label ?? d.documentType} · {d.title} · hết hạn {d.expiresOn.split("-").reverse().join("/")}
                </p>
              </button>
            </li>
          ))}
          {items.length > 10 && <li className="py-2 text-[11px] text-gray-400">… và {items.length - 10} tài liệu khác</li>}
        </ul>
      )}
    </HrCard>
  );
}
