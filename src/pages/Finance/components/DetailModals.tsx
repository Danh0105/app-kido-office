import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import DecimalInput from "@/components/DecimalInput";
import { newIdempotencyKey, type MoneyMovementPayload } from "@/service/finance";
import type { FinanceDeduction, FinanceDetail, PaymentMethod } from "@/types/finance";
import { useFinanceMeta } from "../FinanceRoutes";
import {
  PAYMENT_METHOD_LABELS,
  formatMoney,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  todayVN,
} from "../lib";
import { Modal } from "./FinanceUi";

type Submit<T> = (value: T) => Promise<unknown>;

/** Duyệt một cấp; cấp được phép điều chỉnh thì nhập số chấp nhận theo dòng (bắt buộc lý do khi khác). */
export function ApproveModal({
  detail,
  canAdjust,
  requiresPaymentAccount,
  onClose,
  onSubmit,
}: {
  detail: FinanceDetail;
  canAdjust: boolean;
  requiresPaymentAccount: boolean;
  onClose: () => void;
  onSubmit: Submit<{
    comment?: string;
    paymentAccountCode?: string;
    adjustments?: { itemId: number; approvedAmount: number; reason?: string }[];
  }>;
}) {
  const meta = useFinanceMeta();
  const [comment, setComment] = useState("");
  const [paymentAccountCode, setPaymentAccountCode] = useState(detail.paymentAccountCode ?? "");
  const [rows, setRows] = useState(() =>
    detail.items.map((item) => ({
      itemId: item.id,
      description: item.description,
      declared: item.amount,
      approved: item.approvedAmount ?? item.amount,
      reason: item.adjustmentReason ?? "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const approvedTotal = rows.reduce((sum, row) => sum + row.approved, 0);
  const invalid = rows.find(
    (row) => row.approved > row.declared || (row.approved !== row.declared && !row.reason.trim()),
  );
  const paymentAccounts = meta.cashAccounts.filter((account) =>
    detail.paymentMethod === "CASH" ? account.groupCode === "111" : account.groupCode === "112",
  );

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({
        comment: comment.trim() || undefined,
        paymentAccountCode: requiresPaymentAccount ? paymentAccountCode : undefined,
        adjustments: canAdjust
          ? rows
              .filter((row) => {
                const item = detail.items.find((i) => i.id === row.itemId)!;
                return row.approved !== (item.approvedAmount ?? item.amount);
              })
              .map((row) => ({ itemId: row.itemId, approvedAmount: row.approved, reason: row.reason.trim() || undefined }))
          : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide={canAdjust}
      title={`Duyệt ${detail.code}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={busy || (canAdjust && !!invalid) || (requiresPaymentAccount && !paymentAccountCode)}
            onClick={() => void submit()}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Duyệt
          </button>
        </>
      }
    >
      {canAdjust && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-slate-600">
            Ghi nhận số tiền được chấp nhận cho từng dòng (không lớn hơn số kê khai; khác số kê khai phải có lý do).
          </p>
          {rows.map((row, index) => (
            <div key={row.itemId} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <p className="text-sm font-semibold text-slate-800">
                  {index + 1}. {row.description}
                </p>
                <p className="text-xs text-slate-500">Kê khai: {formatMoney(row.declared)} đ</p>
              </div>
              <DecimalInput
                allowDecimal={false}
                keepZero
                value={row.approved}
                max={row.declared}
                onValueChange={(value) =>
                  setRows((prev) => prev.map((r) => (r.itemId === row.itemId ? { ...r, approved: value } : r)))
                }
                className={`${inputClass} mt-0 text-right md:col-span-3`}
              />
              <input
                className={`${inputClass} mt-0 md:col-span-5`}
                placeholder={row.approved !== row.declared ? "Lý do điều chỉnh *" : "Lý do (nếu có)"}
                value={row.reason}
                onChange={(e) =>
                  setRows((prev) => prev.map((r) => (r.itemId === row.itemId ? { ...r, reason: e.target.value } : r)))
                }
              />
            </div>
          ))}
          <p className="text-right text-sm">
            Tổng chấp nhận: <b className="tabular-nums text-blue-700">{formatMoney(approvedTotal)} đ</b> / kê khai{" "}
            {formatMoney(detail.totalAmount)} đ
          </p>
        </div>
      )}
      {requiresPaymentAccount && (
        <label className={`${labelClass} mb-4`}>
          Tài khoản thanh toán *
          <select
            className={inputClass}
            value={paymentAccountCode}
            onChange={(event) => setPaymentAccountCode(event.target.value)}
          >
            <option value="">Chọn tài khoản thanh toán</option>
            {paymentAccounts.map((account) => (
              <option key={account.code} value={account.code}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {detail.paymentMethod === "CASH"
              ? "Phiếu tiền mặt: chọn tài khoản nhóm 111."
              : "Phiếu chuyển khoản: chọn tài khoản nhóm 112."}
          </span>
        </label>
      )}
      <label className={labelClass}>
        Ý kiến (không bắt buộc)
        <textarea className={inputClass} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
    </Modal>
  );
}
/** Nhập lý do bắt buộc: từ chối, yêu cầu bổ sung, huỷ, bỏ qua cấp, huỷ phiếu chi/thu, thu hồi. */
export function ReasonModal({
  title,
  label,
  confirmText,
  danger = false,
  optional = false,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  confirmText: string;
  danger?: boolean;
  optional?: boolean;
  onClose: () => void;
  onSubmit: Submit<string>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            disabled={busy || (!optional && !text.trim())}
            className={
              danger
                ? "inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                : primaryButton
            }
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(text.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} {confirmText}
          </button>
        </>
      }
    >
      <label className={labelClass}>
        {label}
        {!optional && " *"}
        <textarea className={inputClass} rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </Modal>
  );
}
/**
 * Ghi nhận chi tiền / thu hoàn trả. Khoá chống gửi lặp sinh một lần khi mở
 * modal — bấm nhiều lần hay mạng chập chờn vẫn chỉ ghi một phiếu.
 */
export function MoneyModal({
  kind,
  remaining,
  defaultMethod,
  defaultCashAccountCode,
  onClose,
  onSubmit,
}: {
  kind: "payment" | "refund";
  remaining: number;
  defaultMethod?: PaymentMethod | null;
  defaultCashAccountCode?: string | null;
  onClose: () => void;
  onSubmit: Submit<{ payload: MoneyMovementPayload; proofs: File[] }>;
}) {
  const meta = useFinanceMeta();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);
  const [amount, setAmount] = useState(remaining);
  const [date, setDate] = useState(todayVN());
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? "BANK_TRANSFER");
  const [cashAccountCode, setCashAccountCode] = useState(defaultCashAccountCode ?? "");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");
  const [proofs, setProofs] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const accounts = meta.cashAccounts.filter((a) => (method === "CASH" ? a.groupCode === "111" : a.groupCode === "112"));
  const accountLocked = kind === "payment" && !!defaultCashAccountCode;
  const invalid = amount <= 0 || amount > remaining;

  return (
    <Modal
      open
      title={kind === "payment" ? "Ghi nhận chi tiền" : "Ghi nhận nhân viên hoàn trả"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={busy || invalid}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit({
                  payload: {
                    amount,
                    date,
                    method,
                    cashAccountCode: cashAccountCode || undefined,
                    transactionRef: transactionRef.trim() || undefined,
                    note: note.trim() || undefined,
                    idempotencyKey,
                  },
                  proofs,
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Ghi nhận
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Số tiền (đ) — còn {kind === "payment" ? "phải chi" : "phải thu"} {formatMoney(remaining)} đ
          <DecimalInput allowDecimal={false} value={amount} max={remaining} onValueChange={setAmount} className={inputClass} />
        </label>
        <label className={labelClass}>
          {kind === "payment" ? "Ngày chi" : "Ngày thu"}
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={labelClass}>
          Hình thức
          <select
            className={inputClass}
            value={method}
            disabled={accountLocked}
            onChange={(e) => { setMethod(e.target.value as PaymentMethod); setCashAccountCode(""); }}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Tài khoản tiền
          <select
            className={inputClass}
            value={cashAccountCode}
            disabled={accountLocked}
            onChange={(e) => setCashAccountCode(e.target.value)}
          >
            {!accountLocked && <option value="">Không chọn</option>}
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Mã giao dịch / số phiếu
          <input className={inputClass} value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Ghi chú
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {kind === "payment" ? "Biên nhận chuyển tiền" : "Biên nhận hoàn trả"} (ảnh/PDF)
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setProofs(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>
    </Modal>
  );
}

export function DeductionModal({
  row,
  outstanding,
  onClose,
  onSubmit,
}: {
  row: Pick<FinanceDeduction, "id" | "periodMonth" | "periodYear" | "plannedAmount">;
  outstanding: number;
  onClose: () => void;
  onSubmit: Submit<{ amount: number; note?: string; idempotencyKey: string }>;
}) {
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);
  const [amount, setAmount] = useState(Math.min(row.plannedAmount, outstanding));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title={`Ghi nhận khấu trừ lương tháng ${row.periodMonth}/${row.periodYear}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={busy || amount <= 0 || amount > outstanding}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit({ amount, note: note.trim() || undefined, idempotencyKey });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Xác nhận đã trừ
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Kế hoạch kỳ này {formatMoney(row.plannedAmount)} đ · còn phải trừ {formatMoney(outstanding)} đ. Mỗi kỳ chỉ ghi nhận một lần; trừ ít hơn kế
        hoạch thì phần còn lại dồn sang kỳ sau.
      </p>
      <label className={labelClass}>
        Số tiền đã trừ vào phiếu lương (đ)
        <DecimalInput allowDecimal={false} value={amount} max={outstanding} onValueChange={setAmount} className={inputClass} />
      </label>
      <label className={`${labelClass} mt-3`}>
        Ghi chú
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Modal>
  );
}
