import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Plus, Search } from "lucide-react";

import { Badge, EmptyState, ErrorState, LoadingState } from "@/pages/Finance/components/FinanceUi";
import { formatDate, formatMoney, inputClass, secondaryButton } from "@/pages/Finance/lib";
import { otherCashflowApi, type OtherCashflowListQuery } from "@/service/otherCashflow";
import type {
  CashflowDirection,
  OtherCashflowContract,
  OtherCashflowListResponse,
  OtherCashflowStatus,
} from "@/types/otherCashflow";
import { getApiErrorMessage } from "@/utils/apiError";
import OtherCashflowDetailModal from "./components/OtherCashflowDetailModal";
import OtherCashflowForm from "./components/OtherCashflowForm";
import { DIRECTION_LABELS, DIRECTION_TONES, STATUS_FILTERS, STATUS_LABELS, verbOf } from "./lib";

const LIMIT = 20;

function ContractCard({ item, onOpen }: { item: OtherCashflowContract; onOpen: () => void }) {
  const [statusLabel, statusTone] = STATUS_LABELS[item.status];
  const progress = Math.min(100, Math.round((item.recordedAmount / item.amount) * 100));
  const showProgress = ["APPROVED", "IN_PROGRESS", "COMPLETED"].includes(item.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              item.direction === "IN" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            {item.direction === "IN" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </span>
          <span className="text-xs font-bold text-slate-400">{item.code}</span>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 font-bold text-slate-900">{item.title}</p>
      <p className="mt-0.5 truncate text-sm text-slate-500">
        {item.partnerName}
        {item.school ? ` · ${item.school.name}` : ""}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="flex flex-wrap gap-1">
            <Badge tone={DIRECTION_TONES[item.direction]}>{DIRECTION_LABELS[item.direction]}</Badge>
            {item.form === "COMMERCIAL" && <Badge tone="sky">Thương mại</Badge>}
          </div>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{formatMoney(item.amount)} đ</p>
        </div>
        {item.expectedDate && (
          <p className="text-right text-[11px] text-slate-400">
            Dự kiến {verbOf(item.direction)}
            <br />
            <span className="font-semibold text-slate-600">{formatDate(item.expectedDate)}</span>
          </p>
        )}
      </div>
      {showProgress && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${item.direction === "IN" ? "bg-emerald-500" : "bg-rose-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Đã {verbOf(item.direction)} {formatMoney(item.recordedAmount)} đ · còn {formatMoney(item.remainingAmount)} đ
            {item.costAmount > 0 && ` · chi phí đã chi ${formatMoney(item.paidCostAmount)}/${formatMoney(item.costAmount)} đ`}
          </p>
        </div>
      )}
      <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        {item.createdByName} · {formatDate(item.submittedAt)}
      </p>
    </button>
  );
}

/**
 * Danh sách hợp đồng Thu Chi ngoài — dùng chung cho tab trong màn Chính sách
 * (NV kinh doanh, giám đốc) và trang riêng của thủ quỹ. Nút/ thao tác hiện
 * theo quyền backend trả về; `?contract=<id>` mở thẳng một hợp đồng (từ
 * thông báo, báo cáo thu chi).
 */
export default function OtherCashflowPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OtherCashflowStatus | "">("");
  const [direction, setDirection] = useState<CashflowDirection | "">("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OtherCashflowListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get("contract"));
    if (id > 0) setOpenId(id);
  }, [location.search]);

  const load = useCallback(async () => {
    const query: OtherCashflowListQuery = { status, direction, search, page, limit: LIMIT };
    setError("");
    try {
      setData(await otherCashflowApi.list(query));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được danh sách Thu Chi ngoài"));
    } finally {
      setLoading(false);
    }
  }, [status, direction, search, page]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const closeDetail = () => {
    setOpenId(null);
    const params = new URLSearchParams(location.search);
    if (params.has("contract")) {
      params.delete("contract");
      const rest = params.toString();
      navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "" }, { replace: true, state: location.state });
    }
  };

  const meta = data?.meta;
  const counts = data?.counts;
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  const hint = meta?.canManageDebt && meta?.canRecord
    ? "Đơn thương mại đã duyệt chờ lập phiếu thu / lệnh chi; hợp đồng đã duyệt chờ thu/chi."
    : meta?.canManageDebt
    ? "Đơn thương mại đã được giám đốc duyệt chờ bạn lập phiếu thu / lệnh chi."
    : meta?.canRecord
    ? "Hợp đồng đã duyệt chờ bạn ghi nhận thu/chi, phiếu thu / lệnh chi chờ bạn thực hiện."
    : meta?.canApprove
    ? "Hợp đồng do nhân viên kinh doanh gửi, chờ bạn duyệt."
    : meta?.canCreate
    ? "Lập hợp đồng thu/chi khác ngoài chính sách trường — giám đốc duyệt, thủ quỹ ghi nhận."
    : "Hợp đồng thu/chi khác: NV kinh doanh lập, giám đốc duyệt, thủ quỹ ghi nhận.";

  return (
    <div className="space-y-4">
      <section className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Thu Chi ngoài</h2>
          <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
        </div>
        {meta?.canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={18} /> Lập hợp đồng
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="-mx-3 overflow-x-auto px-3">
          <div className="flex min-w-max gap-1.5">
            {[{ key: "" as const, label: "Tất cả", count: total }, ...STATUS_FILTERS.map((key) => ({ key, label: STATUS_LABELS[key][0], count: counts?.[key] ?? 0 }))].map(
              (chip) => (
                <button
                  key={chip.key || "all"}
                  type="button"
                  onClick={() => {
                    setStatus(chip.key);
                    setPage(1);
                  }}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    status === chip.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {chip.label}
                  {counts ? <span className="ml-1 opacity-75">({chip.count})</span> : null}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} !pl-9`}
              placeholder="Tìm tên hợp đồng, đối tác, số đơn, trường, người lập, mã TCN…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </label>
          <select
            className={inputClass}
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as CashflowDirection | "");
              setPage(1);
            }}
          >
            <option value="">Thu và Chi</option>
            <option value="IN">Chỉ Thu</option>
            <option value="OUT">Chỉ Chi</option>
          </select>
        </div>
      </section>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data?.data.length ? (
        <EmptyState
          title="Chưa có hợp đồng nào"
          hint={meta?.canCreate ? "Bấm “Lập hợp đồng” để gửi giám đốc duyệt." : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((item) => (
              <ContractCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button type="button" className={secondaryButton} disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                Trước
              </button>
              <span className="text-slate-500">
                Trang {page}/{pages}
              </span>
              <button type="button" className={secondaryButton} disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
                Sau
              </button>
            </div>
          )}
        </>
      )}

      <OtherCashflowForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(detail) => {
          setCreating(false);
          void load();
          setOpenId(detail.id);
        }}
      />
      <OtherCashflowDetailModal contractId={openId} onClose={closeDetail} onChanged={load} />
    </div>
  );
}
