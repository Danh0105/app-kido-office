import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AlertTriangle, Download, Loader2, RefreshCw, Search } from "lucide-react";
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
  { key: "accounts", label: "Danh mục các TK" },
  { key: "cash", label: "Tiền mặt (TK 111)" },
  { key: "bank", label: "Tiền gửi ngân hàng (TK 112)" },
  { key: "issues", label: "Chưa phân loại" },
];
const PAGE_SIZE = 100;

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
    },
    { label: "Tổng thu trong kỳ", value: summary?.receipts ?? "0", tone: "text-emerald-700" },
    { label: "Tổng chi trong kỳ", value: summary?.payments ?? "0", tone: "text-rose-700" },
    {
      label: "Tổng số dư cuối kỳ",
      value: summary?.closingTotal ?? null,
      partial: summary?.verifiedClosingTotal,
      tone: "text-indigo-700",
    },
  ];

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">Báo cáo tổng hợp thu chi</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          Tổng hợp từ Hóa Đơn (Khoản thu/chi), Chi Trường, Chi Ngoài (Nguồn chi), Đề xuất chi
          (xuất tiền / hoàn quỹ) và Đề nghị tài chính nội bộ (chi tiền / thu hồi). Số liệu do hệ thống tính; giao diện và file Excel dùng chung một
          nguồn.
        </p>
      </div>

      {/* BỘ LỌC */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
        <div className="flex flex-wrap gap-1">
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
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                draft.mode === mode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {draft.mode === "range" ? (
            <>
              <label className="text-xs text-slate-600">
                Từ ngày
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                Đến ngày
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                />
              </label>
            </>
          ) : (
            <>
              <label className="text-xs text-slate-600">
                Năm
                <select
                  value={draft.year}
                  onChange={(e) => setDraft((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              {draft.mode !== "year" && (
                <label className="text-xs text-slate-600">
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
                    className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
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
          <label className="text-xs text-slate-600">
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
              className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="cash">Tiền mặt (111)</option>
              <option value="bank">Ngân hàng (112)</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Tài khoản cụ thể
            <select
              value={draft.accountCode}
              onChange={(e) => setDraft((prev) => ({ ...prev, accountCode: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
            >
              <option value="">Tất cả tài khoản</option>
              {accountOptions.map((account) => (
                <option key={account.code} value={account.code}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 sm:col-span-2">
            Tìm kiếm
            <div className="mt-1 flex h-10 items-center gap-2 rounded-lg border px-2">
              <Search size={16} className="shrink-0 text-gray-400" />
              <input
                value={draft.search}
                onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && applyDraft()}
                placeholder="Số chứng từ, số HĐ, diễn giải, mã/tên đối tượng"
                className="min-w-0 flex-1 text-sm outline-none"
              />
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyDraft}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Xem báo cáo
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Xuất Excel
          </button>
          <span className="text-xs text-slate-500">
            Kỳ đang xem: {formatDate(applied.from)} – {formatDate(applied.to)}
          </span>
        </div>
      </div>

      {/* TỔNG QUAN */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <div className="text-xs text-slate-500">{kpi.label}</div>
            {kpi.value === null ? (
              <>
                <div className="text-sm font-semibold italic text-amber-700">Chưa xác minh</div>
                {kpi.partial && (
                  <div className="text-[11px] text-slate-500">
                    TK đã xác minh: {formatMoney(kpi.partial)}
                  </div>
                )}
              </>
            ) : (
              <div className={`text-lg font-bold tabular-nums ${kpi.tone}`}>{formatMoney(kpi.value)}</div>
            )}
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-500">Số chứng từ phát sinh</div>
          <div className="text-lg font-bold text-slate-900">
            {(summary?.voucherCount ?? 0).toLocaleString("vi-VN")}
          </div>
          <label className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
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
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Chưa có số dư gốc đã đối chiếu cho {summary.unverifiedAccounts.length} tài khoản (
            {summary.unverifiedAccounts.join(", ")}) — số dư đầu/cuối kỳ của các tài khoản này
            chưa xác minh.{" "}
            {canManage ? "Nhập ở tab Danh mục các TK." : "Liên hệ kế toán trưởng để nhập."}
          </span>
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => updateParams({ tab: item.key, page: null })}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${
              tab === item.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
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
