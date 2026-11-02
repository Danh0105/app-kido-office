import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { hrEmployeeApi } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import { CRYPTO_UNAVAILABLE_TEXT, HrAlert, HrErrorState, HrLoading, StatusBadge } from "./components/HrUi";
import { useAccountNames } from "./hooks/useAccountNames";
import { useHrAccess, useHrCryptoStatus } from "./hooks/useHrAccess";
import IdentityTab from "./employee/IdentityTab";
import BankTab from "./employee/BankTab";
import NumberProfileTab from "./employee/NumberProfileTab";
import DocumentsTab from "./employee/DocumentsTab";
import FilesTab from "./employee/FilesTab";
import OverviewTab from "./employee/OverviewTab";
import type { EmployeeTabProps } from "./employee/types";
import { hrCapabilities } from "./lib/hrAccess";

/**
 * Hồ sơ nhân viên — bố cục tab để Phase 1 mở rộng. Chỉ có tab mà backend đã
 * có API; "Nhật ký theo nhân viên" chưa có bộ lọc ở backend nên chưa hiện.
 */
const TABS = [
  { key: "overview", title: "Tổng quan" },
  { key: "identity", title: "Định danh" },
  { key: "bank", title: "Ngân hàng" },
  { key: "tax", title: "Thuế" },
  { key: "insurance", title: "BHXH" },
  { key: "documents", title: "Tài liệu" },
  { key: "files", title: "File định danh" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function HrEmployeeDetailPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");
  const hr = useHrAccess();
  const crypto = useHrCryptoStatus(hr.has("ACCESS_VIEW"));
  const names = useAccountNames();
  const employee = useQuery({
    queryKey: ["hr", "employee", employeeId],
    queryFn: () => hrEmployeeApi.get(employeeId),
    enabled: Number.isInteger(employeeId) && employeeId > 0,
    retry: false,
  });

  const props: EmployeeTabProps | null = employee.data
    ? {
        employee: employee.data,
        access: hr.access,
        canEdit: hrCapabilities(hr.access).canEditEmployees,
        cryptoWriteUnavailable: crypto.writeUnavailable,
        cryptoRevealUnavailable: crypto.revealUnavailable,
      }
    : null;

  return (
    <HrLayout title="HRM — Hồ sơ nhân viên" require={(has) => has("EMPLOYEE_VIEW")}>
      <button onClick={() => navigate("/hr/employees")} className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft size={16} /> Danh sách
      </button>

      {employee.isLoading ? (
        <HrLoading />
      ) : employee.isError || !props ? (
        <HrErrorState error={employee.error ?? { response: { status: 404 } }} />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{props.employee.fullName}</h2>
              <p className="text-xs text-gray-500">
                {props.employee.employeeCode}
                {props.employee.accountId !== null &&
                  ` · ${names.get(props.employee.accountId) ?? `Tài khoản #${props.employee.accountId}`}`}
              </p>
            </div>
            <StatusBadge value={props.employee.status} label={props.employee.status === "ACTIVE" ? "Hồ sơ hoạt động" : "Hồ sơ ngừng"} />
          </div>

          {crypto.writeUnavailable && <HrAlert tone="danger">{CRYPTO_UNAVAILABLE_TEXT}</HrAlert>}

          <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 overflow-x-auto">
            {TABS.filter((t) => t.key !== "documents" || hrCapabilities(hr.access).canViewDocuments).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg ${
                  tab === t.key ? "bg-blue-500 text-white" : "text-gray-500"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Mỗi tab unmount khi chuyển → form/giá trị nhạy cảm bị xoá cùng. */}
          {tab === "overview" && <OverviewTab {...props} />}
          {tab === "identity" && <IdentityTab {...props} />}
          {tab === "bank" && <BankTab {...props} />}
          {tab === "tax" && <NumberProfileTab {...props} kind="TAX_NUMBER" />}
          {tab === "insurance" && <NumberProfileTab {...props} kind="SOCIAL_INSURANCE_NUMBER" />}
          {tab === "documents" && <DocumentsTab {...props} />}
          {tab === "files" && <FilesTab {...props} />}
        </>
      )}
    </HrLayout>
  );
}
