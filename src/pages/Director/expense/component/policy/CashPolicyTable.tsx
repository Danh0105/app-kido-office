// components/policy/CashPolicyTable.tsx

import {
  BadgeMini,
  CenterTd,
  MoneyTd,
  StickyTd,
  TableHead,
  Td,
} from "./TableUI";

type Props = {
  policy: any;
};

export default function CashPolicyTable({ policy }: Props) {
  const items = policy?.data?.httienmat || [];

  if (!items.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] overflow-hidden shadow-sm">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hỗ trợ tiền mặt</h2>

          <p className="text-sm text-slate-500 mt-1">
            Theo dõi các khoản hỗ trợ tiền mặt
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-auto p-2">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <TableHead sticky>Loại hỗ trợ</TableHead>

              <TableHead align="center">Nhóm</TableHead>

              <TableHead align="center">Số tiền</TableHead>

              <TableHead align="center">Tháng</TableHead>

              <TableHead align="center">HS dự kiến</TableHead>

              <TableHead align="center">Tiết dự kiến</TableHead>

              <TableHead align="center">HS thực tế</TableHead>

              <TableHead align="center">Tiết thực tế</TableHead>
            </tr>
          </thead>

          <tbody>
            {items.map((item: any, index: number) => (
              <tr
                key={index}
                className="
                    border-b border-slate-100
                    hover:bg-emerald-50/40
                    transition-colors
                  "
              >
                <StickyTd>
                  <div>
                    <p className="font-semibold text-slate-800">{item.type}</p>

                    <p className="text-xs text-slate-400 mt-1">
                      Chính sách tiền mặt
                    </p>
                  </div>
                </StickyTd>

                <Td align="center">
                  <BadgeMini color="emerald">Tiền mặt</BadgeMini>
                </Td>

                <MoneyTd align="center">{item.money}</MoneyTd>

                <CenterTd>{item.months}</CenterTd>

                <CenterTd>{item.students}</CenterTd>

                <CenterTd>{item.periods}</CenterTd>

                <CenterTd>{item.realStudents}</CenterTd>

                <CenterTd>{item.realPeriods}</CenterTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
