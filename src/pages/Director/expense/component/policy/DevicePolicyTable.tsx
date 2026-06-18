// components/policy/PolicyFinanceTable.tsx
// components/policy/DevicePolicyTable.tsx

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

export default function DevicePolicyTable({ policy }: Props) {
  const items = policy?.data?.htthietbi || [];

  if (!items.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] overflow-hidden shadow-sm">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hỗ trợ thiết bị</h2>

          <p className="text-sm text-slate-500 mt-1">
            Theo dõi thiết bị và tài sản hỗ trợ
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-auto p-2">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <TableHead sticky>Thiết bị</TableHead>

              <TableHead>Nhóm</TableHead>

              <TableHead align="center">SL</TableHead>

              <TableHead align="right">Giá</TableHead>

              <TableHead align="center">Tháng</TableHead>

              <TableHead align="center">HS dự kiến</TableHead>

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
                    hover:bg-indigo-50/40
                    transition-colors
                  "
              >
                <StickyTd>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {item.category}
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      Thiết bị hỗ trợ
                    </p>
                  </div>
                </StickyTd>

                <Td>
                  <BadgeMini color="indigo">Thiết bị</BadgeMini>
                </Td>

                <CenterTd>{item.qty}</CenterTd>

                <MoneyTd>{item.price}</MoneyTd>

                <CenterTd>{item.months}</CenterTd>

                <CenterTd>{item.students}</CenterTd>

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
