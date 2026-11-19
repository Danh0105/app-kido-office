import { useState, type ReactNode } from "react";
import type { ExpenseAttachment } from "@/types/expenseRequest";
import { resolveFileUrl } from "@/service/expenseRequest";
import CashAccountSelect from "@/pages/Director/expense/component/expense/CashAccountSelect";
import DecimalInput from "@/components/DecimalInput";
import { formatVnd } from "@/utils/decimal";

export type ActionPayload = {
  note?: string;
  reason?: string;
  files?: File[];
  /** Nguồn chi — số hiệu tài khoản trong danh mục Nguồn thu chi */
  cashAccount?: string;
  /** Nhiều nguồn chi (19/11/2026): từng nguồn + số tiền, tổng = lệnh chi. */
  cashSplits?: { cashAccount: string; amount: number }[];
};

type Props = {
  title: string;
  /** Nội dung hiện đầu hộp thoại (VD số tiền sẽ chi khi duyệt). */
  description?: ReactNode;
  submitLabel: string;
  submitColor?: string;
  showNote?: boolean;
  noteLabel?: string;
  showFiles?: boolean;
  /** Tệp đã up từ trước (VD lần xuất tiền trước) — hiện kèm nút xoá riêng, không phải file mới chọn. */
  existingAttachments?: ExpenseAttachment[];
  /** Xoá 1 tệp đã up trong `existingAttachments`. Bỏ trống = không cho xoá. */
  onDeleteAttachment?: (attachmentId: number) => void | Promise<void>;
  requireReason?: boolean;
  reasonLabel?: string;
  /** Thủ quỹ chọn nguồn chi (tài khoản) đã dùng để chi khi xác nhận xuất tiền */
  showCashAccount?: boolean;
  /**
   * Số tiền lệnh chi: có thì Thủ quỹ chọn được nhiều nguồn chi, mỗi nguồn
   * một ô số tiền, tổng phải bằng đúng số này.
   */
  cashSplitTotal?: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: ActionPayload) => void;
};

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function ActionModal({
  title,
  description,
  submitLabel,
  submitColor = "bg-blue-500",
  showNote,
  noteLabel = "Ghi chú",
  showFiles,
  existingAttachments,
  onDeleteAttachment,
  requireReason,
  reasonLabel = "Lý do",
  showCashAccount,
  cashSplitTotal,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const splitEnabled = !!showCashAccount && Number(cashSplitTotal) > 0;
  const orderTotal = Math.round(Number(cashSplitTotal || 0) * 100) / 100;
  const [splits, setSplits] = useState<{ cashAccount: string; amount: number }[]>([
    { cashAccount: "", amount: orderTotal },
  ]);
  const splitSum =
    Math.round(splits.reduce((sum, row) => sum + Number(row.amount || 0), 0) * 100) / 100;
  const splitDiff = Math.round((orderTotal - splitSum) * 100) / 100;
  const updateSplit = (index: number, patch: Partial<{ cashAccount: string; amount: number }>) =>
    setSplits((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addSplit = () =>
    setSplits((prev) => {
      const used = prev.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return [...prev, { cashAccount: "", amount: Math.max(0, Math.round((orderTotal - used) * 100) / 100) }];
    });
  const removeSplit = (index: number) =>
    setSplits((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Còn một nguồn thì nguồn đó chi cả lệnh chi.
      return next.length === 1 ? [{ ...next[0], amount: orderTotal }] : next;
    });
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [cashAccount, setCashAccount] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDeleteExisting = async (attachmentId: number) => {
    if (!onDeleteAttachment) return;
    setDeletingId(attachmentId);
    try {
      await onDeleteAttachment(attachmentId);
    } finally {
      setDeletingId(null);
    }
  };

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (arr.length + files.length > MAX_FILES) {
      setError(`Tối đa ${MAX_FILES} tệp`);
      return;
    }
    if (arr.some((f) => f.size > MAX_SIZE)) {
      setError("Mỗi tệp tối đa 50MB");
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...arr]);
  };

  const handleSubmit = () => {
    if (requireReason && !reason.trim()) {
      setError("Vui lòng nhập lý do");
      return;
    }
    if (splitEnabled) {
      if (splits.some((row) => !row.cashAccount)) {
        setError("Vui lòng chọn nguồn chi");
        return;
      }
      if (new Set(splits.map((row) => row.cashAccount)).size !== splits.length) {
        setError("Nguồn chi bị chọn trùng");
        return;
      }
      if (splits.length > 1 && splits.some((row) => !(Number(row.amount) > 0))) {
        setError("Nhập số tiền cho từng nguồn chi");
        return;
      }
      if (Math.abs(splitDiff) > 0.005) {
        setError(
          `Tổng các nguồn (${formatVnd(splitSum) || "0"} đ) phải bằng đúng lệnh chi (${formatVnd(orderTotal)} đ)`,
        );
        return;
      }
      onSubmit({
        note: showNote ? note.trim() || undefined : undefined,
        reason: requireReason ? reason.trim() : undefined,
        files: showFiles ? files : undefined,
        cashAccount: splits[0].cashAccount,
        cashSplits: splits.length > 1 ? splits : undefined,
      });
      return;
    }
    if (showCashAccount && !cashAccount) {
      setError("Vui lòng chọn nguồn chi");
      return;
    }
    onSubmit({
      note: showNote ? note.trim() || undefined : undefined,
      reason: requireReason ? reason.trim() : undefined,
      files: showFiles ? files : undefined,
      cashAccount: showCashAccount ? cashAccount : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {description}
          {requireReason && (
            <div>
              <label className="text-sm text-gray-600">
                {reasonLabel} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="Nhập lý do…"
              />
            </div>
          )}

          {splitEnabled && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">
                  Nguồn chi <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-500">
                  Lệnh chi: <b>{formatVnd(orderTotal)} đ</b>
                </span>
              </div>
              <div className="mt-1 space-y-2">
                {splits.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CashAccountSelect
                      value={row.cashAccount}
                      onChange={(value) => updateSplit(index, { cashAccount: value })}
                      className="min-w-0 flex-1 px-2 py-2 border rounded-lg text-sm bg-white"
                    />
                    <DecimalInput
                      value={row.amount}
                      onValueChange={(value) => updateSplit(index, { amount: value })}
                      disabled={splits.length === 1}
                      allowDecimal={false}
                      keepZero
                      className="w-32 shrink-0 px-2 py-2 border rounded-lg text-sm text-right font-semibold disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplit(index)}
                        className="h-8 w-8 shrink-0 rounded-full text-red-500 hover:bg-red-50"
                        title="Bỏ nguồn này"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={addSplit}
                  disabled={splits.length >= 10}
                  className="font-semibold text-blue-600 hover:underline disabled:text-gray-400"
                >
                  + Thêm nguồn chi
                </button>
                {splits.length > 1 && (
                  <span className={Math.abs(splitDiff) > 0.005 ? "text-red-600" : "text-green-700"}>
                    Tổng {formatVnd(splitSum) || "0"} đ
                    {Math.abs(splitDiff) > 0.005
                      ? ` · ${splitDiff > 0 ? "còn thiếu" : "thừa"} ${formatVnd(Math.abs(splitDiff))} đ`
                      : " · khớp lệnh chi"}
                  </span>
                )}
              </div>
            </div>
          )}

          {showCashAccount && !splitEnabled && (
            <div>
              <label className="text-sm text-gray-600">
                Nguồn chi <span className="text-red-500">*</span>
              </label>
              <CashAccountSelect
                value={cashAccount}
                onChange={setCashAccount}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
              />
            </div>
          )}

          {showNote && (
            <div>
              <label className="text-sm text-gray-600">{noteLabel}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="Không bắt buộc"
              />
            </div>
          )}

          {showFiles && !!existingAttachments?.length && (
            <div>
              <label className="text-sm text-gray-600">Tệp đã tải lên</label>
              <ul className="mt-1 space-y-1">
                {existingAttachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1"
                  >
                    <a
                      href={resolveFileUrl(a.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-blue-500"
                    >
                      📎 {a.fileName || a.fileUrl}
                    </a>
                    {onDeleteAttachment && (
                      <button
                        onClick={() => handleDeleteExisting(a.id)}
                        disabled={deletingId === a.id}
                        className="text-red-500 ml-2 disabled:opacity-50"
                      >
                        {deletingId === a.id ? "…" : "✕"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showFiles && (
            <div>
              <label className="text-sm text-gray-600">
                Tệp đính kèm mới (tối đa {MAX_FILES})
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => pickFiles(e.target.files)}
                className="w-full mt-1 text-sm"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1"
                    >
                      <span className="truncate">📎 {f.name}</span>
                      <button
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="text-red-500 ml-2"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-2 text-sm rounded-xl text-white font-medium active:scale-95 disabled:opacity-60 ${submitColor}`}
          >
            {loading ? "Đang xử lý…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
