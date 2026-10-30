import { useEffect, useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "react-hot-toast";

import CashAccountSelect from "@/pages/Director/expense/component/expense/CashAccountSelect";
import { DecimalTextInput, Modal } from "@/pages/Finance/components/FinanceUi";
import {
  dangerButton,
  formatDate,
  formatMoney,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  todayVN,
} from "@/pages/Finance/lib";
import { newIdempotencyKey } from "@/service/finance";
import { otherCashflowApi } from "@/service/otherCashflow";
import type {
  OrderKind,
  OtherCashflowDetail,
  OtherCashflowOrder,
} from "@/types/otherCashflow";
import { getApiErrorMessage } from "@/utils/apiError";
import { ACCEPTED_FILES, verbOf } from "../lib";

/** Hộp nhập lý do (từ chối, huỷ hợp đồng, huỷ lần ghi nhận). */
export function ReasonModal({
  open,
  title,
  label,
  confirmLabel,
  danger = true,
  required = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  danger?: boolean;
  required?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = async () => {
    if (required && !reason.trim()) {
      toast.error("Vui lòng nhập lý do");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="button" className={danger ? dangerButton : primaryButton} onClick={submit} disabled={busy}>
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </>
      }
    >
      <label className="block">
        <span className={labelClass}>
          {label}
          {required ? " *" : ""}
        </span>
        <textarea
          autoFocus
          className={`${inputClass} min-h-[96px]`}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
    </Modal>
  );
}

/**
 * Thủ quỹ ghi nhận một lần thu/chi. Khoá chống trùng sinh một lần mỗi lần mở
 * hộp → bấm lặp hay mạng chập chờn không ghi hai lần.
 */
export function RecordEntryModal({
  open,
  contract,
  onClose,
  onRecorded,
}: {
  open: boolean;
  contract: OtherCashflowDetail;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const verb = verbOf(contract.direction);
  const [date, setDate] = useState(todayVN());
  const [amountText, setAmountText] = useState("");
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useMemo(() => (open ? newIdempotencyKey() : ""), [open]);

  useEffect(() => {
    if (!open) return;
    setDate(todayVN());
    setAmountText(String(contract.remainingAmount));
    setAccount("");
    setNote("");
    setFiles([]);
  }, [open, contract.remainingAmount]);

  const amount = Number(amountText || 0);

  const submit = async () => {
    if (!date) {
      toast.error(`Vui lòng chọn ngày ${verb}`);
      return;
    }
    if (date > todayVN()) {
      toast.error(`Ngày ${verb} không được sau hôm nay`);
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (amount > contract.remainingAmount) {
      toast.error(`Vượt số còn phải ${verb} ${formatMoney(contract.remainingAmount)} đ`);
      return;
    }
    if (!account) {
      toast.error("Vui lòng chọn tài khoản tiền");
      return;
    }
    setBusy(true);
    try {
      const entry = await otherCashflowApi.recordEntry(contract.id, {
        date,
        amount,
        cashAccountCode: account,
        note: note.trim() || undefined,
        idempotencyKey,
      });
      if (files.length) {
        try {
          await otherCashflowApi.uploadAttachments(contract.id, files, entry.id);
        } catch (err) {
          toast.error(`Đã ghi nhận nhưng chưa tải được chứng từ: ${getApiErrorMessage(err, "lỗi tải tệp")}`);
        }
      }
      toast.success(`Đã ghi nhận ${verb} ${formatMoney(amount)} đ`);
      onRecorded();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không ghi nhận được"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Ghi nhận ${verb} — ${contract.code}`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="button" className={primaryButton} onClick={submit} disabled={busy}>
            {busy ? "Đang ghi…" : `Ghi nhận ${verb}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Hợp đồng {formatMoney(contract.amount)} đ · đã {verb}{" "}
          <b>{formatMoney(contract.recordedAmount)} đ</b> · còn{" "}
          <b className="text-blue-700">{formatMoney(contract.remainingAmount)} đ</b>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Ngày {verb} *</span>
            <input type="date" className={inputClass} value={date} max={todayVN()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Số tiền (đồng) *</span>
            <DecimalTextInput
              value={amountText}
              onChange={setAmountText}
              maxFraction={0}
              className={`${inputClass} text-right tabular-nums`}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Tài khoản tiền *</span>
          <CashAccountSelect value={account} onChange={setAccount} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Ghi chú</span>
          <input className={inputClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Số phiếu, mã giao dịch…" />
        </label>
        <div>
          <span className={labelClass}>Chứng từ (PDF/ảnh)</span>
          <label className={`${secondaryButton} mt-1 cursor-pointer`}>
            <Paperclip size={16} /> Chọn tệp
            <input
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...picked].slice(0, 10));
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Bỏ ${file.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Số còn lập phiếu được: phải thu/chi − đã thực hiện − phiếu đang chờ. */
export function openAmount(contract: OtherCashflowDetail, kind: OrderKind, costId?: number | null) {
  const pending = contract.orders.filter(
    (o) => o.status === "PENDING" && o.kind === kind && (kind === "RECEIPT" || o.costId === costId),
  );
  const queued = pending.reduce((sum, o) => sum + o.amount, 0);
  if (kind === "RECEIPT") return contract.amount - contract.recordedAmount - queued;
  const cost = contract.costs.find((c) => c.id === costId);
  return cost ? cost.amount - cost.paidAmount - queued : 0;
}

/** Kế toán công nợ lập phiếu thu tiền hàng / lệnh chi một khoản chi phí. */
export function CreateOrderModal({
  open,
  contract,
  kind,
  onClose,
  onCreated,
}: {
  open: boolean;
  contract: OtherCashflowDetail;
  kind: OrderKind;
  onClose: () => void;
  onCreated: (next: OtherCashflowDetail) => void;
}) {
  const receipt = kind === "RECEIPT";
  const payable = contract.costs.filter((cost) => openAmount(contract, "PAYMENT", cost.id) > 0);
  const [costId, setCostId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const maxAmount = openAmount(contract, kind, costId);

  useEffect(() => {
    if (!open) return;
    const firstCost = receipt ? null : payable[0]?.id ?? null;
    setCostId(firstCost);
    setAmountText(String(Math.max(0, openAmount(contract, kind, firstCost))));
    setDueDate("");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const submit = async () => {
    const amount = Number(amountText || 0);
    if (!receipt && !costId) {
      toast.error("Vui lòng chọn khoản chi phí");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (amount > maxAmount) {
      toast.error(`Vượt số còn có thể lập ${formatMoney(maxAmount)} đ`);
      return;
    }
    setBusy(true);
    try {
      const next = await otherCashflowApi.createOrder(contract.id, {
        kind,
        costId: costId ?? undefined,
        amount,
        dueDate: dueDate || null,
        note: note.trim() || undefined,
      });
      toast.success(receipt ? "Đã lập phiếu thu — chờ thủ quỹ thu" : "Đã lập lệnh chi — chờ thủ quỹ chi");
      onCreated(next);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lập được phiếu"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`${receipt ? "Lập phiếu thu tiền hàng" : "Lập lệnh chi chi phí"} — ${contract.code}`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="button" className={primaryButton} onClick={submit} disabled={busy}>
            {busy ? "Đang lập…" : receipt ? "Lập phiếu thu" : "Lập lệnh chi"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {receipt ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Tiền hàng {formatMoney(contract.amount)} đ · đã thu <b>{formatMoney(contract.recordedAmount)} đ</b> · còn
            lập phiếu được <b className="text-blue-700">{formatMoney(maxAmount)} đ</b>
          </p>
        ) : (
          <label className="block">
            <span className={labelClass}>Khoản chi phí *</span>
            <select
              className={inputClass}
              value={costId ?? ""}
              onChange={(e) => {
                const next = e.target.value ? Number(e.target.value) : null;
                setCostId(next);
                setAmountText(String(Math.max(0, openAmount(contract, "PAYMENT", next))));
              }}
            >
              {!payable.length && <option value="">— Không còn khoản nào cần lập lệnh —</option>}
              {payable.map((cost) => (
                <option key={cost.id} value={cost.id}>
                  {cost.description}
                  {cost.payee ? ` (${cost.payee})` : ""} — còn {formatMoney(openAmount(contract, "PAYMENT", cost.id))} đ
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Số tiền (đồng) *</span>
            <DecimalTextInput
              value={amountText}
              onChange={setAmountText}
              maxFraction={0}
              className={`${inputClass} text-right tabular-nums`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Hạn {receipt ? "thu" : "chi"}</span>
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Ghi chú cho thủ quỹ</span>
          <input
            className={inputClass}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={receipt ? "Đợt thu, hình thức thanh toán…" : "Số tài khoản người nhận, hoá đơn…"}
          />
        </label>
      </div>
    </Modal>
  );
}

/**
 * Thủ quỹ thu / chi theo phiếu của kế toán công nợ — số tiền đúng bằng phiếu,
 * thủ quỹ chọn ngày, tài khoản tiền và đính kèm chứng từ.
 */
export function ExecuteOrderModal({
  open,
  contract,
  order,
  onClose,
  onDone,
}: {
  open: boolean;
  contract: OtherCashflowDetail;
  order: OtherCashflowOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const receipt = order?.kind === "RECEIPT";
  const verb = receipt ? "thu" : "chi";
  const cost = contract.costs.find((c) => c.id === order?.costId);
  const [date, setDate] = useState(todayVN());
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useMemo(() => (open ? newIdempotencyKey() : ""), [open]);

  useEffect(() => {
    if (!open) return;
    setDate(todayVN());
    setAccount("");
    setNote("");
    setFiles([]);
  }, [open]);

  if (!order) return null;

  const submit = async () => {
    if (!date) {
      toast.error(`Vui lòng chọn ngày ${verb}`);
      return;
    }
    if (date > todayVN()) {
      toast.error(`Ngày ${verb} không được sau hôm nay`);
      return;
    }
    if (!account) {
      toast.error("Vui lòng chọn tài khoản tiền");
      return;
    }
    setBusy(true);
    try {
      const entry = await otherCashflowApi.executeOrder(contract.id, order.id, {
        date,
        cashAccountCode: account,
        note: note.trim() || undefined,
        idempotencyKey,
      });
      if (files.length) {
        try {
          await otherCashflowApi.uploadAttachments(contract.id, files, entry.id);
        } catch (err) {
          toast.error(`Đã ${verb} nhưng chưa tải được chứng từ: ${getApiErrorMessage(err, "lỗi tải tệp")}`);
        }
      }
      toast.success(`Đã ${verb} ${formatMoney(order.amount)} đ`);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Không ${verb} được theo phiếu`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`${receipt ? "Thu theo phiếu thu" : "Chi theo lệnh chi"} — ${contract.code}`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="button" className={primaryButton} onClick={submit} disabled={busy}>
            {busy ? "Đang ghi…" : `Xác nhận đã ${verb}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>
            {receipt
              ? `Thu tiền hàng của ${contract.partnerName}`
              : `Chi "${cost?.description ?? ""}"${cost?.payee ? ` cho ${cost.payee}` : ""}`}
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-900">{formatMoney(order.amount)} đ</p>
          <p className="text-xs text-slate-500">
            {order.createdByName} lập {order.dueDate ? `· hạn ${formatDate(order.dueDate)}` : ""}
            {order.note ? ` — ${order.note}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Ngày {verb} *</span>
            <input type="date" className={inputClass} value={date} max={todayVN()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Tài khoản tiền *</span>
            <CashAccountSelect value={account} onChange={setAccount} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Ghi chú</span>
          <input className={inputClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Số phiếu, mã giao dịch…" />
        </label>
        <div>
          <span className={labelClass}>Chứng từ (PDF/ảnh)</span>
          <label className={`${secondaryButton} mt-1 cursor-pointer`}>
            <Paperclip size={16} /> Chọn tệp
            <input
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...picked].slice(0, 10));
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Bỏ ${file.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
