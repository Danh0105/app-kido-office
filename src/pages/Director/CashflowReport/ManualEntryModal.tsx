import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, X } from "lucide-react";
import {
  cashflowReportApi,
  type CashAccountRow,
  type ManualEntry,
  type ManualEntryKind,
} from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, todayVN } from "./cashflowFormat";

type Props = {
  /** null = thêm mới. */
  entryId: number | null;
  /** Nhóm của tab đang xem — chọn sẵn tài khoản đầu tiên của nhóm khi thêm mới. */
  defaultGroup: "111" | "112";
  accounts: CashAccountRow[];
  onClose: () => void;
  onSaved: () => void;
};

const KINDS: { value: ManualEntryKind; label: string }[] = [
  { value: "IN", label: "Thu" },
  { value: "OUT", label: "Chi" },
  { value: "TRANSFER", label: "Chuyển nội bộ" },
];

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[15px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

/** Thêm / sửa / xoá bút toán thu chi nhập tay (khoản không đi qua phân hệ nào khác). */
export default function ManualEntryModal({ entryId, defaultGroup, accounts, onClose, onSaved }: Props) {
  const [entry, setEntry] = useState<ManualEntry | null>(null);
  const [loading, setLoading] = useState(entryId !== null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<ManualEntryKind>("IN");
  const [entryDate, setEntryDate] = useState(todayVN());
  const [accountCode, setAccountCode] = useState(
    () => accounts.find((a) => a.isActive && a.groupCode === defaultGroup)?.code ?? "",
  );
  const [counterAccountCode, setCounterAccountCode] = useState("");
  const [amountText, setAmountText] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [description, setDescription] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (entryId === null) return;
    cashflowReportApi
      .manualEntry(entryId)
      .then((loaded) => {
        setEntry(loaded);
        setKind(loaded.kind);
        setEntryDate(loaded.entryDate);
        setAccountCode(loaded.accountCode);
        setCounterAccountCode(loaded.counterAccountCode ?? "");
        setAmountText(loaded.amount.replace(/\.00$/, ""));
        setDocumentNo(loaded.documentNo ?? "");
        setDescription(loaded.description);
        setPartnerName(loaded.partnerName ?? "");
        setNote(loaded.note ?? "");
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Không tải được bút toán"));
        onClose();
      })
      .finally(() => setLoading(false));
    // Chỉ tải khi đổi bút toán; onClose là hàm mới mỗi lần trang cha render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const amount = amountText.replace(/[.,\s]/g, "");
  const amountValid = /^\d{1,16}$/.test(amount) && Number(amount) > 0;
  // Tài khoản đã ngừng dùng chỉ còn trong danh sách nếu bút toán đang dùng nó.
  const options = (current: string) =>
    (["111", "112"] as const).map((groupCode) => ({
      groupCode,
      accounts: accounts.filter(
        (a) => a.groupCode === groupCode && (a.isActive || a.code === current),
      ),
    }));

  const save = async () => {
    const error = !accountCode
      ? "Chọn tài khoản"
      : kind === "TRANSFER" && !counterAccountCode
        ? "Chọn tài khoản nhận"
        : kind === "TRANSFER" && counterAccountCode === accountCode
          ? "Tài khoản chuyển đi và tài khoản nhận phải khác nhau"
          : !amountValid
            ? "Số tiền phải là số nguyên dương (đồng)"
            : !description.trim()
              ? "Nhập diễn giải"
              : "";
    if (error) {
      toast.error(error);
      return;
    }
    const payload = {
      kind,
      entryDate,
      accountCode,
      counterAccountCode: kind === "TRANSFER" ? counterAccountCode : null,
      amount,
      documentNo: documentNo.trim() || null,
      description: description.trim(),
      partnerName: partnerName.trim() || null,
      note: note.trim() || null,
    };
    setSaving(true);
    try {
      if (entryId === null) await cashflowReportApi.createManualEntry(payload);
      else await cashflowReportApi.updateManualEntry(entryId, payload);
      toast.success(entryId === null ? "Đã thêm bút toán" : "Đã lưu bút toán");
      onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được bút toán"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (entryId === null || !window.confirm("Xoá bút toán này khỏi sổ?")) return;
    setSaving(true);
    try {
      await cashflowReportApi.deleteManualEntry(entryId);
      toast.success("Đã xoá bút toán");
      onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xoá được bút toán"));
    } finally {
      setSaving(false);
    }
  };

  const accountSelect = (value: string, onChange: (code: string) => void, placeholder: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      <option value="">{placeholder}</option>
      {options(value).map((group) => (
        <optgroup key={group.groupCode} label={group.groupCode === "111" ? "111 - Tiền mặt" : "112 - Tiền gửi ngân hàng"}>
          {group.accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} - {account.name}
              {account.isActive ? "" : " (ngừng sử dụng)"}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 backdrop-blur-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {entryId === null ? "Thêm bút toán nhập tay" : `Bút toán ${entry?.displayDocumentNo ?? ""}`}
            </h3>
            <p className="text-xs text-slate-500">
              {entry
                ? `Tạo bởi ${entry.createdByName ?? "—"} ngày ${formatDate(entry.createdAt.slice(0, 10))}${
                    entry.updatedByName ? ` · sửa gần nhất: ${entry.updatedByName}` : ""
                  }`
                : "Khoản không đi qua phân hệ nào khác: phí/lãi ngân hàng, rút/nộp tiền, chuyển nội bộ…"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Đang tải…
          </div>
        ) : (
          <>
            <div className="mb-3 inline-flex w-full gap-1 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
              {KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setKind(item.value)}
                  className={`flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition ${
                    kind === item.value ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Ngày hạch toán *</span>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={fieldClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Số tiền (đồng) *</span>
                <input
                  inputMode="numeric"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className={`${fieldClass} text-right`}
                />
                <span className={`mt-1 block text-xs ${!amountText || amountValid ? "text-slate-500" : "text-rose-600"}`}>
                  {amountValid ? `= ${Number(amount).toLocaleString("vi-VN")} đ` : amountText ? "Chỉ nhập chữ số, lớn hơn 0" : " "}
                </span>
              </label>
              <label className="block">
                <span className={labelClass}>
                  {kind === "IN" ? "Tài khoản nhận tiền *" : kind === "OUT" ? "Tài khoản chi *" : "Từ tài khoản *"}
                </span>
                {accountSelect(accountCode, setAccountCode, "Chọn tài khoản")}
              </label>
              {kind === "TRANSFER" ? (
                <label className="block">
                  <span className={labelClass}>Đến tài khoản *</span>
                  {accountSelect(counterAccountCode, setCounterAccountCode, "Chọn tài khoản nhận")}
                </label>
              ) : (
                <label className="block">
                  <span className={labelClass}>Số chứng từ</span>
                  <input
                    value={documentNo}
                    onChange={(e) => setDocumentNo(e.target.value)}
                    placeholder={kind === "IN" ? "Trống = tự sinh PT-…" : "Trống = tự sinh PC-…"}
                    className={fieldClass}
                  />
                </label>
              )}
              {kind === "TRANSFER" && (
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Số chứng từ</span>
                  <input
                    value={documentNo}
                    onChange={(e) => setDocumentNo(e.target.value)}
                    placeholder="Trống = tự sinh CK-…"
                    className={fieldClass}
                  />
                </label>
              )}
              <label className="block sm:col-span-2">
                <span className={labelClass}>Diễn giải *</span>
                <input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Tên đối tượng</span>
                <input value={partnerName} maxLength={255} onChange={(e) => setPartnerName(e.target.value)} className={fieldClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Ghi chú</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {entryId !== null && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void remove()}
                  className="mr-auto rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  Xoá bút toán
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : entryId === null ? "Thêm" : "Lưu"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
