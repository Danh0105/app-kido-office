import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Eye, Pencil, Plus } from "lucide-react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { hrEmployeeApi, type HrBankAccount } from "@/service/hr/hr.api";
import { HrCard, HrEmpty, HrErrorState, HrFormError, HrLoading, buttonPrimary, buttonSecondary } from "../components/HrUi";
import RevealDialog from "../components/RevealDialog";
import { hrCapabilities } from "../lib/hrAccess";
import { validateIdentifier } from "../lib/hrIdentifiers";
import { isNotFound, type EmployeeTabProps } from "./types";

export default function BankTab({
  employee,
  access,
  canEdit,
  cryptoWriteUnavailable,
  cryptoRevealUnavailable,
}: EmployeeTabProps) {
  const queryClient = useQueryClient();
  const key = ["hr", "bank-account", employee.id];
  const bank = useQuery({ queryKey: key, queryFn: () => hrEmployeeApi.bankAccount(employee.id), retry: false });
  const [editing, setEditing] = useState<HrBankAccount | "new" | null>(null);
  const [revealing, setRevealing] = useState(false);
  const canReveal = hrCapabilities(access).canRevealBank;
  const account = bank.data ?? null;
  const empty = bank.isError && isNotFound(bank.error);

  return (
    <HrCard
      title="Tài khoản ngân hàng"
      action={
        canEdit && empty && (
          <button className={buttonPrimary} disabled={cryptoWriteUnavailable} onClick={() => setEditing("new")}>
            <Plus size={16} /> Thêm
          </button>
        )
      }
    >
      {bank.isLoading ? (
        <HrLoading />
      ) : empty ? (
        <HrEmpty title="Chưa có tài khoản ngân hàng" />
      ) : bank.isError ? (
        <HrErrorState error={bank.error} onRetry={() => bank.refetch()} />
      ) : account ? (
        <div className="space-y-3">
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Ngân hàng</dt>
              <dd>
                {account.bankName} <span className="text-gray-400">({account.bankCode})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Chi nhánh</dt>
              <dd>{account.branchName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Chủ tài khoản</dt>
              <dd className="break-words">{account.accountHolderName}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Số tài khoản</dt>
              <dd className="font-mono tracking-wider break-all">{account.accountNumberMasked ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {canReveal && (
              <button className={buttonSecondary} disabled={cryptoRevealUnavailable} onClick={() => setRevealing(true)}>
                <Eye size={14} /> Xem đầy đủ
              </button>
            )}
            {canEdit && (
              <button className={buttonSecondary} disabled={cryptoWriteUnavailable} onClick={() => setEditing(account)}>
                <Pencil size={14} /> Sửa
              </button>
            )}
          </div>
        </div>
      ) : null}

      {editing && (
        <BankForm
          employeeId={employee.id}
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}
      {revealing && (
        <RevealDialog
          title="Xem đầy đủ số tài khoản"
          fieldLabel="Số tài khoản"
          reveal={async (reason) => (await hrEmployeeApi.revealBankAccount(employee.id, reason)).accountNumber}
          onClose={() => setRevealing(false)}
        />
      )}
    </HrCard>
  );
}

function BankForm({
  employeeId,
  account,
  onClose,
  onSaved,
}: {
  employeeId: number;
  account: HrBankAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bankCode, setBankCode] = useState(account?.bankCode ?? "");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [branchName, setBranchName] = useState(account?.branchName ?? "");
  const [holder, setHolder] = useState(account?.accountHolderName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const numberError = accountNumber
    ? validateIdentifier("BANK_ACCOUNT", accountNumber)
    : account
      ? null
      : "Nhập số tài khoản.";
  const invalid =
    !!numberError || !/^[A-Za-z0-9]{2,20}$/.test(bankCode.trim()) || !bankName.trim() || !holder.trim();

  const submit = async () => {
    if (invalid) return;
    setLoading(true);
    setError(null);
    try {
      const base = {
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        branchName: branchName.trim() || null,
        accountHolderName: holder.trim(),
      };
      if (account) {
        await hrEmployeeApi.updateBankAccount(employeeId, {
          version: account.version,
          ...base,
          ...(accountNumber ? { accountNumber } : {}),
        });
      } else {
        await hrEmployeeApi.createBankAccount(employeeId, { ...base, accountNumber });
      }
      setAccountNumber("");
      toast.success(account ? "Đã cập nhật tài khoản ngân hàng." : "Đã thêm tài khoản ngân hàng.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={account ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
      submitLabel={account ? "Lưu" : "Thêm"}
      loading={loading}
      disabled={invalid}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã ngân hàng" required hint="VD: VCB, TCB">
          <input className={inputClass} value={bankCode} maxLength={20} onChange={(e) => setBankCode(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Tên ngân hàng" required>
          <input className={inputClass} value={bankName} maxLength={200} onChange={(e) => setBankName(e.target.value)} />
        </Field>
      </div>
      <Field label="Chi nhánh">
        <input className={inputClass} value={branchName} maxLength={200} onChange={(e) => setBranchName(e.target.value)} />
      </Field>
      <Field label="Chủ tài khoản" required>
        <input className={inputClass} value={holder} maxLength={200} onChange={(e) => setHolder(e.target.value)} />
      </Field>
      <Field
        label="Số tài khoản"
        required={!account}
        hint={account ? `Đang lưu: ${account.accountNumberMasked ?? "—"}. Để trống nếu không đổi.` : undefined}
        error={accountNumber ? numberError ?? undefined : undefined}
      >
        <input
          className={`${inputClass} font-mono`}
          value={accountNumber}
          autoComplete="off"
          spellCheck={false}
          inputMode="numeric"
          maxLength={64}
          onChange={(e) => setAccountNumber(e.target.value)}
        />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}
