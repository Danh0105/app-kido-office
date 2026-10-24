import { useState } from "react";
import { toast } from "react-hot-toast";
import { Pencil, X } from "lucide-react";
import {
  cashflowReportApi,
  type CashAccountGroup,
  type CashAccountRow,
} from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, formatMoney } from "./cashflowFormat";

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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold text-slate-900">Danh mục các tài khoản</h2>
        <p className="text-xs text-slate-500">
          Số dư đầu kỳ = số dư gốc đã đối chiếu ± phát sinh từ ngày đối chiếu tới đầu kỳ.
          Tài khoản chưa có số dư gốc hiển thị "Chưa xác minh" (không coi là 0).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead className="bg-slate-900 text-xs text-white">
            <tr>
              {[
                "Mã TK",
                "Tên tài khoản",
                "Nhóm",
                "Số dư đầu kỳ",
                "Thu trong kỳ",
                "Chi trong kỳ",
                "Số dư cuối kỳ",
                "Số dư gốc (ngày đối chiếu)",
                "Trạng thái",
              ].map((label) => (
                <th key={label} className="border border-slate-700 px-2 py-2 font-semibold">
                  {label}
                </th>
              ))}
              {canManage && <th className="border border-slate-700 px-2 py-2" />}
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
    </div>
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
      <tr className="bg-slate-100 font-semibold">
        <td className="border border-slate-200 px-2 py-2">{group.groupCode}</td>
        <td className="border border-slate-200 px-2 py-2" colSpan={2}>
          {group.name}
        </td>
        <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">
          {moneyCell(group.subtotal.opening)}
        </td>
        <td className="border border-slate-200 px-2 py-2 text-right tabular-nums text-emerald-800">
          {formatMoney(group.subtotal.receipts)}
        </td>
        <td className="border border-slate-200 px-2 py-2 text-right tabular-nums text-rose-800">
          {formatMoney(group.subtotal.payments)}
        </td>
        <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">
          {moneyCell(group.subtotal.closing)}
        </td>
        <td className="border border-slate-200 px-2 py-2 text-xs font-normal text-slate-500" colSpan={canManage ? 3 : 2}>
          {group.subtotal.unverifiedAccounts.length > 0 &&
            `${group.subtotal.unverifiedAccounts.length} TK chưa có số dư gốc`}
        </td>
      </tr>
      {group.accounts.map((account) => (
        <tr key={account.code} className="hover:bg-slate-50">
          <td className="border border-slate-200 px-2 py-2 font-medium">{account.code}</td>
          <td className="border border-slate-200 px-2 py-2">{account.name}</td>
          <td className="border border-slate-200 px-2 py-2 text-center">{account.groupCode}</td>
          <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">
            {moneyCell(account.opening)}
          </td>
          <td className="border border-slate-200 px-2 py-2 text-right tabular-nums text-emerald-700">
            {formatMoney(account.receipts)}
          </td>
          <td className="border border-slate-200 px-2 py-2 text-right tabular-nums text-rose-700">
            {formatMoney(account.payments)}
          </td>
          <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-semibold">
            {moneyCell(account.closing)}
          </td>
          <td className="border border-slate-200 px-2 py-2 text-right tabular-nums text-xs">
            {account.anchorBalance === null ? (
              <span className="italic text-amber-700">Chưa nhập</span>
            ) : (
              <>
                {formatMoney(account.anchorBalance)}
                <div className="text-slate-500">ngày {formatDate(account.anchorDate)}</div>
              </>
            )}
          </td>
          <td className="border border-slate-200 px-2 py-2 text-center">
            <span
              className={`px-2 py-[2px] rounded-full text-xs font-medium ${
                account.isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {account.isActive ? "Đang dùng" : "Ngừng dùng"}
            </span>
          </td>
          {canManage && (
            <td className="border border-slate-200 px-2 py-2 text-center">
              <button
                type="button"
                onClick={() => onEdit(account)}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {account.code} - {account.name}
            </h3>
            <p className="text-xs text-slate-500">
              Số dư gốc là số dư đã đối chiếu (sổ quỹ / sao kê) tại ĐẦU ngày đối chiếu.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Số dư gốc (đồng)</label>
        <input
          inputMode="numeric"
          value={balanceText}
          onChange={(e) => setBalanceText(e.target.value)}
          placeholder="Chưa nhập"
          className="h-10 w-full rounded-lg border px-3 text-right"
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
          className="mb-3 h-10 w-full rounded-lg border px-3"
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
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
            >
              Xoá số dư gốc
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm text-slate-700"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
