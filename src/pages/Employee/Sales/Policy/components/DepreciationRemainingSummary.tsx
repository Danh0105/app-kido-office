import { formatVND } from "../../../../../utils/formatVND";

type MoneyRow = {
  money?: number;
  depreciationYears?: number;
};

type DeviceRow = {
  qty?: number;
  price?: number;
  depreciationYears?: number;
};

const remainingAfterDepreciation = (amount: number, years: number) =>
  amount > 0 && years > 0 ? amount - amount / years : 0;

export const calculateDepreciationRemainingTotals = (
  moneyRows: MoneyRow[],
  deviceRows: DeviceRow[],
) => {
  const remainingMoney = moneyRows.reduce(
    (sum, row) =>
      sum +
      remainingAfterDepreciation(
        Number(row.money) || 0,
        Number(row.depreciationYears) || 0,
      ),
    0,
  );

  const remainingDevice = deviceRows.reduce((sum, row) => {
    const amount = (Number(row.qty) || 0) * (Number(row.price) || 0);
    return (
      sum +
      remainingAfterDepreciation(
        amount,
        Number(row.depreciationYears) || 0,
      )
    );
  }, 0);

  return {
    remainingMoney: Math.round(remainingMoney),
    remainingDevice: Math.round(remainingDevice),
  };
};

export default function DepreciationRemainingSummary({
  moneyRows,
  deviceRows,
  savedRemainingMoney,
  savedRemainingDevice,
}: {
  moneyRows: MoneyRow[];
  deviceRows: DeviceRow[];
  savedRemainingMoney?: number | null;
  savedRemainingDevice?: number | null;
}) {
  const calculated = calculateDepreciationRemainingTotals(
    moneyRows,
    deviceRows,
  );
  const remainingMoney =
    savedRemainingMoney == null
      ? calculated.remainingMoney
      : Number(savedRemainingMoney) || 0;
  const remainingDevice =
    savedRemainingDevice == null
      ? calculated.remainingDevice
      : Number(savedRemainingDevice) || 0;

  return (
    <div className="mx-auto mt-3 max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
        <div className="bg-white px-4 py-3 sm:px-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tổng tiền còn khấu hao
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-blue-700">
            {formatVND(remainingMoney)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            = Số tiền − Số tiền khấu hao
          </div>
        </div>

        <div className="bg-white px-4 py-3 sm:px-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tổng tiền thiết bị còn khấu hao
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-violet-700">
            {formatVND(remainingDevice)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            = Thành tiền thiết bị − Số tiền khấu hao
          </div>
        </div>
      </div>
    </div>
  );
}
