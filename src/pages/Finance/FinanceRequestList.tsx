import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  UserRoundCog,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { financeApi } from "@/service/finance";
import type { FinanceListItem, FinanceListQuery, FinanceRequestType } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { EXCEL_FILE_TYPE, saveBlob } from "@/utils/saveBlob";
import DelegationModal from "./components/DelegationModal";
import { EmptyState, ErrorState, LoadingState, StatusBadges, TypeBadge } from "./components/FinanceUi";
import { useFinanceMeta } from "./FinanceRoutes";
import {
  APPROVAL_LABELS,
  PAYMENT_LABELS,
  TYPE_LABELS,
  formatDate,
  formatMoney,
  inputClass,
  labelClass,
  openBlob,
  secondaryButton,
  todayVN,
  useFinanceBase,
} from "./lib";

type Scope = "mine" | "approvals" | "all";

const TITLES: Record<Scope, [string, string]> = {
  mine: ["Đề nghị của tôi", "Các phiếu bạn đã lập: nháp, đang duyệt, đã chi."],
  approvals: ["Chờ tôi phê duyệt", "Phiếu đang chờ bạn xử lý ở cấp duyệt hiện tại (kể cả được uỷ quyền)."],
  all: ["Tất cả đề nghị", "Toàn bộ phiếu trong phạm vi quyền của bạn."],
};

const TYPE_CHIPS: (FinanceRequestType | "")[] = [
  "",
  "ADVANCE",
  "SALARY_ADVANCE",
  "SETTLEMENT",
  "EXPENSE_PAYMENT",
];

const LIMIT = 20;

