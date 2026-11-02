import { useQuery } from "@tanstack/react-query";
import { hrAccessApi } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import {
  CRYPTO_UNAVAILABLE_TEXT,
  HrAlert,
  HrCard,
  HrErrorState,
  HrLoading,
  StatusBadge,
} from "./components/HrUi";
import { useHrCryptoStatus } from "./hooks/useHrAccess";
import { MAX_SENSITIVE_ACCESS_DAYS, SENSITIVE_PERMISSIONS } from "./lib/hrAccess";
import { HR_FILE_ALLOWED_LABEL, HR_FILE_MAX_BYTES } from "./lib/hrFiles";
import { useAccountNames } from "./hooks/useAccountNames";

/** Cấu hình / trạng thái kỹ thuật HR (chỉ đọc). Không bao giờ hiển thị khoá. */
export default function HrSettingsPage() {
  const crypto = useHrCryptoStatus(true);
  const admin = useQuery({ queryKey: ["hr", "admin-status"], queryFn: hrAccessApi.adminStatus, retry: false });
  const names = useAccountNames();

  const nameOf = (id: number) => names.get(id) ?? `Tài khoản #${id}`;

  return (
    <HrLayout title="HRM — Cấu hình" require={(has) => has("ACCESS_VIEW")}>
      <div className="grid gap-3 md:grid-cols-2">
        <HrCard title="Mã hóa dữ liệu nhạy cảm">
          {crypto.isLoading ? (
            <HrLoading />
          ) : crypto.status ? (
            <div className="space-y-2 text-sm">
              {crypto.writeUnavailable && <HrAlert tone="danger">{CRYPTO_UNAVAILABLE_TEXT}</HrAlert>}
              <div className="flex justify-between">
                <span>Trạng thái</span>
                <StatusBadge value={crypto.status.status} />
              </div>
              <div className="flex justify-between">
                <span>Khoá mã hóa</span>
                <span className="text-gray-600">
                  {crypto.status.encryptionKeyringReady ? `Sẵn sàng (${crypto.status.activeEncryptionVersion})` : "Chưa sẵn sàng"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Khoá HMAC</span>
                <span className="text-gray-600">
                  {crypto.status.hmacKeyringReady ? `Sẵn sàng (${crypto.status.activeHmacVersion})` : "Chưa sẵn sàng"}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Chỉ hiển thị phiên bản khoá — không bao giờ hiển thị khoá.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Không đọc được trạng thái mã hóa.</p>
          )}
        </HrCard>

        <HrCard title="Quản trị HR được bảo vệ">
          {admin.isLoading ? (
            <HrLoading />
          ) : admin.isError ? (
            <HrErrorState error={admin.error} onRetry={() => admin.refetch()} />
          ) : admin.data ? (
            <div className="space-y-2 text-sm">
              {!admin.data.healthy && (
                <HrAlert tone="danger">
                  Thiếu quản trị HR lâu dài. Hãy cấp thêm quản trị trước khi thu hồi/khoá tài khoản quản trị.
                </HrAlert>
              )}
              <div className="flex justify-between">
                <span>Tình trạng</span>
                <StatusBadge
                  value={admin.data.healthy ? "HEALTHY" : "UNHEALTHY"}
                  label={admin.data.healthy ? "Đạt" : "Không đạt"}
                />
              </div>
              <div className="flex justify-between">
                <span>Số lượng</span>
                <span className="text-gray-600">
                  {admin.data.protectedAdminCount} (tối thiểu {admin.data.minimum})
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Quản trị lâu dài</p>
                <p className="text-gray-700">{admin.data.protectedAdminAccountIds.map(nameOf).join(", ") || "—"}</p>
              </div>
              {admin.data.temporaryAdminAccountIds.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Quản trị có thời hạn (không tính vào tối thiểu)</p>
                  <p className="text-gray-700">{admin.data.temporaryAdminAccountIds.map(nameOf).join(", ")}</p>
                </div>
              )}
            </div>
          ) : null}
        </HrCard>

        <HrCard title="Kho tài liệu riêng tư">
          <p className="text-sm text-gray-600">Backend chưa có API trạng thái kho tài liệu.</p>
          <ul className="text-sm text-gray-600 list-disc pl-5">
            <li>Định dạng cho phép: {HR_FILE_ALLOWED_LABEL}</li>
            <li>Dung lượng tối đa: {HR_FILE_MAX_BYTES / 1024 / 1024} MB</li>
            <li>Liên kết tải có hiệu lực 5 phút</li>
          </ul>
        </HrCard>

        <HrCard title="Quy định cấp quyền">
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>Không cấp quyền vượt quá quyền, phạm vi, thời hạn của chính người cấp.</li>
            <li>
              Quyền dữ liệu nhạy cảm ({SENSITIVE_PERMISSIONS.join(", ")}) tối đa {MAX_SENSITIVE_ACCESS_DAYS} ngày.
            </li>
            <li>Không tự cấp / tự thu hồi quyền của chính mình.</li>
            <li>Khôi phục quản trị khẩn cấp chỉ qua công cụ vận hành (CLI).</li>
          </ul>
        </HrCard>
      </div>
    </HrLayout>
  );
}
