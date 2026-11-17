import { invoiceCashAccountGroups } from "../../RealExpenseDetail/utils/invoiceCashAccounts";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Chọn tài khoản trong danh mục "Nguồn thu chi" (111 Tiền mặt / 112 Tiền gửi ngân hàng). */
export default function CashAccountSelect({
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  return (
    <select
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Chọn</option>
      {invoiceCashAccountGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} - {account.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