export default function FinanceRequestList({ scope }: { scope: Scope }) {
  const meta = useFinanceMeta();
  const base = useFinanceBase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters: FinanceListQuery = useMemo(
    () => ({
      scope,
      type: (params.get("type") as FinanceRequestType) || "",
      companyId: params.get("companyId") ? Number(params.get("companyId")) : "",
      departmentId: params.get("departmentId") ? Number(params.get("departmentId")) : "",
      approvalStatus: params.get("approvalStatus") || "",
      paymentStatus: params.get("paymentStatus") || "",
      dateFrom: params.get("dateFrom") || "",
      dateTo: params.get("dateTo") || "",
      amountMin: params.get("amountMin") ? Number(params.get("amountMin")) : "",
      amountMax: params.get("amountMax") ? Number(params.get("amountMax")) : "",
      code: params.get("code") || "",
      q: params.get("q") || "",
      overdue: (params.get("overdue") as "true" | "") || "",
      sort: (params.get("sort") as FinanceListQuery["sort"]) || "createdAt",
      order: (params.get("order") as "ASC" | "DESC") || "DESC",
      page: Number(params.get("page") || 1),
      limit: LIMIT,
    }),
    [params, scope],
  );

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const listQuery = useQuery({
    queryKey: ["finance-list", filters],
    queryFn: () => financeApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance-list"] });

  const toggleSort = (sort: NonNullable<FinanceListQuery["sort"]>) => {
    const next = new URLSearchParams(params);
    const sameColumn = (params.get("sort") || "createdAt") === sort;
    next.set("sort", sort);
    next.set("order", sameColumn && filters.order === "DESC" ? "ASC" : "DESC");
    setParams(next, { replace: true });
  };

  const run = async (item: FinanceListItem, action: () => Promise<unknown>, success: string) => {
    setBusyId(item.id);
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Thao tác không thành công."));
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (item: FinanceListItem) => {
    setBusyId(item.id);
    try {
      openBlob(await financeApi.pdf(item.id), `${item.code}.pdf`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tạo được PDF."));
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (item: FinanceListItem) => {
    setBusyId(item.id);
    try {
      const created = await financeApi.copy(item.id);
      toast.success(`Đã tạo bản sao ${created.code}`);
      navigate(`${base}/requests/${created.id}/edit`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không sao chép được."));
    } finally {
      setBusyId(null);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await financeApi.exportExcel({ ...filters, page: undefined, limit: undefined });
      await saveBlob(blob, `de-nghi-tai-chinh-${todayVN()}.xlsx`, EXCEL_FILE_TYPE);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xuất được Excel."));
    } finally {
      setExporting(false);
    }
  };

  const data = listQuery.data;
  const [title, subtitle] = TITLES[scope];

  const actions = (item: FinanceListItem) => {
    const editable = item.isOwner && ["DRAFT", "RETURNED"].includes(item.approvalStatus);
    const busy = busyId === item.id;
    const list: { key: string; label: string; icon: ReactNode; onClick: () => void; danger?: boolean; primary?: boolean }[] = [];
    if (item.canAct)
      list.push({
        key: "act",
        label: "Duyệt / Từ chối",
        icon: <ShieldCheck size={15} />,
        primary: true,
        onClick: () => navigate(`${base}/requests/${item.id}?act=1`),
      });
    list.push({ key: "view", label: "Xem chi tiết", icon: <Eye size={15} />, onClick: () => navigate(`${base}/requests/${item.id}`) });
    if (editable)
      list.push({ key: "edit", label: "Chỉnh sửa", icon: <Pencil size={15} />, onClick: () => navigate(`${base}/requests/${item.id}/edit`) });
    if (editable)
      list.push({
        key: "submit",
        label: "Gửi duyệt",
        icon: <Send size={15} />,
        onClick: () => void run(item, () => financeApi.submit(item.id), `Đã gửi duyệt ${item.code}`),
      });
    if (item.isOwner && item.approvalStatus === "PENDING")
      list.push({
        key: "withdraw",
        label: "Thu hồi",
        icon: <Undo2 size={15} />,
        onClick: () => {
          if (window.confirm(`Thu hồi ${item.code} về bản nháp?`))
            void run(item, () => financeApi.withdraw(item.id), `Đã thu hồi ${item.code}`);
        },
      });
    list.push({ key: "pdf", label: "In / tải PDF", icon: <Download size={15} />, onClick: () => void downloadPdf(item) });
    list.push({ key: "copy", label: "Sao chép tạo phiếu mới", icon: <Copy size={15} />, onClick: () => void copy(item) });
    list.push({
      key: "history",
      label: "Xem lịch sử",
      icon: <History size={15} />,
      onClick: () => navigate(`${base}/requests/${item.id}?tab=history`),
    });
    if (item.isOwner && item.approvalStatus === "DRAFT")
      list.push({
        key: "delete",
        label: "Xoá bản nháp",
        icon: <Trash2 size={15} />,
        danger: true,
        onClick: () => {
          if (window.confirm(`Xoá bản nháp ${item.code}?`))
            void run(item, () => financeApi.remove(item.id), `Đã xoá ${item.code}`);
        },
      });
    return { list, busy };
  };

  const SortHeader = ({ sort, children, right = false }: { sort: NonNullable<FinanceListQuery["sort"]>; children: string; right?: boolean }) => (
    <button
      type="button"
      onClick={() => toggleSort(sort)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.06em] ${right ? "justify-end" : ""} ${
        filters.sort === sort ? "text-blue-700" : ""
      }`}
    >
      {children} <ArrowDownUp size={12} />
    </button>
  );

  return (
    <div className="space-y-4">
      <section className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {scope === "approvals" && (
            <button type="button" onClick={() => setDelegationOpen(true)} className={secondaryButton}>
              <UserRoundCog size={16} /> Uỷ quyền duyệt
            </button>
          )}
          {scope !== "approvals" && (
            <button type="button" onClick={() => void exportExcel()} disabled={exporting} className={secondaryButton}>
              <FileSpreadsheet size={16} /> {exporting ? "Đang xuất…" : "Xuất Excel"}
            </button>
          )}
        </div>
      </section>

      {scope !== "approvals" && (
        <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-2">
            {TYPE_CHIPS.map((type) => (
              <button
                key={type || "all"}
                type="button"
                onClick={() => setFilter("type", type)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  filters.type === type
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {type ? TYPE_LABELS[type] : "Tất cả loại"}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Tìm kiếm
          <input
            className={inputClass}
            defaultValue={filters.q}
            placeholder="Mã phiếu, nội dung, người đề nghị…"
            onKeyDown={(event) => event.key === "Enter" && setFilter("q", (event.target as HTMLInputElement).value.trim())}
            onBlur={(event) => event.target.value.trim() !== filters.q && setFilter("q", event.target.value.trim())}
          />
        </label>
        <label className={labelClass}>
          Từ ngày
          <input type="date" className={inputClass} value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
        </label>
        <label className={labelClass}>
          Đến ngày
          <input type="date" className={inputClass} value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
        </label>
        <label className={labelClass}>
          Công ty
          <select className={inputClass} value={String(filters.companyId)} onChange={(e) => setFilter("companyId", e.target.value)}>
            <option value="">Tất cả công ty</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
        {scope === "all" && (
          <label className={labelClass}>
            Phòng ban
            <select className={inputClass} value={String(filters.departmentId)} onChange={(e) => setFilter("departmentId", e.target.value)}>
              <option value="">Tất cả phòng ban</option>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === "approvals" && (
          <label className={labelClass}>
            Loại đề nghị
            <select className={inputClass} value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="">Tất cả loại</option>
              {(Object.keys(TYPE_LABELS) as FinanceRequestType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope !== "approvals" && (
          <label className={labelClass}>
            Trạng thái duyệt
            <select className={inputClass} value={filters.approvalStatus} onChange={(e) => setFilter("approvalStatus", e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(APPROVAL_LABELS).map(([value, [label]]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope !== "approvals" && (
          <label className={labelClass}>
            Trạng thái chi tiền
            <select className={inputClass} value={filters.paymentStatus} onChange={(e) => setFilter("paymentStatus", e.target.value)}>
              <option value="">Tất cả</option>
              {Object.entries(PAYMENT_LABELS)
                .filter(([value]) => value !== "NONE")
                .map(([value, [label]]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>
            Từ (đ)
            <input
              type="number"
              min={0}
              className={inputClass}
              defaultValue={filters.amountMin}
              onBlur={(e) => setFilter("amountMin", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Đến (đ)
            <input
              type="number"
              min={0}
              className={inputClass}
              defaultValue={filters.amountMax}
              onBlur={(e) => setFilter("amountMax", e.target.value)}
            />
          </label>
        </div>
        {scope !== "approvals" && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={filters.overdue === "true"}
              onChange={(e) => setFilter("overdue", e.target.checked ? "true" : "")}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            Chỉ tạm ứng quá hạn hoàn ứng
          </label>
        )}
      </section>

      {listQuery.isError && (
        <ErrorState message={getApiErrorMessage(listQuery.error, "Không tải được danh sách.")} onRetry={() => void listQuery.refetch()} />
      )}
      {listQuery.isLoading && <LoadingState text="Đang tải danh sách…" />}
      {data && data.data.length === 0 && (
        <EmptyState
          title={scope === "approvals" ? "Không có phiếu nào chờ bạn duyệt" : "Chưa có đề nghị"}
          hint="Không có dữ liệu phù hợp với bộ lọc hiện tại."
        />
      )}

      {data && data.data.length > 0 && (
        <>
          <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 text-sm">
              <span className="text-slate-500">
                {data.meta.total} phiếu {listQuery.isFetching && "· đang cập nhật…"}
              </span>
              <span className="text-slate-500">
                Tổng đề nghị <b className="tabular-nums text-blue-700">{formatMoney(data.totals.totalAmount)} đ</b> · Đã chi{" "}
                <b className="tabular-nums text-emerald-700">{formatMoney(data.totals.paidAmount)} đ</b>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-slate-50/90 text-left text-[11px] text-slate-500">
                  <tr>
                    <th className="px-5 py-3"><SortHeader sort="code">Mã phiếu</SortHeader></th>
                    <th className="px-3 py-3"><SortHeader sort="requestDate">Ngày</SortHeader></th>
                    <th className="px-3 py-3 font-semibold uppercase tracking-[0.06em]">Người đề nghị</th>
                    <th className="px-3 py-3 font-semibold uppercase tracking-[0.06em]">Loại</th>
                    <th className="px-3 py-3 text-right"><SortHeader sort="totalAmount" right>Số tiền</SortHeader></th>
                    <th className="px-3 py-3 font-semibold uppercase tracking-[0.06em]">Trạng thái</th>
                    <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.06em]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((item) => {
                    const { list, busy } = actions(item);
                    return (
                      <tr key={item.id} className="align-top hover:bg-slate-50/80">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => navigate(`${base}/requests/${item.id}`)}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {item.code}
                          </button>
                          <p className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500" title={item.title}>
                            {item.title}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">{formatDate(item.requestDate)}</td>
                        <td className="px-3 py-3.5">
                          <p className="font-semibold text-slate-800">{item.requesterName}</p>
                          <p className="text-xs text-slate-500">
                            {[item.departmentName, item.companyName].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-3 py-3.5"><TypeBadge type={item.type} /></td>
                        <td className="px-3 py-3.5 text-right">
                          <p className="font-bold tabular-nums text-slate-900">{formatMoney(item.approvedAmount ?? item.totalAmount)}</p>
                          {item.payableRemaining > 0 && (
                            <p className="text-[11px] text-amber-600">Còn chi {formatMoney(item.payableRemaining)}</p>
                          )}
                          {item.receivableRemaining > 0 && (
                            <p className="text-[11px] text-violet-600">Còn thu {formatMoney(item.receivableRemaining)}</p>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusBadges item={item} />
                          {item.currentStepName && item.approvalStatus === "PENDING" && (
                            <p className="mt-1 text-[11px] text-slate-500">Đang ở: {item.currentStepName}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap justify-end gap-1">
                            {list.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                title={action.label}
                                aria-label={action.label}
                                disabled={busy}
                                onClick={action.onClick}
                                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition disabled:opacity-50 ${
                                  action.primary
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : action.danger
                                      ? "text-rose-600 hover:bg-rose-50"
                                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                              >
                                {action.icon}
                                {action.primary && <span>Duyệt</span>}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 md:hidden">
            {data.data.map((item) => {
              const { list, busy } = actions(item);
              return (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => navigate(`${base}/requests/${item.id}`)} className="text-left">
                        <p className="font-bold text-blue-700">{item.code}</p>
                        <p className="text-sm text-slate-700">{item.title}</p>
                      </button>
                      <TypeBadge type={item.type} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.requesterName} · {formatDate(item.requestDate)}
                    </p>
                    <p className="text-lg font-extrabold tabular-nums text-slate-900">
                      {formatMoney(item.approvedAmount ?? item.totalAmount)} đ
                    </p>
                    <StatusBadges item={item} compact />
                    <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                      {list.slice(0, 5).map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          disabled={busy}
                          onClick={action.onClick}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            action.primary ? "bg-blue-600 text-white" : action.danger ? "text-rose-600" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {action.icon} {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilter("page", String((filters.page ?? 1) - 1))}
                className={secondaryButton}
              >
                <ChevronLeft size={16} /> Trước
              </button>
              <span className="text-slate-600">
                Trang {data.meta.page}/{data.meta.totalPages}
              </span>
              <button
                type="button"
                disabled={(filters.page ?? 1) >= data.meta.totalPages}
                onClick={() => setFilter("page", String((filters.page ?? 1) + 1))}
                className={secondaryButton}
              >
                Sau <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {delegationOpen && <DelegationModal onClose={() => setDelegationOpen(false)} />}
    </div>
  );
}
