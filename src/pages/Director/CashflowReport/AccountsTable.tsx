import { useState } from "react";
import { toast } from "react-hot-toast";
import { Landmark, Pencil, X } from "lucide-react";
import {
  cashflowReportApi,
  type CashAccountGroup,
  type CashAccountRow,
} from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, formatMoney } from "./cashflowFormat";
import CashflowTableShell, {
  appleCell,
  appleHeaderCell,
  appleTableHead,
} from "./CashflowTableShell";

type Props = {
  groups: CashAccountGroup[];
  canManage: boolean;
  onSaved: () => void;
};

const moneyCell = (value: string | null) =>
  value === null ? (
    <span className="text-xs italic text-amber-700">Chưa xác minh</span>
  ) : (
    formatMoney(value)
  );

export default function AccountsTable({ groups, canManage, onSaved }: Props) {
  const [editing, setEditing] = useState<CashAccountRow | null>(null);

  return (
    <CashflowTableShell
      title="Danh mục tài khoản"
      icon={<Landmark size={21} />}
      description={
        <>
          Số dư đầu kỳ = số dư gốc đã đối chiếu ± phát sinh từ ngày đối chiếu tới đầu kỳ.
          Tài khoản chưa có số dư gốc hiển thị "Chưa xác minh" (không coi là 0).
        </>
      }
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[1160px] border-separate border-spacing-0">
          <thead className={appleTableHead}>
            <tr>
              {[
                "Mã tài khoản",
                "Tên tài khoản",
                "Nhóm tài khoản",
                "Số dư đầu kỳ",
                "Thu trong kỳ",
                "Chi trong kỳ",
                "Số dư cuối kỳ",
                "Số dư gốc (ngày đối chiếu)",
                "Trạng thái",
              ].map((label) => (
                <th key={label} className={`${appleHeaderCell} text-center`}>
                  {label}
                </th>
              ))}
              {canManage && <th className={`${appleHeaderCell} w-20`} />}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.groupCode}
                group={group}
                canManage={canManage}
                onEdit={setEditing}
              />
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <OpeningBalanceModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
    </CashflowTableShell>
  );
}

