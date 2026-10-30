import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Download,
  FileText,
  History,
  Paperclip,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  SkipForward,
  Trash2,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { financeApi } from "@/service/finance";
import type { FinanceDetail, FinanceMovement } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import AttachmentGrid from "./components/AttachmentGrid";
import { ApproveModal, DeductionModal, MoneyModal, ReasonModal } from "./components/DetailModals";
import {
  Badge,
  Card,
  ErrorState,
  InfoRow,
  LoadingState,
  StatusBadges,
  TypeBadge,
  Warnings,
} from "./components/FinanceUi";
import {
  AUDIT_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
  SETTLEMENT_LABELS,
  STEP_LABELS,
  APPROVAL_LABELS,
  dangerButton,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  openBlob,
  primaryButton,
  secondaryButton,
  useFinanceBase,
} from "./lib";

type Tab = "info" | "attachments" | "workflow" | "payments" | "history";

type Dialog =
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "return" }
  | { kind: "withdraw" }
  | { kind: "cancel" }
  | { kind: "skip" }
  | { kind: "payment" }
  | { kind: "refund" }
  | { kind: "void-payment"; movement: FinanceMovement }
  | { kind: "void-refund"; movement: FinanceMovement }
  | { kind: "deduction"; deductionId: number };

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: "info", label: "Thông tin đề nghị", icon: <ClipboardList size={15} /> },
  { key: "attachments", label: "Chứng từ đính kèm", icon: <Paperclip size={15} /> },
  { key: "workflow", label: "Quy trình phê duyệt", icon: <CheckCircle2 size={15} /> },
  { key: "payments", label: "Thanh toán", icon: <CircleDollarSign size={15} /> },
  { key: "history", label: "Lịch sử", icon: <History size={15} /> },
];

