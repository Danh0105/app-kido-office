// components/cash-policy/CashPolicyTable.tsx

import CashPolicyRow from "./CashPolicyRow";

type CashPolicyRowType = {
  payer: string;
  cashPolicyAmount: string;
  otherAmount: string;
  paymentDate: string;
  note: string;
};

type Props = {
  cashPolicyRows: CashPolicyRowType[];

  updateCashPolicyRow: (
    index: number,
    field: keyof CashPolicyRowType,
    value: string,
  ) => void;

  removeCashPolicyRow: (index: number) => void;
};

const headers = [
  "Người chi",
  "CS tiền mặt",
  "Chi khác",
  "Ngày chi",
  "Ghi chú",
  "",
];

export default function CashPolicyEditorTable({
  cashPolicyRows,
  updateCashPolicyRow,
  removeCashPolicyRow,
}: Props) {
  return (
    <div className="overflow-auto max-h-[70vh]">
      <div className="min-w-[1450px]">
        {/* HEADER */}
        <div
          className="
            sticky top-0 z-30

            grid
            grid-cols-[260px_180px_180px_180px_1fr_90px]

            bg-gradient-to-r
            from-slate-800
            via-slate-700
            to-slate-800

            text-white
            text-[13px]
            font-bold
            uppercase
            tracking-wide
          "
        >
          {headers.map((label, index) => (
            <div
              key={index}
              className="
                h-14 px-4
                flex items-center

                border-r border-slate-600/50
                last:border-r-0
              "
            >
              {label}
            </div>
          ))}
        </div>

        {/* BODY */}
        <div className="divide-y divide-slate-100 bg-white">
          {cashPolicyRows.map((row, index) => (
            <CashPolicyRow
              key={index}
              row={row}
              index={index}
              updateCashPolicyRow={updateCashPolicyRow}
              removeCashPolicyRow={removeCashPolicyRow}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