function GroupRows({
  group,
  canManage,
  onEdit,
}: {
  group: CashAccountGroup;
  canManage: boolean;
  onEdit: (account: CashAccountRow) => void;
}) {
  return (
    <>
      <tr className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white font-semibold text-slate-900">
        <td className={`${appleCell} font-mono text-[15px] font-bold text-blue-700`}>{group.groupCode}</td>
        <td className={`${appleCell} text-[15px]`} colSpan={2}>
          {group.name}
        </td>
        <td className={`${appleCell} text-right font-semibold tabular-nums text-slate-900`}>
          {moneyCell(group.subtotal.opening)}
        </td>
        <td className={`${appleCell} text-right font-semibold tabular-nums text-emerald-700`}>
          {formatMoney(group.subtotal.receipts)}
        </td>
        <td className={`${appleCell} text-right font-semibold tabular-nums text-rose-700`}>
          {formatMoney(group.subtotal.payments)}
        </td>
        <td className={`${appleCell} text-right font-bold tabular-nums text-indigo-700`}>
          {moneyCell(group.subtotal.closing)}
        </td>
        <td className={`${appleCell} text-[12px] font-normal text-slate-500`} colSpan={canManage ? 3 : 2}>
          {group.subtotal.unverifiedAccounts.length > 0 &&
            `${group.subtotal.unverifiedAccounts.length} TK chưa có số dư gốc`}
        </td>
      </tr>
      {group.accounts.map((account) => (
        <tr key={account.code} className="group bg-white transition-colors hover:bg-blue-50/45">
          <td className={`${appleCell} font-mono font-semibold text-slate-950`}>{account.code}</td>
          <td className={`${appleCell} font-medium text-slate-900`}>{account.name}</td>
          <td className={`${appleCell} text-center font-mono text-slate-500`}>{account.groupCode}</td>
          <td className={`${appleCell} text-right tabular-nums`}>
            {moneyCell(account.opening)}
          </td>
          <td className={`${appleCell} text-right font-medium tabular-nums text-emerald-700`}>
            {formatMoney(account.receipts)}
          </td>
          <td className={`${appleCell} text-right font-medium tabular-nums text-rose-700`}>
            {formatMoney(account.payments)}
          </td>
          <td className={`${appleCell} text-right font-semibold tabular-nums text-slate-950`}>
            {moneyCell(account.closing)}
          </td>
          <td className={`${appleCell} text-right text-[12px] tabular-nums`}>
            {account.anchorBalance === null ? (
              <span className="italic text-amber-700">Chưa nhập</span>
            ) : (
              <>
                {formatMoney(account.anchorBalance)}
                <div className="text-slate-500">ngày {formatDate(account.anchorDate)}</div>
              </>
            )}
          </td>
          <td className={`${appleCell} text-center`}>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                account.isActive
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {account.isActive ? "Đang dùng" : "Ngừng dùng"}
            </span>
          </td>
          {canManage && (
            <td className={`${appleCell} text-center`}>
              <button
                type="button"
                onClick={() => onEdit(account)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
              >
                <Pencil size={12} /> Sửa
              </button>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

function OpeningBalanceModal({
  account,
  onClose,
  onSaved,
}: {
  account: CashAccountRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Chuỗi đang gõ: để trống = chưa nhập (khác 0). Chỉ nhận số nguyên đồng, có thể âm.
  const [balanceText, setBalanceText] = useState(
    account.anchorBalance === null
      ? ""
      : String(Math.trunc(Number(account.anchorBalance))),
  );
  const normalized = balanceText.replace(/[.,\s]/g, "");
  const balanceValid = normalized === "" || /^-?\d{1,16}$/.test(normalized);
  const balance = normalized === "" || !balanceValid ? null : normalized;
  const [date, setDate] = useState(account.anchorDate ?? "");
  const [isActive, setIsActive] = useState(account.isActive);
  const [saving, setSaving] = useState(false);

  const save = async (clearOpening = false) => {
    if (!clearOpening && !balanceValid) {
      toast.error("Số dư gốc chỉ gồm chữ số (có thể có dấu - ở đầu)");
      return;
    }
    if (!clearOpening && (balance === null) !== !date) {
      toast.error("Nhập cả số dư gốc và ngày đối chiếu (hoặc để trống cả hai)");
      return;
    }
    setSaving(true);
    try {
      await cashflowReportApi.updateAccount(account.code, {
        openingBalance: clearOpening || balance === null ? null : balance,
        openingBalanceDate: clearOpening || !date ? null : date,
        isActive,
      });
      toast.success("Đã lưu tài khoản");
      onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được tài khoản"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 backdrop-blur-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {account.code} - {account.name}
            </h3>
            <p className="text-xs text-slate-500">
              Số dư gốc là số dư đã đối chiếu (sổ quỹ / sao kê) tại ĐẦU ngày đối chiếu.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Số dư gốc (đồng)</label>
        <input
          inputMode="numeric"
          value={balanceText}
          onChange={(e) => setBalanceText(e.target.value)}
          placeholder="Chưa nhập"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-right text-[15px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <p className={`mb-3 mt-1 text-xs ${balanceValid ? "text-slate-500" : "text-rose-600"}`}>
          {!balanceValid
            ? "Chỉ nhập chữ số, có thể có dấu - ở đầu"
            : balance === null
              ? "Để trống = chưa xác minh"
              : `= ${Number(balance).toLocaleString("vi-VN")} đ`}
        </p>
        <label className="mb-1 block text-sm font-medium text-slate-700">Ngày đối chiếu</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[15px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Đang sử dụng
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          {account.anchorBalance !== null && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Xoá số dư gốc
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
            onClick={() => save(false)}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