export default function FinanceRequestDetail() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const base = useFinanceBase();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [detail, setDetail] = useState<FinanceDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const tab = (params.get("tab") as Tab) || "info";

  const load = useCallback(async () => {
    setError("");
    try {
      setDetail(await financeApi.get(requestId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được chứng từ."));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Mở từ danh sách bằng nút "Duyệt": nếu có chứng từ thì đưa người duyệt
  // tới chứng từ trước; nếu không có mới bật thẳng hộp duyệt.
  useEffect(() => {
    if (detail && params.get("act") === "1" && detail.permissions.canApprove) {
      const next = new URLSearchParams(params);
      next.delete("act");
      if (detail.attachments.length > 0) next.set("tab", "attachments");
      else setDialog({ kind: "approve" });
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", next);
    setParams(nextParams, { replace: true });
  };

  const after = async (message: string, next?: FinanceDetail) => {
    toast.success(message);
    setDialog(null);
    if (next && "permissions" in next) setDetail(next);
    else await load();
    await queryClient.invalidateQueries({ queryKey: ["finance-list"] });
  };

  const act = async (action: () => Promise<FinanceDetail | unknown>, message: string) => {
    setBusy(true);
    try {
      const result = await action();
      await after(message, result as FinanceDetail);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Thao tác không thành công."));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const safe = (fn: () => Promise<unknown>) => fn().catch(() => undefined);

  const pdf = async (disposition: "inline" | "attachment") => {
    setBusy(true);
    try {
      openBlob(await financeApi.pdf(requestId, disposition), `${detail?.code}.pdf`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tạo được PDF."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState text="Đang tải chứng từ…" />;
  if (error || !detail) return <ErrorState message={error || "Không tìm thấy chứng từ."} onRetry={() => void load()} />;

  const p = detail.permissions;
  const s = detail.summary;
  const stepId = p.actionableStepId;
  const currentSkippable = detail.steps.find(
    (step) => step.round === detail.currentRound && step.status === "PENDING" && step.skippable,
  );

  const actions: ReactNode[] = [];
  if (p.canApprove && stepId) {
    actions.push(
      <button key="approve" type="button" className={primaryButton} disabled={busy} onClick={() => setDialog({ kind: "approve" })}>
        <CheckCircle2 size={16} /> Duyệt
      </button>,
      <button key="return" type="button" className={secondaryButton} disabled={busy} onClick={() => setDialog({ kind: "return" })}>
        <RotateCcw size={16} /> Yêu cầu bổ sung
      </button>,
      <button key="reject" type="button" className={dangerButton} disabled={busy} onClick={() => setDialog({ kind: "reject" })}>
        <XCircle size={16} /> Từ chối
      </button>,
    );
  }
  if (p.canEdit)
    actions.push(
      <button key="edit" type="button" className={secondaryButton} onClick={() => navigate(`${base}/requests/${detail.id}/edit`)}>
        <Pencil size={16} /> Chỉnh sửa
      </button>,
    );
  if (p.canSubmit)
    actions.push(
      <button
        key="submit"
        type="button"
        className={primaryButton}
        disabled={busy}
        onClick={() => void safe(() => act(() => financeApi.submit(detail.id), "Đã gửi duyệt"))}
      >
        <Send size={16} /> Gửi duyệt
      </button>,
    );
  if (p.canWithdraw)
    actions.push(
      <button key="withdraw" type="button" className={secondaryButton} disabled={busy} onClick={() => setDialog({ kind: "withdraw" })}>
        <Undo2 size={16} /> Thu hồi
      </button>,
    );
  if (p.canSkip && currentSkippable)
    actions.push(
      <button key="skip" type="button" className={secondaryButton} disabled={busy} onClick={() => setDialog({ kind: "skip" })}>
        <SkipForward size={16} /> Bỏ qua cấp "{currentSkippable.name}"
      </button>,
    );
  if (p.canRecordPayment)
    actions.push(
      <button key="pay" type="button" className={primaryButton} disabled={busy} onClick={() => setDialog({ kind: "payment" })}>
        <Wallet size={16} /> Ghi nhận chi tiền
      </button>,
    );
  if (p.canRecordRefund)
    actions.push(
      <button key="refund" type="button" className={primaryButton} disabled={busy} onClick={() => setDialog({ kind: "refund" })}>
        <Wallet size={16} /> Ghi nhận hoàn trả
      </button>,
    );
  if (p.canCreateSettlement)
    actions.push(
      <button
        key="settle"
        type="button"
        className={secondaryButton}
        onClick={() => navigate(`${base}/new?type=SETTLEMENT&advanceId=${detail.id}`)}
      >
        <FileText size={16} /> Lập hoàn ứng
      </button>,
    );
  actions.push(
    <button key="print" type="button" className={secondaryButton} disabled={busy} onClick={() => void pdf("inline")}>
      <Printer size={16} /> In
    </button>,
    <button key="pdf" type="button" className={secondaryButton} disabled={busy} onClick={() => void pdf("attachment")}>
      <Download size={16} /> Tải PDF
    </button>,
    <button
      key="copy"
      type="button"
      className={secondaryButton}
      disabled={busy}
      onClick={() =>
        void safe(async () => {
          setBusy(true);
          try {
            const created = await financeApi.copy(detail.id);
            toast.success(`Đã tạo bản sao ${created.code}`);
            navigate(`${base}/requests/${created.id}/edit`);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "Không sao chép được."));
          } finally {
            setBusy(false);
          }
        })
      }
    >
      <Copy size={16} /> Sao chép
    </button>,
  );
  if (p.canCancel)
    actions.push(
      <button key="cancel" type="button" className={dangerButton} disabled={busy} onClick={() => setDialog({ kind: "cancel" })}>
        <Ban size={16} /> Huỷ phiếu
      </button>,
    );
  if (p.canDelete)
    actions.push(
      <button
        key="delete"
        type="button"
        className={dangerButton}
        disabled={busy}
        onClick={() => {
          if (!window.confirm(`Xoá bản nháp ${detail.code}?`)) return;
          void safe(async () => {
            await financeApi.remove(detail.id);
            toast.success("Đã xoá bản nháp");
            await queryClient.invalidateQueries({ queryKey: ["finance-list"] });
            navigate(`${base}/mine`, { replace: true });
          });
        }}
      >
        <Trash2 size={16} /> Xoá
      </button>,
    );

  const showApprovedColumn = detail.items.some((item) => item.approvedAmount !== null && item.approvedAmount !== item.amount);
  const rounds = [...new Set(detail.steps.map((step) => step.round))].sort((a, b) => b - a);
  const outstandingSalary = Math.max(detail.paidAmount - detail.deductedAmount, 0);

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Quay lại
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">{detail.code}</h2>
              <TypeBadge type={detail.type} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{detail.title}</p>
            <p className="text-xs text-slate-500">
              {detail.requesterName}
              {detail.departmentName && ` · ${detail.departmentName}`} · {detail.company?.name} · Ngày {formatDate(detail.requestDate)}
            </p>
            <StatusBadges item={{ ...detail, overdue: s.overdue }} />
            {detail.approvalStatus === "PENDING" && (
              <p className="text-xs text-amber-700">
                Đang chờ:{" "}
                {detail.steps
                  .filter((step) => step.round === detail.currentRound && step.status === "PENDING")
                  .map((step) => `${step.name} (${step.candidates.map((c) => c.name).join(", ")})`)
                  .join("; ")}
              </p>
            )}
            {detail.cancelReason && <p className="text-xs text-rose-600">Lý do huỷ: {detail.cancelReason}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
            <Amount label="Tổng đề nghị" value={detail.totalAmount} />
            <Amount
              label="Được duyệt"
              value={detail.approvalStatus === "APPROVED" || detail.items.some((i) => i.approvedAmount !== null) ? s.approvedTotal : null}
              tone="text-blue-700"
            />
            <Amount label="Đã chi" value={detail.paidAmount} tone="text-emerald-700" />
            {s.receivableDue > 0 ? (
              <Amount label="Còn phải thu" value={s.receivableRemaining} tone="text-violet-700" />
            ) : (
              <Amount label="Còn phải chi" value={s.payableRemaining} tone="text-amber-700" />
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{actions}</div>
      </section>

      <Warnings items={detail.warnings} />

      {p.canApprove && detail.attachments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2">
            <Paperclip size={16} className="shrink-0" />
            <span>
              Phiếu có <b>{detail.attachments.length} tệp đính kèm</b>. Vui lòng xem chứng từ trước khi quyết định phê duyệt.
            </span>
          </p>
          {tab !== "attachments" && (
            <button
              type="button"
              onClick={() => setTab("attachments")}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Xem tệp đính kèm
            </button>
          )}
        </div>
      )}

      <nav className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-1 border-b border-slate-200">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                tab === item.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.icon}
              {item.label}
              {item.key === "attachments" && detail.attachments.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px]">{detail.attachments.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {tab === "info" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Thông tin chung">
              <dl>
                <InfoRow label="Công ty">{detail.company?.name}</InfoRow>
                <InfoRow label="Người đề nghị">
                  {detail.requesterName} {detail.requesterCode && <span className="text-slate-400">({detail.requesterCode})</span>}
                </InfoRow>
                <InfoRow label="Phòng ban / chức vụ">
                  {[detail.departmentName, detail.requesterPosition].filter(Boolean).join(" — ")}
                </InfoRow>
                <InfoRow label="Quản lý trực tiếp">{detail.directManagerName}</InfoRow>
                <InfoRow label="Mục đích">{detail.purpose}</InfoRow>
                <InfoRow label="Dự án / sự kiện">{detail.projectName}</InfoRow>
                {detail.type === "ADVANCE" && (
                  <>
                    <InfoRow label="Dự kiến sử dụng">{formatDate(detail.expectedUseDate)}</InfoRow>
                    <InfoRow label="Hạn hoàn ứng">
                      {formatDate(detail.settlementDueDate)}
                      {s.daysToDue !== null && (s.advanceOutstanding ?? 0) > 0 && (
                        <span className={`ml-2 text-xs font-semibold ${s.daysToDue < 0 ? "text-rose-600" : "text-slate-500"}`}>
                          {s.daysToDue < 0 ? `quá hạn ${-s.daysToDue} ngày` : `còn ${s.daysToDue} ngày`}
                        </span>
                      )}
                    </InfoRow>
                  </>
                )}
                {detail.type === "EXPENSE_PAYMENT" && (
                  <>
                    <InfoRow label="Địa điểm công tác">{detail.location}</InfoRow>
                    <InfoRow label="Thời gian công tác">
                      {detail.tripStartDate || detail.tripEndDate
                        ? `${formatDate(detail.tripStartDate)} – ${formatDate(detail.tripEndDate)}`
                        : ""}
                    </InfoRow>
                  </>
                )}
                {detail.type === "SALARY_ADVANCE" && (
                  <>
                    <InfoRow label="Kỳ lương">Tháng {detail.salaryMonth}/{detail.salaryYear}</InfoRow>
                    <InfoRow label="Lương dự kiến">
                      {detail.expectedSalary ? `${formatMoney(detail.expectedSalary)} đ` : "—"}
                    </InfoRow>
                    <InfoRow label="Khấu trừ">
                      {detail.deductionStartMonth
                        ? `Từ tháng ${detail.deductionStartMonth}/${detail.deductionStartYear}, ${detail.deductionPeriods ?? 1} kỳ`
                        : "Theo kỳ lương ứng"}
                    </InfoRow>
                  </>
                )}
              </dl>
            </Card>
            <Card title="Thông tin nhận tiền">
              <dl>
                <InfoRow label="Hình thức">{detail.paymentMethod ? PAYMENT_METHOD_LABELS[detail.paymentMethod] : ""}</InfoRow>
                <InfoRow label="Tài khoản thanh toán">
                  {detail.paymentAccountCode
                    ? `${detail.paymentAccountCode}${detail.paymentAccountName ? ` — ${detail.paymentAccountName}` : ""}`
                    : "Chưa chọn"}
                </InfoRow>
                <InfoRow label="Người thụ hưởng">{detail.payeeName}</InfoRow>
                {detail.paymentMethod === "BANK_TRANSFER" && (
                  <>
                    <InfoRow label="Chủ tài khoản">{detail.bankAccountHolder}</InfoRow>
                    <InfoRow label="Ngân hàng">{detail.bankName}</InfoRow>
                    <InfoRow label="Số tài khoản">
                      <span className="font-mono">{detail.bankAccountNumber}</span>
                    </InfoRow>
                  </>
                )}
                <InfoRow label="Ghi chú">{detail.paymentNote}</InfoRow>
              </dl>
            </Card>
          </div>

          {detail.type !== "SALARY_ADVANCE" && (
            <Card title={detail.type === "SETTLEMENT" ? "Chi phí thực tế" : "Bảng chi tiết"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">STT</th>
                      <th className="px-3 py-2">Nội dung</th>
                      <th className="px-3 py-2">ĐVT</th>
                      <th className="px-3 py-2 text-right">SL</th>
                      <th className="px-3 py-2 text-right">Đơn giá</th>
                      <th className="px-3 py-2 text-right">Thành tiền</th>
                      {showApprovedColumn && <th className="px-3 py-2 text-right">Được chấp nhận</th>}
                      <th className="px-3 py-2">Chứng từ / ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-3 py-2 text-slate-500">{item.lineNo}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800">{item.description}</p>
                          {item.categoryName && <p className="text-xs text-slate-500">{item.categoryName}</p>}
                          {item.overLimit && <Badge tone="amber">Vượt định mức</Badge>}
                        </td>
                        <td className="px-3 py-2">{item.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(item.amount)}</td>
                        {showApprovedColumn && (
                          <td className="px-3 py-2 text-right">
                            <p className="font-semibold tabular-nums text-blue-700">{formatMoney(item.approvedAmount ?? item.amount)}</p>
                            {item.adjustmentReason && (
                              <p className="text-[11px] text-slate-500">
                                {item.adjustmentReason} — {item.adjustedByName}
                              </p>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {[
                            item.incurredDate && `Ngày ${formatDate(item.incurredDate)}`,
                            item.invoiceNumber && `HĐ ${item.invoiceNumber}`,
                            item.invoiceType && INVOICE_TYPE_LABELS[item.invoiceType],
                            item.supplierName,
                            item.note,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {item.attachmentCount > 0 && (
                            <button type="button" onClick={() => setTab("attachments")} className="ml-1 inline-flex items-center gap-0.5 font-semibold text-blue-700">
                              <Paperclip size={12} /> {item.attachmentCount}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold">
                      <td colSpan={5} className="px-3 py-2 text-right">Tổng cộng</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(detail.totalAmount)}</td>
                      {showApprovedColumn && <td className="px-3 py-2 text-right tabular-nums text-blue-700">{formatMoney(s.approvedTotal)}</td>}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-3 text-sm italic text-slate-600">Bằng chữ: {s.approvedTotal !== detail.totalAmount ? s.approvedInWords : s.amountInWords}</p>
            </Card>
          )}

          {detail.type === "SETTLEMENT" && (
            <Card title="Đối trừ tạm ứng & chênh lệch quyết toán">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Mã tạm ứng</th>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Nội dung</th>
                      <th className="px-3 py-2 text-right">Đã chi</th>
                      <th className="px-3 py-2 text-right">Phân bổ nơi khác</th>
                      <th className="px-3 py-2 text-right">Đối trừ</th>
                      <th className="px-3 py-2">Tình trạng tạm ứng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.allocations.map((a) => (
                      <tr key={a.advanceId}>
                        <td className="px-3 py-2">
                          <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => navigate(`${base}/requests/${a.advanceId}`)}>
                            {a.code}
                          </button>
                        </td>
                        <td className="px-3 py-2">{formatDate(a.requestDate)}</td>
                        <td className="px-3 py-2">{a.title}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(a.paidAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(a.allocatedElsewhere)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(a.amount)}</td>
                        <td className="px-3 py-2">
                          <Badge tone={SETTLEMENT_LABELS[a.advanceSettlementStatus][1]}>{SETTLEMENT_LABELS[a.advanceSettlementStatus][0]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Amount label="Chi phí được duyệt" value={s.approvedTotal} />
                <Amount label="Tạm ứng đối trừ" value={detail.offsetAmount || detail.allocations.reduce((sum, a) => sum + a.amount, 0)} />
                {(s.difference ?? 0) >= 0 ? (
                  <Amount label="Công ty trả thêm" value={s.difference ?? 0} tone="text-amber-700" />
                ) : (
                  <Amount label="Nhân viên hoàn lại" value={-(s.difference ?? 0)} tone="text-violet-700" />
                )}
              </div>
            </Card>
          )}

          {detail.type === "ADVANCE" && detail.settlements.length > 0 && (
            <Card title="Các lần hoàn ứng">
              <div className="space-y-2">
                {detail.settlements.map((row) => (
                  <div key={row.settlementId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => navigate(`${base}/requests/${row.settlementId}`)}>
                      {row.code}
                    </button>
                    <span className="text-slate-500">{formatDate(row.requestDate)}</span>
                    <Badge tone={APPROVAL_LABELS[row.approvalStatus][1]}>{APPROVAL_LABELS[row.approvalStatus][0]}</Badge>
                    <span className="font-semibold tabular-nums">{formatMoney(row.amount)} đ</span>
                    <span className="text-xs text-slate-500">{row.appliedAt ? `Đã đối trừ ${formatDateTime(row.appliedAt)}` : "Đang giữ chỗ"}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm">
                Còn phải hoàn ứng: <b className="tabular-nums text-amber-700">{formatMoney(s.advanceOutstanding ?? 0)} đ</b>
              </p>
            </Card>
          )}

          {detail.type === "SALARY_ADVANCE" && (
            <Card title="Khấu trừ tạm ứng lương">
              {detail.deductions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Kế hoạch khấu trừ chỉ được lập sau khi khoản ứng đã thực chi.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.deductions.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                      <span className="font-semibold">Tháng {row.periodMonth}/{row.periodYear}</span>
                      <span className="tabular-nums">Kế hoạch {formatMoney(row.plannedAmount)} đ</span>
                      <span className="tabular-nums">{row.deductedAmount !== null ? `Đã trừ ${formatMoney(row.deductedAmount)} đ` : ""}</span>
                      <Badge tone={row.status === "DEDUCTED" ? "emerald" : row.status === "PLANNED" ? "amber" : "slate"}>
                        {row.status === "DEDUCTED" ? "Đã khấu trừ" : row.status === "PLANNED" ? "Chờ khấu trừ" : "Đã huỷ"}
                      </Badge>
                      {row.status === "PLANNED" && p.canConfirmDeduction && (
                        <button type="button" className={secondaryButton} onClick={() => setDialog({ kind: "deduction", deductionId: row.id })}>
                          Ghi nhận đã trừ
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-sm">
                    Còn phải khấu trừ: <b className="tabular-nums text-amber-700">{formatMoney(outstandingSalary)} đ</b>
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "attachments" && (
        <Card title="Chứng từ đính kèm">
          <AttachmentGrid detail={detail} onChanged={(next) => (next ? setDetail(next) : load())} />
        </Card>
      )}

      {tab === "workflow" && (
        <Card title={`Quy trình phê duyệt${detail.workflowName ? ` — ${detail.workflowName}` : ""}`}>
          {detail.steps.length === 0 && <p className="text-sm text-slate-500">Phiếu chưa gửi duyệt.</p>}
          <div className="space-y-6">
            {rounds.map((round) => (
              <div key={round}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Vòng duyệt {round}
                  {round === detail.currentRound ? " (hiện tại)" : ""}
                </p>
                <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" />
                    <p className="text-sm font-semibold text-slate-800">Người đề nghị gửi duyệt</p>
                    <p className="text-xs text-slate-500">{detail.requesterName}</p>
                  </li>
                  {detail.steps
                    .filter((step) => step.round === round)
                    .map((step) => {
                      const [label, tone] = STEP_LABELS[step.status];
                      return (
                        <li key={step.id} className="relative">
                          <span
                            className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                              step.status === "APPROVED"
                                ? "bg-emerald-500"
                                : step.status === "PENDING"
                                  ? "bg-amber-400"
                                  : step.status === "REJECTED"
                                    ? "bg-rose-500"
                                    : step.status === "RETURNED"
                                      ? "bg-violet-500"
                                      : "bg-slate-300"
                            }`}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">
                              {step.stepOrder}. {step.name}
                            </p>
                            <Badge tone={tone}>{label}</Badge>
                            {step.approverRole && <span className="text-[11px] text-slate-400">{ROLE_LABELS[step.approverRole]}</span>}
                          </div>
                          {step.actedByName && (
                            <p className="text-xs text-slate-600">
                              {step.actedByName}
                              {step.onBehalfOfName && ` (uỷ quyền thay ${step.onBehalfOfName})`} · {formatDateTime(step.actedAt)}
                            </p>
                          )}
                          {step.status === "PENDING" && step.candidates.length > 0 && (
                            <p className="text-xs text-amber-700">Người có thể duyệt: {step.candidates.map((c) => c.name).join(", ")}</p>
                          )}
                          {step.comment && <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">“{step.comment}”</p>}
                        </li>
                      );
                    })}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Amount label="Tổng được duyệt" value={s.approvedTotal} />
            <Amount label="Phải chi" value={s.payableDue} />
            <Amount label="Đã chi" value={detail.paidAmount} tone="text-emerald-700" />
            <Amount label="Còn phải chi" value={s.payableRemaining} tone="text-amber-700" />
            {s.receivableDue > 0 && (
              <>
                <Amount label="Phải thu hồi" value={s.receivableDue} />
                <Amount label="Đã thu" value={detail.recoveredAmount} tone="text-emerald-700" />
                <Amount label="Còn phải thu" value={s.receivableRemaining} tone="text-violet-700" />
              </>
            )}
          </div>
          <MovementTable
            title="Các lần chi tiền"
            rows={detail.payments}
            attachments={detail.attachments.filter((a) => a.paymentId)}
            canVoid={p.canVoidMoney}
            onVoid={(movement) => setDialog({ kind: "void-payment", movement })}
            linkKey="paymentId"
          />
          {(detail.refunds.length > 0 || s.receivableDue > 0) && (
            <MovementTable
              title="Các lần nhân viên hoàn trả"
              rows={detail.refunds}
              attachments={detail.attachments.filter((a) => a.refundId)}
              canVoid={p.canVoidMoney}
              onVoid={(movement) => setDialog({ kind: "void-refund", movement })}
              linkKey="refundId"
            />
          )}
        </div>
      )}

      {tab === "history" && (
        <Card title="Lịch sử thao tác">
          <ol className="space-y-3">
            {detail.audit.map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{AUDIT_LABELS[log.action] ?? log.action}</p>
                  <p className="text-xs text-slate-500">
                    {log.actorName} · {formatDateTime(log.createdAt)}
                  </p>
                </div>
                {(log.fromStatus || log.toStatus) && (
                  <p className="text-xs text-slate-500">
                    {log.fromStatus ?? "—"} → {log.toStatus ?? "—"}
                  </p>
                )}
                {log.comment && <p className="mt-1 text-xs text-slate-700">“{log.comment}”</p>}
                {log.changes && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-blue-700">Chi tiết thay đổi</summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {dialog?.kind === "approve" && stepId && (
        <ApproveModal
          detail={detail}
          canAdjust={p.canAdjust}
          requiresPaymentAccount={p.requiresPaymentAccount}
          onClose={() => setDialog(null)}
          onSubmit={(value) => safe(() => act(() => financeApi.approve(detail.id, { stepId, ...value }), "Đã duyệt"))}
        />
      )}
      {(dialog?.kind === "reject" || dialog?.kind === "return") && stepId && (
        <ReasonModal
          title={dialog.kind === "reject" ? "Từ chối đề nghị" : "Yêu cầu bổ sung"}
          label={dialog.kind === "reject" ? "Lý do từ chối" : "Nội dung cần bổ sung"}
          confirmText={dialog.kind === "reject" ? "Từ chối" : "Trả về"}
          danger={dialog.kind === "reject"}
          onClose={() => setDialog(null)}
          onSubmit={(text) =>
            safe(() =>
              act(
                () =>
                  dialog.kind === "reject"
                    ? financeApi.reject(detail.id, stepId, text)
                    : financeApi.returnForChanges(detail.id, stepId, text),
                dialog.kind === "reject" ? "Đã từ chối" : "Đã trả về người đề nghị",
              ),
            )
          }
        />
      )}
      {dialog?.kind === "withdraw" && (
        <ReasonModal
          title="Thu hồi đề nghị"
          label="Lý do thu hồi"
          confirmText="Thu hồi về nháp"
          optional
          onClose={() => setDialog(null)}
          onSubmit={(text) => safe(() => act(() => financeApi.withdraw(detail.id, text || undefined), "Đã thu hồi về nháp"))}
        />
      )}
      {dialog?.kind === "cancel" && (
        <ReasonModal
          title="Huỷ phiếu đã duyệt"
          label="Lý do huỷ (bằng chứng đính kèm ở tab Chứng từ)"
          confirmText="Huỷ phiếu"
          danger
          onClose={() => setDialog(null)}
          onSubmit={(text) => safe(() => act(() => financeApi.cancel(detail.id, text), "Đã huỷ phiếu"))}
        />
      )}
      {dialog?.kind === "skip" && currentSkippable && (
        <ReasonModal
          title={`Bỏ qua cấp "${currentSkippable.name}"`}
          label="Lý do bỏ qua theo chính sách"
          confirmText="Bỏ qua cấp"
          onClose={() => setDialog(null)}
          onSubmit={(text) => safe(() => act(() => financeApi.skipStep(detail.id, currentSkippable.id, text), "Đã bỏ qua cấp duyệt"))}
        />
      )}
      {(dialog?.kind === "payment" || dialog?.kind === "refund") && (
        <MoneyModal
          kind={dialog.kind}
          remaining={dialog.kind === "payment" ? s.payableRemaining : s.receivableRemaining}
          defaultMethod={dialog.kind === "payment" ? detail.paymentMethod : undefined}
          defaultCashAccountCode={dialog.kind === "payment" ? detail.paymentAccountCode : undefined}
          onClose={() => setDialog(null)}
          onSubmit={({ payload, proofs }) =>
            safe(() =>
              act(async () => {
                const movement =
                  dialog.kind === "payment"
                    ? await financeApi.recordPayment(detail.id, payload)
                    : await financeApi.recordRefund(detail.id, payload);
                if (proofs.length) {
                  return financeApi.uploadAttachments(detail.id, proofs, {
                    kind: dialog.kind === "payment" ? "PAYMENT_PROOF" : "REFUND_PROOF",
                    ...(dialog.kind === "payment" ? { paymentId: movement.id } : { refundId: movement.id }),
                  });
                }
                return undefined;
              }, dialog.kind === "payment" ? "Đã ghi nhận chi tiền" : "Đã ghi nhận hoàn trả"),
            )
          }
        />
      )}
      {(dialog?.kind === "void-payment" || dialog?.kind === "void-refund") && (
        <ReasonModal
          title={`Huỷ ${dialog.kind === "void-payment" ? "phiếu chi" : "phiếu thu"} ${formatMoney(dialog.movement.amount)} đ`}
          label="Lý do huỷ"
          confirmText="Huỷ phiếu"
          danger
          onClose={() => setDialog(null)}
          onSubmit={(text) =>
            safe(() =>
              act(
                () =>
                  dialog.kind === "void-payment"
                    ? financeApi.voidPayment(detail.id, dialog.movement.id, text)
                    : financeApi.voidRefund(detail.id, dialog.movement.id, text),
                "Đã huỷ",
              ),
            )
          }
        />
      )}
      {dialog?.kind === "deduction" && (
        <DeductionModal
          row={detail.deductions.find((row) => row.id === dialog.deductionId)!}
          outstanding={outstandingSalary}
          onClose={() => setDialog(null)}
          onSubmit={(value) =>
            safe(() => act(() => financeApi.confirmDeduction(detail.id, dialog.deductionId, value), "Đã ghi nhận khấu trừ"))
          }
        />
      )}
    </div>
  );
}
function Amount({ label, value, tone = "text-slate-900" }: { label: string; value: number | null; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`font-extrabold tabular-nums ${value === null ? "text-slate-400" : tone}`}>
        {value === null ? "Chưa duyệt" : `${formatMoney(value)} đ`}
      </p>
    </div>
  );
}

function MovementTable({
  title,
  rows,
  attachments,
  canVoid,
  onVoid,
  linkKey,
}: {
  title: string;
  rows: FinanceMovement[];
  attachments: FinanceDetail["attachments"];
  canVoid: boolean;
  onVoid: (movement: FinanceMovement) => void;
  linkKey: "paymentId" | "refundId";
}) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2">Hình thức</th>
                <th className="px-3 py-2">Mã giao dịch</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Bằng chứng</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className={row.status === "VOIDED" ? "text-slate-400 line-through" : ""}>
                  <td className="px-3 py-2">{formatDate(row.date)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-2">
                    {PAYMENT_METHOD_LABELS[row.method]}
                    {row.cashAccountCode && <span className="text-xs text-slate-500"> · TK {row.cashAccountCode}</span>}
                  </td>
                  <td className="px-3 py-2">{row.transactionRef ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.recordedByName}
                    <p className="text-[11px] text-slate-400">{formatDateTime(row.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {attachments.filter((a) => a[linkKey] === row.id).map((a) => a.originalName).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right no-underline">
                    {row.status === "VOIDED" ? (
                      <span className="text-xs text-rose-500 [text-decoration:none]">Đã huỷ: {row.voidReason}</span>
                    ) : (
                      canVoid && (
                        <button type="button" className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => onVoid(row)}>
                          Huỷ
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
