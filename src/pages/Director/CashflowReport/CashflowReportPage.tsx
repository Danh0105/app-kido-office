import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  ChartNoAxesCombined,
  CircleDollarSign,
  Download,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import FadeContent from "@/components/ReactBits/FadeContent";
import {
  cashflowReportApi,
  type AccountType,
  type CashAccountGroup,
  type CashflowFilters,
  type CashflowIssue,
  type CashflowSummary,
  type LedgerResponse,
} from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasRole } from "@/utils/auth";
import { EXCEL_FILE_TYPE, saveBlob } from "@/utils/saveBlob";
import AccountsTable from "./AccountsTable";
import IssuesTable from "./IssuesTable";
import LedgerTable from "./LedgerTable";
import {
  formatDate,
  formatMoney,
  periodRange,
  todayVN,
  type PeriodMode,
} from "./cashflowFormat";

type Tab = "accounts" | "cash" | "bank" | "issues";

const TABS: { key: Tab; label: string }[] = [
  { key: "accounts", label: "Danh mục tài khoản" },
  { key: "cash", label: "Tiền mặt · 111" },
  { key: "bank", label: "Tiền gửi ngân hàng · 112" },
  { key: "issues", label: "Cần kiểm tra" },
];
const PAGE_SIZE = 100;
const appleField =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white/85 px-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
const appleLabel = "text-[12px] font-semibold text-slate-600";

type Draft = {
  mode: PeriodMode;
  from: string;
  to: string;
  year: number;
  month: number;
  quarter: number;
  accountType: AccountType;
  accountCode: string;
  search: string;
};

/** Bộ lọc đang áp dụng = những gì nằm trên URL. */
function readDraft(params: URLSearchParams): Draft {
  const today = todayVN();
  const [year, month] = today.split("-").map(Number);
  const mode = (params.get("mode") as PeriodMode) || "month";
  const draft: Draft = {
    mode: ["range", "month", "quarter", "year"].includes(mode) ? mode : "month",
    from: params.get("from") || `${today.slice(0, 8)}01`,
    to: params.get("to") || today,
    year: Number(params.get("y")) || year,
    month: Number(params.get("m")) || month,
    quarter: Number(params.get("q")) || Math.ceil(month / 3),
    accountType: (params.get("type") as AccountType) || "all",
    accountCode: params.get("account") || "",
    search: params.get("search") || "",
  };
  if (draft.mode !== "range") {
    const index = draft.mode === "quarter" ? draft.quarter : draft.month;
    Object.assign(draft, periodRange(draft.mode, draft.year, index));
  }
  return draft;
}

