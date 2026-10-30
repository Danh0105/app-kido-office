import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  FileText,
  HandCoins,
  Paperclip,
  Pencil,
  ReceiptText,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { Badge, ErrorState, InfoRow, LoadingState, Modal } from "@/pages/Finance/components/FinanceUi";
import {
  dangerButton,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  openBlob,
  primaryButton,
  secondaryButton,
  vndToWords,
} from "@/pages/Finance/lib";
import { otherCashflowApi } from "@/service/otherCashflow";
import type {
  OtherCashflowAttachment,
  OtherCashflowDetail,
  OtherCashflowEntry,
} from "@/types/otherCashflow";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  ACCEPTED_FILES,
  DIRECTION_LABELS,
  DIRECTION_TONES,
  EVENT_LABELS,
  ORDER_STATUS_LABELS,
  STATUS_LABELS,
  verbOf,
} from "../lib";
import OtherCashflowForm from "./OtherCashflowForm";
import {
  CreateOrderModal,
  ExecuteOrderModal,
  openAmount,
  ReasonModal,
  RecordEntryModal,
} from "./OtherCashflowModals";

type Dialog =
  | null
  | "edit"
  | "reject"
  | "cancel"
  | "record"
  | "receiptOrder"
  | "paymentOrder"
  | { voidEntryId: number }
  | { executeOrderId: number }
  | { cancelOrderId: number };

const smallButton = "!px-3 !py-1.5 text-xs";

