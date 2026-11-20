import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, HandCoins, Loader2, Wallet } from "lucide-react";
import { toast } from "react-hot-toast";

import { financeApi } from "@/service/finance";
import type { FinanceDeductionRow, FinanceDetail, FinanceListItem } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { DeductionModal, MoneyModal } from "./components/DetailModals";
import { Badge, Card, EmptyState, ErrorState, LoadingState, StatusBadges, TypeBadge } from "./components/FinanceUi";
import { useFinanceMeta } from "./FinanceRoutes";
import { formatDate, formatMoney, inputClass, labelClass, primaryButton, secondaryButton, todayVN, useFinanceBase } from "./lib";

/** `detail` (chỉ khi chi tiền): người nhận + tài khoản gợi ý, giống màn chi tiết phiếu. */
type MoneyTarget = { item: FinanceListItem; kind: "payment" | "refund"; detail?: FinanceDetail };

export default function FinancePayments() {
  const meta = useFinanceMeta();
  const base = useFinanceBase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const caps = meta.capabilities;
  const [companyId, setCompanyId] = useState("");
  const [moneyTarget, setMoneyTarget] = useState<MoneyTarget | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [deduction, setDeduction] = useState<FinanceDeductionRow | null>(null);
  const [year, setYear] = useState(Number(todayVN().slice(0, 4)));
  const [month, setMonth] = useState(Number(todayVN().slice(5, 7)));
  const [deductionStatus, setDeductionStatus] = useState("PLANNED");

  const queue = useQuery({
    queryKey: ["finance-list", "payments", companyId],
    queryFn: () => financeApi.list({ scope: "payments", companyId: companyId ? Number(companyId) : "", limit: 200, sort: "requestDate", order: "ASC" }),
    enabled: caps.canManagePayments,
  });
  const deductions = useQuery({
    queryKey: ["finance-deductions", companyId, year, month, deductionStatus],
    queryFn: () => financeApi.deductions({ companyId: companyId ? Number(companyId) : "", year, month, status: deductionStatus }),
    enabled: caps.canConfirmDeductions,
  });

  const payable = (queue.data?.data ?? []).filter((r) => r.payableRemaining > 0);
  const receivable = (queue.data?.data ?? []).filter((r) => r.receivableRemaining > 0);

  /**
   * Chi tiền: tải chi tiết phiếu trước — phiếu chuyển cho nhà cung cấp cần ô
   * "Chuyển cho" (không chọn thì backend hiểu là chi cho người đề nghị).
   */
  const openMoney = async (item: FinanceListItem, kind: MoneyTarget["kind"]) => {
    if (kind !== "payment") {
      setMoneyTarget({ item, kind });
      return;
    }
    setOpeningId(item.id);
    try {
      setMoneyTarget({ item, kind, detail: await financeApi.get(item.id) });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải được phiếu."));
    } finally {
      setOpeningId(null);
    }
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["finance-list"] });
    await queryClient.invalidateQueries({ queryKey: ["finance-deductions"] });
  };

  const QueueTable = ({ rows, kind }: { rows: FinanceListItem[]; kind: "payment" | "refund" }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Mã phiếu</th>
            <th className="px-3 py-2">Người đề nghị</th>
            <th className="px-3 py-2">Loại</th>
            <th className="px-3 py-2">Ngày</th>
            <th className="px-3 py-2 text-right">Được duyệt</th>
            <th className="px-3 py-2 text-right">{kind === "payment" ? "Đã chi" : "Đã thu"}</th>
            <th className="px-3 py-2 text-right">{kind === "payment" ? "Còn phải chi" : "Còn phải thu"}</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2">
                <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => navigate(`${base}/requests/${item.id}?tab=payments`)}>
                  {item.code}
                </button>
                <p className="max-w-[220px] truncate text-xs text-slate-500">{item.title}</p>
              </td>
              <td className="px-3 py-2">
                {item.requesterName}
                <p className="text-xs text-slate-500">{item.companyName}</p>
              </td>
              <td className="px-3 py-2"><TypeBadge type={item.type} /></td>
              <td className="px-3 py-2">{formatDate(item.requestDate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.approvedAmount ?? item.totalAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(kind === "payment" ? item.paidAmount : item.recoveredAmount)}</td>
              <td className={`px-3 py-2 text-right font-bold tabular-nums ${kind === "payment" ? "text-amber-700" : "text-violet-700"}`}>
                {formatMoney(kind === "payment" ? item.payableRemaining : item.receivableRemaining)}
              </td>
              <td className="px-3 py-2"><StatusBadges item={item} /></td>
              <td className="px-3 py-2 text-right">
                {!item.isOwner && (
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={openingId !== null}
                    onClick={() => void openMoney(item, kind)}
                  >
                    {openingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}{" "}
                    {kind === "payment" ? "Ghi nhận chi" : "Ghi nhận thu"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className={labelClass}>
          Công ty
          <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Tất cả</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-xs text-slate-500">Chỉ chứng từ đã duyệt còn khoản phải chi/thu, trong phạm vi được phân quyền.</p>
      </section>

      {caps.canManagePayments && (
        <>
          {queue.isError && <ErrorState message={getApiErrorMessage(queue.error, "Không tải được hàng chờ.")} onRetry={() => void queue.refetch()} />}
          {queue.isLoading && <LoadingState />}
          {queue.data && (
            <>
              <Card title={`Chờ chi tiền (${payable.length})`} icon={<HandCoins size={16} />}>
                {payable.length ? <QueueTable rows={payable} kind="payment" /> : <p className="text-sm text-slate-400">Không có khoản nào chờ chi.</p>}
              </Card>
              <Card title={`Chờ nhân viên hoàn trả (${receivable.length})`} icon={<Wallet size={16} />}>
                {receivable.length ? <QueueTable rows={receivable} kind="refund" /> : <p className="text-sm text-slate-400">Không có khoản nào chờ thu hồi.</p>}
              </Card>
            </>
          )}
        </>
      )}

      {caps.canConfirmDeductions && (
        <Card
          title="Khấu trừ tạm ứng lương theo kỳ"
          icon={<CalendarClock size={16} />}
          action={
            <div className="flex flex-wrap gap-2">
              <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <input type="number" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={deductionStatus} onChange={(e) => setDeductionStatus(e.target.value)}>
                <option value="PLANNED">Chờ khấu trừ</option>
                <option value="DEDUCTED">Đã khấu trừ</option>
                <option value="">Tất cả</option>
              </select>
            </div>
          }
        >
          {deductions.isLoading && <LoadingState />}
          {deductions.data && deductions.data.length === 0 && (
            <EmptyState title="Không có khoản khấu trừ" hint="Kỳ này chưa có tạm ứng lương cần khấu trừ." />
          )}
          {deductions.data && deductions.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2">Phiếu</th>
                    <th className="px-3 py-2">Kỳ</th>
                    <th className="px-3 py-2 text-right">Kế hoạch</th>
                    <th className="px-3 py-2 text-right">Đã trừ</th>
                    <th className="px-3 py-2">Phiếu lương</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deductions.data.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        {row.employeeName}
                        <p className="text-xs text-slate-500">{row.departmentName}</p>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => navigate(`${base}/requests/${row.requestId}`)}>
                          {row.requestCode}
                        </button>
                      </td>
                      <td className="px-3 py-2">{row.periodMonth}/{row.periodYear}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.plannedAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.deductedAmount !== null ? formatMoney(row.deductedAmount) : "—"}</td>
                      <td className="px-3 py-2 text-xs">{row.payrollId ? `#${row.payrollId}` : row.status === "DEDUCTED" ? "Chưa có phiếu lương" : "—"}</td>
                      <td className="px-3 py-2">
                        <Badge tone={row.status === "DEDUCTED" ? "emerald" : "amber"}>{row.status === "DEDUCTED" ? "Đã khấu trừ" : "Chờ khấu trừ"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.canConfirm && (
                          <button type="button" className={secondaryButton} onClick={() => setDeduction(row)}>
                            Ghi nhận đã trừ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Đối chiếu với cột "Tạm ứng" trên phiếu lương cùng kỳ. Mỗi kỳ của một khoản ứng chỉ ghi nhận được một lần.
          </p>
        </Card>
      )}

      {moneyTarget && (
        <MoneyModal
          kind={moneyTarget.kind}
          remaining={
            moneyTarget.kind === "payment"
              ? (moneyTarget.detail?.summary.payableRemaining ?? moneyTarget.item.payableRemaining)
              : moneyTarget.item.receivableRemaining
          }
          defaultMethod={moneyTarget.detail?.paymentMethod}
          defaultCashAccountCode={moneyTarget.detail?.paymentAccountCode}
          recipients={(moneyTarget.detail?.suppliers?.length ?? 0) > 0 ? moneyTarget.detail?.recipients : undefined}
          transfer={
            moneyTarget.detail?.type === "INTERNAL_TRANSFER"
              ? { from: moneyTarget.detail.transferFromAccountCode ?? null, to: moneyTarget.detail.transferToAccountCode ?? null }
              : null
          }
          onClose={() => setMoneyTarget(null)}
          onSubmit={async ({ payload, proofs }) => {
            try {
              const movement =
                moneyTarget.kind === "payment"
                  ? await financeApi.recordPayment(moneyTarget.item.id, payload)
                  : await financeApi.recordRefund(moneyTarget.item.id, payload);
              if (proofs.length) {
                await financeApi.uploadAttachments(moneyTarget.item.id, proofs, {
                  kind: moneyTarget.kind === "payment" ? "PAYMENT_PROOF" : "REFUND_PROOF",
                  ...(moneyTarget.kind === "payment" ? { paymentId: movement.id } : { refundId: movement.id }),
                });
              }
              toast.success("Đã ghi nhận");
              setMoneyTarget(null);
              await refresh();
            } catch (error) {
              toast.error(getApiErrorMessage(error, "Không ghi nhận được."));
            }
          }}
        />
      )}
      {deduction && (
        <DeductionModal
          row={deduction}
          outstanding={deduction.plannedAmount}
          onClose={() => setDeduction(null)}
          onSubmit={async (value) => {
            try {
              await financeApi.confirmDeduction(deduction.requestId, deduction.id, value);
              toast.success("Đã ghi nhận khấu trừ");
              setDeduction(null);
              await refresh();
            } catch (error) {
              toast.error(getApiErrorMessage(error, "Không ghi nhận được."));
            }
          }}
        />
      )}
    </div>
  );
}
