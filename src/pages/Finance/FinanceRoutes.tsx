import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Landmark, Plus } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { financeApi } from "@/service/finance";
import type { FinanceMeta } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { getEmployeeId } from "@/utils/auth";
import { ErrorState, LoadingState } from "./components/FinanceUi";
import FinanceConfig from "./FinanceConfig";
import FinanceDashboard from "./FinanceDashboard";
import FinancePayments from "./FinancePayments";
import FinanceReports from "./FinanceReports";
import FinanceRequestDetail from "./FinanceRequestDetail";
import FinanceRequestForm from "./FinanceRequestForm";
import FinanceRequestList from "./FinanceRequestList";
import { useFinanceBase } from "./lib";

const MetaContext = createContext<FinanceMeta | null>(null);

/** Danh mục + quyền của người đang đăng nhập — nạp một lần cho cả phân hệ. */
export const useFinanceMeta = () => {
  const meta = useContext(MetaContext);
  if (!meta) throw new Error("useFinanceMeta ngoài FinanceRoutes");
  return meta;
};

export const FINANCE_META_KEY = ["finance-meta"];

function Shell({ meta, children }: { meta: FinanceMeta; children: ReactNode }) {
  const base = useFinanceBase();
  const navigate = useNavigate();
  const caps = meta.capabilities;
  const tabs = [
    { to: base, label: "Tổng quan", end: true, show: true },
    { to: `${base}/mine`, label: "Đề nghị của tôi", show: true },
    { to: `${base}/approvals`, label: "Chờ tôi phê duyệt", show: caps.canApprove || caps.isAdmin },
    { to: `${base}/list`, label: "Tất cả đề nghị", show: caps.canViewAll },
    { to: `${base}/payments`, label: "Quản lý thanh toán", show: caps.canManagePayments || caps.canConfirmDeductions },
    { to: `${base}/reports`, label: "Báo cáo – Thống kê", show: caps.canViewReports },
    { to: `${base}/config`, label: "Cấu hình quy trình", show: caps.isAdmin },
  ].filter((tab) => tab.show);

  return (
    <div className="min-h-screen bg-slate-100 pb-24 pt-[72px] text-slate-900">
      <HeaderWithBack title="Đề nghị tài chính nội bộ" />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-3 md:px-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-5 text-white shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                <Landmark size={24} />
              </div>
              <h1 className="text-xl font-bold md:text-2xl">Đề nghị tài chính nội bộ</h1>
              <p className="mt-1 text-sm text-blue-100">
                Tạm ứng, tạm ứng lương, hoàn ứng và thanh toán chi phí — duyệt và theo dõi trên một nơi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${base}/new`)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffd84d] px-5 py-3 text-sm font-bold text-blue-950 shadow-sm hover:bg-yellow-300"
            >
              <Plus size={18} /> Tạo đề nghị
            </button>
          </div>
        </section>

        <nav className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function Guard({ allow, children }: { allow: boolean; children: ReactNode }) {
  const base = useFinanceBase();
  return allow ? <>{children}</> : <Navigate to={base} replace />;
}

/**
 * Mỗi tài khoản một bộ nhớ đệm riêng: đăng xuất rồi đăng nhập người khác
 * trong cùng phiên trình duyệt (không tải lại trang) không được thấy quyền,
 * số liệu hay thông báo của người trước.
 */
export default function FinanceRoutes() {
  const userId = getEmployeeId();
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );
  return (
    <QueryClientProvider client={client}>
      <FinanceModule key={String(userId)} />
    </QueryClientProvider>
  );
}

function FinanceModule() {
  const metaQuery = useQuery({
    queryKey: FINANCE_META_KEY,
    queryFn: financeApi.meta,
    staleTime: 60_000,
  });

  if (metaQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 pt-[72px]">
        <HeaderWithBack title="Đề nghị tài chính nội bộ" />
        <main className="mx-auto max-w-7xl px-3 md:px-6">
          <LoadingState text="Đang tải phân hệ tài chính…" />
        </main>
      </div>
    );
  }
  if (metaQuery.isError || !metaQuery.data) {
    return (
      <div className="min-h-screen bg-slate-100 pt-[72px]">
        <HeaderWithBack title="Đề nghị tài chính nội bộ" />
        <main className="mx-auto max-w-7xl px-3 md:px-6">
          <ErrorState
            message={getApiErrorMessage(metaQuery.error, "Không tải được phân hệ tài chính.")}
            onRetry={() => void metaQuery.refetch()}
          />
        </main>
      </div>
    );
  }

  const meta = metaQuery.data;
  const caps = meta.capabilities;
  return (
    <MetaContext.Provider value={meta}>
      <Shell meta={meta}>
        <Routes>
          <Route index element={<FinanceDashboard />} />
          <Route path="mine" element={<FinanceRequestList scope="mine" />} />
          <Route path="approvals" element={<FinanceRequestList scope="approvals" />} />
          <Route
            path="list"
            element={
              <Guard allow={caps.canViewAll}>
                <FinanceRequestList scope="all" />
              </Guard>
            }
          />
          <Route
            path="payments"
            element={
              <Guard allow={caps.canManagePayments || caps.canConfirmDeductions}>
                <FinancePayments />
              </Guard>
            }
          />
          <Route
            path="reports"
            element={
              <Guard allow={caps.canViewReports}>
                <FinanceReports />
              </Guard>
            }
          />
          <Route
            path="config"
            element={
              <Guard allow={caps.isAdmin}>
                <FinanceConfig />
              </Guard>
            }
          />
          <Route path="new" element={<FinanceRequestForm />} />
          <Route path="requests/:id" element={<FinanceRequestDetail />} />
          <Route path="requests/:id/edit" element={<FinanceRequestForm />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Shell>
    </MetaContext.Provider>
  );
}