function FileChip({
  file,
  onOpen,
  onRemove,
}: {
  file: OtherCashflowAttachment;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
      <FileText size={15} className="shrink-0 text-slate-400" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-blue-700 hover:underline">
        {file.originalName}
      </button>
      <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(file.sizeBytes)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-slate-400 hover:text-rose-600" aria-label={`Xoá ${file.originalName}`}>
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
}

function UploadButton({ label, onPick, busy }: { label: string; onPick: (files: File[]) => void; busy: boolean }) {
  return (
    <label className={`${secondaryButton} cursor-pointer ${smallButton} ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <Paperclip size={14} /> {busy ? "Đang tải…" : label}
      <input
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length) onPick(picked);
        }}
      />
    </label>
  );
}

function Progress({ label, done, total, tone }: { label: ReactNode; done: number; total: number; tone: "emerald" | "rose" }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div>
      <p className="flex flex-wrap justify-between gap-2 text-sm text-slate-600">
        <span>{label}</span>
        <span>
          <b className="tabular-nums">{formatMoney(done)}</b> / {formatMoney(total)} đ · còn{" "}
          <b className="tabular-nums text-blue-700">{formatMoney(total - done)} đ</b>
        </span>
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Chi tiết hợp đồng + thao tác theo quyền backend trả về (permissions). */
export default function OtherCashflowDetailModal({
  contractId,
  onClose,
  onChanged,
}: {
  contractId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<OtherCashflowDetail | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId) return;
    setError("");
    try {
      setDetail(await otherCashflowApi.get(contractId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được hợp đồng"));
    }
  }, [contractId]);

  useEffect(() => {
    setDetail(null);
    setDialog(null);
    void load();
  }, [load]);

  const applied = (next: OtherCashflowDetail, message: string) => {
    setDetail(next);
    setDialog(null);
    toast.success(message);
    onChanged();
  };

  const run = async (action: () => Promise<OtherCashflowDetail>, message: string) => {
    setBusy(true);
    try {
      applied(await action(), message);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Thao tác không thành công"));
      // Trạng thái có thể đã đổi (người khác vừa duyệt…) — nạp lại cho đúng.
      void load();
    } finally {
      setBusy(false);
    }
  };

  const reloadAfter = () => {
    setDialog(null);
    void load();
    onChanged();
  };

  const openFile = async (file: OtherCashflowAttachment) => {
    try {
      openBlob(await otherCashflowApi.attachmentBlob(file.contractId, file.id), file.originalName);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không mở được tệp"));
    }
  };

  const upload = async (files: File[], entryId?: number) => {
    if (!detail) return;
    setUploading(entryId ? `entry-${entryId}` : "contract");
    try {
      applied(await otherCashflowApi.uploadAttachments(detail.id, files, entryId), "Đã tải tệp lên");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được tệp"));
    } finally {
      setUploading(null);
    }
  };

  const removeFile = (file: OtherCashflowAttachment) => {
    if (!detail || !window.confirm(`Xoá tệp "${file.originalName}"?`)) return;
    void run(() => otherCashflowApi.removeAttachment(detail.id, file.id), "Đã xoá tệp");
  };

  const open = contractId !== null;
  const p = detail?.permissions;
  const commercial = detail?.form === "COMMERCIAL";
  const verb = detail ? verbOf(detail.direction) : "";
  const contractFiles = detail?.attachments.filter((a) => a.kind === "CONTRACT") ?? [];
  const costOf = (costId: number | null) => detail?.costs.find((c) => c.id === costId);
  const entryLabel = (entry: OtherCashflowEntry) =>
    !commercial
      ? `${DIRECTION_LABELS[entry.flow]}`
      : entry.costId
      ? `Chi: ${costOf(entry.costId)?.description ?? "chi phí"}`
      : "Thu tiền hàng";
  const canOpenReceipt = detail ? openAmount(detail, "RECEIPT") > 0 : false;
  const canOpenPayment = detail ? detail.costs.some((c) => openAmount(detail, "PAYMENT", c.id) > 0) : false;
  const executeOrder =
    detail && typeof dialog === "object" && dialog && "executeOrderId" in dialog
      ? detail.orders.find((o) => o.id === dialog.executeOrderId) ?? null
      : null;
  const showMoney = detail
    ? ["APPROVED", "IN_PROGRESS", "COMPLETED"].includes(detail.status) || detail.entries.length > 0
    : false;

  const footer =
    detail && p && (p.canReview || p.canEdit || p.canCancel || p.canRecord) ? (
      <>
        {p.canCancel && (
          <button type="button" className={dangerButton} disabled={busy} onClick={() => setDialog("cancel")}>
            <Ban size={16} /> Huỷ hợp đồng
          </button>
        )}
        {p.canEdit && (
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => setDialog("edit")}>
            <Pencil size={16} /> {detail.status === "REJECTED" ? "Sửa & gửi lại" : "Sửa"}
          </button>
        )}
        {p.canReview && (
          <>
            <button type="button" className={dangerButton} disabled={busy} onClick={() => setDialog("reject")}>
              <XCircle size={16} /> Từ chối
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Duyệt ${detail.code} — ${formatMoney(detail.amount)} đ?`)) {
                  void run(() => otherCashflowApi.review(detail.id, "APPROVED"), "Đã duyệt");
                }
              }}
            >
              <CheckCircle2 size={16} /> Duyệt
            </button>
          </>
        )}
        {p.canRecord && (
          <button type="button" className={primaryButton} disabled={busy} onClick={() => setDialog("record")}>
            <Wallet size={16} /> Ghi nhận {verb}
          </button>
        )}
      </>
    ) : undefined;

  return (
    <>
      <Modal
        open={open && dialog !== "edit"}
        wide
        onClose={onClose}
        title={detail ? `${detail.code} · ${detail.title}` : "Hợp đồng thu chi ngoài"}
        footer={footer}
      >
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !detail ? (
          <LoadingState />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={DIRECTION_TONES[detail.direction]}>{DIRECTION_LABELS[detail.direction]}</Badge>
              {commercial && <Badge tone="sky">Thương mại</Badge>}
              <Badge tone={STATUS_LABELS[detail.status][1]}>{STATUS_LABELS[detail.status][0]}</Badge>
            </div>

            {detail.status === "REJECTED" && detail.reviewNote && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Giám đốc từ chối: {detail.reviewNote}
              </p>
            )}
            {detail.status === "CANCELLED" && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Đã huỷ {formatDateTime(detail.cancelledAt)}
                {detail.cancelReason ? `: ${detail.cancelReason}` : ""}
              </p>
            )}

            <dl className="divide-y divide-slate-100">
              {commercial && <InfoRow label="Số đơn / hợp đồng">{detail.documentNo}</InfoRow>}
              <InfoRow label={commercial ? "Khách hàng" : "Đối tác"}>{detail.partnerName}</InfoRow>
              <InfoRow label="Trường liên quan">{detail.school?.name}</InfoRow>
              <InfoRow label={commercial ? "Tổng tiền hàng" : "Số tiền hợp đồng"}>
                <b className="tabular-nums">{formatMoney(detail.amount)} đ</b>
                <span className="block text-xs italic text-slate-500">{vndToWords(detail.amount)}</span>
              </InfoRow>
              {commercial && (
                <InfoRow label="Chi phí · lãi gộp">
                  {formatMoney(detail.costAmount)} đ · lãi gộp dự kiến{" "}
                  <b className="tabular-nums">{formatMoney(detail.grossProfit)} đ</b>
                </InfoRow>
              )}
              <InfoRow label="Ngày ký">{detail.signedDate && formatDate(detail.signedDate)}</InfoRow>
              <InfoRow label={`Ngày dự kiến ${verb}`}>{detail.expectedDate && formatDate(detail.expectedDate)}</InfoRow>
              <InfoRow label="Ghi chú">{detail.note && <span className="whitespace-pre-line">{detail.note}</span>}</InfoRow>
              <InfoRow label="Người lập">
                {detail.createdByName} · gửi duyệt {formatDateTime(detail.submittedAt)}
              </InfoRow>
              {detail.reviewedAt && (
                <InfoRow label={detail.status === "REJECTED" ? "Từ chối" : "Giám đốc duyệt"}>
                  {detail.reviewedByName} · {formatDateTime(detail.reviewedAt)}
                  {detail.status !== "REJECTED" && detail.reviewNote ? ` — ${detail.reviewNote}` : ""}
                </InfoRow>
              )}
            </dl>

            {commercial && (
              <section>
                <h4 className="mb-2 font-bold text-slate-900">Hàng hoá</h4>
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-1.5 pr-2">Mã hàng</th>
                        <th className="py-1.5 pr-2">Tên hàng</th>
                        <th className="py-1.5 pr-2">ĐVT</th>
                        <th className="py-1.5 pr-2 text-right">SL</th>
                        <th className="py-1.5 pr-2 text-right">Đơn giá</th>
                        <th className="py-1.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 font-medium text-slate-700">{item.itemCode}</td>
                          <td className="py-1.5 pr-2">{item.itemName}</td>
                          <td className="py-1.5 pr-2 text-slate-500">{item.unit}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatQuantity(item.unitPrice)}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{formatMoney(item.amount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} className="py-1.5 pr-2 text-right text-xs font-semibold text-slate-500">
                          Tổng tiền hàng
                        </td>
                        <td className="py-1.5 text-right font-bold tabular-nums">{formatMoney(detail.amount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {detail.costs.length > 0 && (
                  <>
                    <h4 className="mb-2 mt-4 font-bold text-slate-900">Các khoản chi phí</h4>
                    <ul className="space-y-1.5">
                      {detail.costs.map((cost) => (
                        <li key={cost.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span>
                            {cost.description}
                            {cost.payee && <span className="text-slate-500"> · {cost.payee}</span>}
                          </span>
                          <span className="tabular-nums">
                            <b>{formatMoney(cost.amount)} đ</b>
                            {showMoney && (
                              <span className="text-xs text-slate-500"> · đã chi {formatMoney(cost.paidAmount)} đ</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-slate-900">File {commercial ? "đơn hàng / hợp đồng" : "hợp đồng"}</h4>
                {p?.canUploadContract && (
                  <UploadButton label="Thêm tệp" busy={uploading === "contract"} onPick={(files) => upload(files)} />
                )}
              </div>
              {contractFiles.length ? (
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {contractFiles.map((file) => (
                    <FileChip
                      key={file.id}
                      file={file}
                      onOpen={() => openFile(file)}
                      onRemove={p?.canDeleteContractFile ? () => removeFile(file) : undefined}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Chưa có file.</p>
              )}
            </section>

            {commercial && showMoney && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900">Công nợ — phiếu thu / lệnh chi</h4>
                  {p?.canCreateOrder && (
                    <div className="flex flex-wrap gap-2">
                      {canOpenReceipt && (
                        <button type="button" className={`${primaryButton} ${smallButton}`} onClick={() => setDialog("receiptOrder")}>
                          <ReceiptText size={14} /> Lập phiếu thu
                        </button>
                      )}
                      {canOpenPayment && (
                        <button type="button" className={`${secondaryButton} ${smallButton}`} onClick={() => setDialog("paymentOrder")}>
                          <HandCoins size={14} /> Lập lệnh chi
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <Progress label="Tiền hàng đã thu" done={detail.recordedAmount} total={detail.amount} tone="emerald" />
                {detail.costAmount > 0 && (
                  <Progress label="Chi phí đã chi" done={detail.paidCostAmount} total={detail.costAmount} tone="rose" />
                )}
                {detail.orders.length ? (
                  <ul className="space-y-2">
                    {detail.orders.map((order) => {
                      const [statusLabel, statusTone] = ORDER_STATUS_LABELS[order.status];
                      const receipt = order.kind === "RECEIPT";
                      return (
                        <li key={order.id} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <Badge tone={receipt ? "emerald" : "rose"}>{receipt ? "Phiếu thu" : "Lệnh chi"}</Badge>{" "}
                              <b className="tabular-nums text-slate-900">{formatMoney(order.amount)} đ</b>
                              {!receipt && <span className="text-slate-600"> · {costOf(order.costId)?.description}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={statusTone}>{statusLabel}</Badge>
                              {order.status === "PENDING" && p?.canExecuteOrder && (
                                <button
                                  type="button"
                                  className={`${primaryButton} ${smallButton}`}
                                  disabled={busy}
                                  onClick={() => setDialog({ executeOrderId: order.id })}
                                >
                                  {receipt ? "Thu theo phiếu" : "Chi theo lệnh"}
                                </button>
                              )}
                              {order.status === "PENDING" && p?.canCancelOrder && (
                                <button
                                  type="button"
                                  className={`${dangerButton} ${smallButton}`}
                                  disabled={busy}
                                  onClick={() => setDialog({ cancelOrderId: order.id })}
                                >
                                  Huỷ phiếu
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {order.createdByName} lập {formatDateTime(order.createdAt)}
                            {order.dueDate ? ` · hạn ${formatDate(order.dueDate)}` : ""}
                            {order.note ? ` — ${order.note}` : ""}
                          </p>
                          {order.status === "CANCELLED" && (
                            <p className="mt-0.5 text-xs text-rose-500">
                              Huỷ bởi {order.cancelledByName} {formatDateTime(order.cancelledAt)}: {order.cancelReason}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Kế toán công nợ chưa lập phiếu nào.</p>
                )}
              </section>
            )}

            {showMoney && (
              <section>
                <h4 className="mb-2 font-bold text-slate-900">
                  {commercial ? "Thủ quỹ thu/chi thực tế" : `Thủ quỹ ghi nhận ${verb}`}
                </h4>
                {!commercial && (
                  <div className="mb-3">
                    <Progress
                      label={`Đã ${verb}`}
                      done={detail.recordedAmount}
                      total={detail.amount}
                      tone={detail.direction === "IN" ? "emerald" : "rose"}
                    />
                  </div>
                )}
                {detail.entries.length ? (
                  <ul className="space-y-2">
                    {detail.entries.map((entry) => {
                      const voided = entry.status === "VOIDED";
                      const evidence = detail.attachments.filter((a) => a.entryId === entry.id);
                      return (
                        <li
                          key={entry.id}
                          className={`rounded-xl border px-3 py-2.5 text-sm ${voided ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200 bg-white"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className={voided ? "line-through" : ""}>
                              {commercial && <span className="mr-1 font-medium">{entryLabel(entry)} ·</span>}
                              <b className={`tabular-nums ${voided ? "" : "text-slate-900"}`}>{formatMoney(entry.amount)} đ</b>{" "}
                              · {formatDate(entry.entryDate)} · TK {entry.cashAccountCode}
                            </div>
                            <div className="flex items-center gap-2">
                              {voided ? (
                                <Badge tone="slate">Đã huỷ</Badge>
                              ) : (
                                <>
                                  {p?.canManageEvidence && (
                                    <UploadButton
                                      label="Chứng từ"
                                      busy={uploading === `entry-${entry.id}`}
                                      onPick={(files) => upload(files, entry.id)}
                                    />
                                  )}
                                  {p?.canVoidEntry && (
                                    <button
                                      type="button"
                                      className={`${dangerButton} ${smallButton}`}
                                      disabled={busy}
                                      onClick={() => setDialog({ voidEntryId: entry.id })}
                                    >
                                      Huỷ lần này
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {entry.recordedByName} ghi {formatDateTime(entry.createdAt)}
                            {entry.note ? ` — ${entry.note}` : ""}
                          </p>
                          {voided && (
                            <p className="mt-0.5 text-xs text-rose-500">
                              Huỷ bởi {entry.voidedByName} {formatDateTime(entry.voidedAt)}: {entry.voidReason}
                            </p>
                          )}
                          {evidence.length > 0 && (
                            <ul className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                              {evidence.map((file) => (
                                <FileChip
                                  key={file.id}
                                  file={file}
                                  onOpen={() => openFile(file)}
                                  onRemove={p?.canManageEvidence && !voided ? () => removeFile(file) : undefined}
                                />
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">
                    {commercial ? "Chưa thu/chi lần nào." : "Thủ quỹ chưa ghi nhận lần nào."}
                  </p>
                )}
              </section>
            )}

            <section>
              <h4 className="mb-2 font-bold text-slate-900">Lịch sử</h4>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-4">
                {detail.events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <p className="font-semibold text-slate-800">{EVENT_LABELS[event.action] ?? event.action}</p>
                    <p className="text-xs text-slate-500">
                      {event.actorName} · {formatDateTime(event.createdAt)}
                      {event.note ? ` — ${event.note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Modal>

      {detail && (
        <>
          <OtherCashflowForm
            open={dialog === "edit"}
            editing={detail}
            onClose={() => setDialog(null)}
            onSaved={(next) => {
              setDetail(next);
              setDialog(null);
              onChanged();
            }}
          />
          <ReasonModal
            open={dialog === "reject"}
            title={`Từ chối ${detail.code}`}
            label="Lý do từ chối (gửi cho người lập)"
            confirmLabel="Từ chối"
            onClose={() => setDialog(null)}
            onConfirm={(note) => run(() => otherCashflowApi.review(detail.id, "REJECTED", note), "Đã từ chối")}
          />
          <ReasonModal
            open={dialog === "cancel"}
            title={`Huỷ ${detail.code}`}
            label="Lý do huỷ"
            confirmLabel="Huỷ hợp đồng"
            onClose={() => setDialog(null)}
            onConfirm={(reason) => run(() => otherCashflowApi.cancel(detail.id, reason), "Đã huỷ hợp đồng")}
          />
          <ReasonModal
            open={typeof dialog === "object" && dialog !== null && "voidEntryId" in dialog}
            title="Huỷ lần thu/chi"
            label="Lý do huỷ (ghi sai số tiền, sai tài khoản…)"
            confirmLabel="Huỷ lần thu/chi"
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              typeof dialog === "object" && dialog && "voidEntryId" in dialog
                ? run(() => otherCashflowApi.voidEntry(detail.id, dialog.voidEntryId, reason), "Đã huỷ lần thu/chi")
                : Promise.resolve()
            }
          />
          <ReasonModal
            open={typeof dialog === "object" && dialog !== null && "cancelOrderId" in dialog}
            title="Huỷ phiếu"
            label="Lý do huỷ phiếu"
            confirmLabel="Huỷ phiếu"
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              typeof dialog === "object" && dialog && "cancelOrderId" in dialog
                ? run(() => otherCashflowApi.cancelOrder(detail.id, dialog.cancelOrderId, reason), "Đã huỷ phiếu")
                : Promise.resolve()
            }
          />
          <RecordEntryModal
            open={dialog === "record"}
            contract={detail}
            onClose={() => setDialog(null)}
            onRecorded={reloadAfter}
          />
          <CreateOrderModal
            open={dialog === "receiptOrder" || dialog === "paymentOrder"}
            contract={detail}
            kind={dialog === "paymentOrder" ? "PAYMENT" : "RECEIPT"}
            onClose={() => setDialog(null)}
            onCreated={(next) => {
              setDetail(next);
              setDialog(null);
              onChanged();
            }}
          />
          <ExecuteOrderModal
            open={executeOrder !== null}
            contract={detail}
            order={executeOrder}
            onClose={() => setDialog(null)}
            onDone={reloadAfter}
          />
        </>
      )}
    </>
  );
}
