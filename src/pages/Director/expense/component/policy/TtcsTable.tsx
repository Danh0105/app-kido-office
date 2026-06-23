// components/policy/TtcsTable.tsx

import { MoneyTd, StickyTd, TableHead } from "./TableUI";

type Props = {
  policy: any;
};

export default function TtcsTable({ policy }: Props) {
  const ttcs = policy?.data?.ttcs || [];

  if (!ttcs.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] overflow-hidden shadow-sm ">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-cyan-50 to-white p-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Thông tin cơ sở vật chất
          </h2>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-auto p-1">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <TableHead sticky>Khoản mục</TableHead>

              <TableHead align="right">Mức thu</TableHead>

              <TableHead align="right">CSVC</TableHead>

              <TableHead align="right">Thuế</TableHead>

              <TableHead align="right">Giáo viên</TableHead>

              <TableHead align="right">Tổng %</TableHead>

              <TableHead align="right">Công ty</TableHead>

              <TableHead align="right">QL1</TableHead>

              <TableHead align="right">Thuế</TableHead>

              <TableHead align="right">QL2</TableHead>

              <TableHead align="right">Thuế</TableHead>

              <TableHead align="right">Tổng</TableHead>
            </tr>
          </thead>

          <tbody>
            {ttcs.map((item: any, index: number) => (
              <tr
                key={index}
                className="
                    border-b border-slate-100
                    hover:bg-cyan-50/40
                    transition-colors
                  "
              >
                <StickyTd>
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>

                    <p className="text-xs text-slate-400 mt-1">
                      Thông tin cơ cấu
                    </p>
                  </div>
                </StickyTd>

                <MoneyTd>{item.fee}</MoneyTd>

                <MoneyTd>{item.qlCsvc}</MoneyTd>

                <MoneyTd>{item.tax}</MoneyTd>

                <MoneyTd>{item.teacher}</MoneyTd>

                <MoneyTd>{item.totalPercent}</MoneyTd>

                <MoneyTd>
                  {item.fee - item.qlCsvc - item.tax - item.teacher}
                </MoneyTd>

                <MoneyTd>{item.ql1Percent}</MoneyTd>

                <MoneyTd>{item.ql1Tax}</MoneyTd>

                <MoneyTd>{item.ql2Percent}</MoneyTd>

                <MoneyTd>{item.ql2Tax}</MoneyTd>

                <MoneyTd>
                  {item.ql1Percent +
                    item.ql2Percent -
                    (item.ql1Tax + item.ql2Tax)}
                </MoneyTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