export default function CashflowReportPage() {
  const [params, setParams] = useSearchParams();
  const applied = useMemo(() => readDraft(params), [params]);
  const [draft, setDraft] = useState<Draft>(applied);
  const tab = (params.get("tab") as Tab) || "cash";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const excludeInternal = params.get("internal") === "0";
  const canManage = hasRole("ketoan_truong", "director");

  const filters: CashflowFilters = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      accountType: applied.accountType,
      accountCode: applied.accountCode || undefined,
      search: applied.search || undefined,
      excludeInternal,
    }),
    [applied, excludeInternal],
  );

  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [groups, setGroups] = useState<CashAccountGroup[]>([]);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [issues, setIssues] = useState<CashflowIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  useEffect(() => setDraft(applied), [applied]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");

    const tabRequest =
      tab === "cash" || tab === "bank"
        ? cashflowReportApi.ledger(tab, filters, page, PAGE_SIZE)
        : tab === "issues"
          ? cashflowReportApi.issues(filters)
          : Promise.resolve(null);

    Promise.all([
      cashflowReportApi.summary(filters),
      // Danh mục luôn tải cả hai nhóm để chọn "Tài khoản cụ thể".
      cashflowReportApi.accounts({ ...filters, accountType: "all", accountCode: undefined }),
      tabRequest,
    ])
      .then(([summaryData, accountData, tabData]) => {
        if (id !== requestId.current) return;
        setSummary(summaryData);
        setGroups(accountData.groups);
        if (tab === "cash" || tab === "bank") setLedger(tabData as LedgerResponse);
        if (tab === "issues") {
          setIssues((tabData as { issues: CashflowIssue[] }).issues);
        }
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(getApiErrorMessage(err, "Không tải được báo cáo"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [filters, tab, page, reloadKey]);

  const applyDraft = () => {
    if (draft.mode === "range" && draft.from > draft.to) {
      toast.error("Từ ngày phải trước hoặc bằng Đến ngày");
      return;
    }
    updateParams({
      mode: draft.mode,
      from: draft.mode === "range" ? draft.from : null,
      to: draft.mode === "range" ? draft.to : null,
      y: draft.mode === "range" ? null : String(draft.year),
      m: draft.mode === "month" ? String(draft.month) : null,
      q: draft.mode === "quarter" ? String(draft.quarter) : null,
      type: draft.accountType === "all" ? null : draft.accountType,
      account: draft.accountCode || null,
      search: draft.search.trim() || null,
      page: null,
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await cashflowReportApi.exportExcel(filters);
      const compact = (value: string) => value.replace(/-/g, "");
      await saveBlob(
        blob,
        `Tong_Hop_Thu_Chi_${compact(filters.from)}_${compact(filters.to)}.xlsx`,
        EXCEL_FILE_TYPE,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xuất được file Excel"));
    } finally {
      setExporting(false);
    }
  };

  const accountOptions = groups
    .filter(
      (group) =>
        draft.accountType === "all" ||
        (draft.accountType === "cash" ? group.groupCode === "111" : group.groupCode === "112"),
    )
    .flatMap((group) => group.accounts);
  const years = Array.from({ length: 6 }, (_, index) => Number(todayVN().slice(0, 4)) - index);
  const issueCount = (summary?.issueCount ?? 0) + (summary?.warningCount ?? 0);

  const kpis = [
    {
      label: "Tổng số dư đầu kỳ",
      value: summary?.openingTotal ?? null,
      partial: summary?.verifiedOpeningTotal,
      tone: "text-slate-900",
      icon: <WalletCards size={18} />,
      iconTone: "bg-slate-100 text-slate-700",
    },
    {
      label: "Tổng thu trong kỳ",
      value: summary?.receipts ?? "0",
      tone: "text-emerald-700",
      icon: <CircleDollarSign size={18} />,
      iconTone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Tổng chi trong kỳ",
      value: summary?.payments ?? "0",
      tone: "text-rose-700",
      icon: <ReceiptText size={18} />,
      iconTone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Tổng số dư cuối kỳ",
      value: summary?.closingTotal ?? null,
      partial: summary?.verifiedClosingTotal,
      tone: "text-indigo-700",
      icon: <Landmark size={18} />,
      iconTone: "bg-indigo-50 text-indigo-700",
    },
  ];

  return (
    <div className="relative min-h-screen space-y-4 overflow-hidden bg-[#f5f5f7] p-3 text-slate-900 md:p-5">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-72 h-80 w-80 rounded-full bg-indigo-200/25 blur-3xl" />

      <FadeContent blur trigger="mount" duration={0.5} className="relative">
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/[0.82] px-5 py-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/60 backdrop-blur-2xl sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.95)]">
              <ChartNoAxesCombined size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-2xl">
                Quản lý thu chi
              </h1>
              <p className="mt-1 max-w-5xl text-[13px] leading-5 text-slate-600 sm:text-[14px]">
                Tổng hợp từ Hóa Đơn (Khoản thu/chi), Chi Trường, Chi Ngoài (Nguồn chi),
                Đề xuất chi (xuất tiền / hoàn quỹ) và Đề nghị tài chính nội bộ. Số liệu
                và file Excel dùng chung một nguồn đã đối chiếu.
              </p>
            </div>
          </div>
        </div>
      </FadeContent>

      {/* BỘ LỌC */}
      <div className="relative space-y-4 rounded-[28px] border border-white/80 bg-white/[0.82] p-4 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/60 backdrop-blur-2xl sm:p-5">
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
          {(
            [
              ["month", "Tháng"],
              ["quarter", "Quý"],
              ["year", "Năm"],
              ["range", "Khoảng ngày"],
            ] as [PeriodMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, mode }))}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                draft.mode === mode
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {draft.mode === "range" ? (
            <>
              <label className={appleLabel}>
                Từ ngày
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                  className={appleField}
                />
              </label>
              <label className={appleLabel}>
                Đến ngày
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                  className={appleField}
                />
              </label>
            </>
          ) : (
            <>
              <label className={appleLabel}>
                Năm
                <select
                  value={draft.year}
                  onChange={(e) => setDraft((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  className={appleField}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              {draft.mode !== "year" && (
                <label className={appleLabel}>
                  {draft.mode === "month" ? "Tháng" : "Quý"}
                  <select
                    value={draft.mode === "month" ? draft.month : draft.quarter}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.mode === "month"
                          ? { ...prev, month: Number(e.target.value) }
                          : { ...prev, quarter: Number(e.target.value) },
                      )
                    }
                    className={appleField}
                  >
                    {(draft.mode === "month"
                      ? Array.from({ length: 12 }, (_, i) => i + 1)
                      : [1, 2, 3, 4]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {draft.mode === "month" ? `Tháng ${value}` : `Quý ${value}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <label className={appleLabel}>
            Loại tài khoản
            <select
              value={draft.accountType}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  accountType: e.target.value as AccountType,
                  accountCode: "",
                }))
              }
              className={appleField}
            >
              <option value="all">Tất cả</option>
              <option value="cash">Tiền mặt (111)</option>
              <option value="bank">Ngân hàng (112)</option>
            </select>
          </label>
          <label className={appleLabel}>
            Tài khoản cụ thể
            <select
              value={draft.accountCode}
              onChange={(e) => setDraft((prev) => ({ ...prev, accountCode: e.target.value }))}
              className={appleField}
            >
              <option value="">Tất cả tài khoản</option>
              {accountOptions.map((account) => (
                <option key={account.code} value={account.code}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${appleLabel} sm:col-span-2`}>
            Tìm kiếm
            <div className={`${appleField} flex items-center gap-2 py-0`}>
              <Search size={16} className="shrink-0 text-gray-400" />
              <input
                value={draft.search}
                onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && applyDraft()}
                placeholder="Số chứng từ, số HĐ, diễn giải, mã/tên đối tượng"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyDraft}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_9px_22px_-12px_rgba(37,99,235,0.95)] transition hover:bg-blue-700"
          >
            Xem báo cáo
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Xuất Excel
          </button>
          <span className="ml-auto text-[12px] font-medium text-slate-500">
            Kỳ đang xem: {formatDate(applied.from)} – {formatDate(applied.to)}
          </span>
        </div>
      </div>

      {/* TỔNG QUAN */}
      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[24px] border border-white/80 bg-white/[0.88] p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-slate-500">{kpi.label}</div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconTone}`}>{kpi.icon}</div>
            </div>
            {kpi.value === null ? (
              <>
                <div className="mt-2 text-[15px] font-semibold italic text-amber-700">Chưa xác minh</div>
                {kpi.partial && (
                  <div className="text-[11px] text-slate-500">
                    TK đã xác minh: {formatMoney(kpi.partial)}
                  </div>
                )}
              </>
            ) : (
              <div className={`mt-2 text-xl font-semibold tracking-[-0.02em] tabular-nums ${kpi.tone}`}>{formatMoney(kpi.value)}</div>
            )}
          </div>
        ))}
        <div className="rounded-[24px] border border-white/80 bg-white/[0.88] p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-semibold text-slate-500">Số chứng từ phát sinh</div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ReceiptText size={18} /></div>
          </div>
          <div className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
            {(summary?.voucherCount ?? 0).toLocaleString("vi-VN")}
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => updateParams({ internal: e.target.checked ? "0" : null })}
            />
            Loại trừ chuyển tiền nội bộ
          </label>
        </div>
      </div>

      {summary && summary.unverifiedAccounts.length > 0 && (
        <div className="relative flex items-start gap-3 rounded-[22px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[13px] leading-5 text-amber-900 shadow-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Chưa có số dư gốc đã đối chiếu cho {summary.unverifiedAccounts.length} tài khoản (
            {summary.unverifiedAccounts.join(", ")}) — số dư đầu/cuối kỳ của các tài khoản này
            chưa xác minh.{" "}
            {canManage ? "Nhập ở tab Danh mục tài khoản." : "Liên hệ kế toán trưởng để nhập."}
          </span>
        </div>
      )}

      {/* TABS */}
      <div className="relative inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-slate-200/65 p-1.5 ring-1 ring-slate-300/50 backdrop-blur-xl">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => updateParams({ tab: item.key, page: null })}
            className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
              tab === item.key
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/45 hover:text-slate-900"
            }`}
          >
            {item.label}
            {item.key === "issues" && issueCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-100 px-1.5 text-xs text-rose-700">
                {issueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="relative rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-[14px] text-rose-700 shadow-sm">
          {error}
          <div>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 rounded-lg border border-rose-300 px-3 py-1 text-xs"
            >
              Thử lại
            </button>
          </div>
        </div>
      ) : loading && !summary ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Đang tải báo cáo…
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          {tab === "accounts" && (
            <AccountsTable
              groups={groups.filter(
                (group) =>
                  applied.accountType === "all" ||
                  (applied.accountType === "cash"
                    ? group.groupCode === "111"
                    : group.groupCode === "112"),
              )}
              canManage={canManage}
              onSaved={() => setReloadKey((key) => key + 1)}
            />
          )}
          {(tab === "cash" || tab === "bank") && ledger && (
            <LedgerTable
              data={ledger}
              onPageChange={(next) => updateParams({ page: String(next) })}
            />
          )}
          {tab === "issues" && <IssuesTable issues={issues} />}
        </div>
      )}
    </div>
  );
}
