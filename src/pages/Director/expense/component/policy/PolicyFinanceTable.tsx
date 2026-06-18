import {
  BadgeMini,
  CenterTd,
  FinanceRow,
  MoneyTd,
  StickyTd,
  TableHead,
  Td,
} from "./TableUI";

type Props = {
  policy: any;
};

export default function PolicyFinanceTable({ policy }: Props) {
  const data = policy?.data;
  console.log(
    "🚀 ~ file: PolicyFinanceTable.tsx:9 ~ PolicyFinanceTable ~ data:",
    data,
  );
  if (!data) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] overflow-hidden shadow-sm">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Chi phí vận hành
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Tổng hợp doanh thu, chi phí và lợi nhuận
            </p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-auto p-2">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <TableHead sticky>Khoản mục</TableHead>

              <TableHead>Nhóm</TableHead>

              <TableHead align="right">Giá trị</TableHead>

              <TableHead align="center">% học phí</TableHead>

              <TableHead align="center">Ghi chú</TableHead>
            </tr>
          </thead>

          <tbody>
            <FinanceRow
              name="Học phí"
              group="Doanh thu"
              value={data?.fee}
              fee={data?.fee}
              color="blue"
              note={data?.notes?.fee}
            />

            <FinanceRow
              name="CSVC"
              group="Chi phí"
              value={data?.csvc}
              fee={data?.fee}
              color="orange"
              note={data?.notes?.csvc}
            />
            <FinanceRow
              name="Thuế"
              group="Chi phí"
              value={data?.thue}
              fee={data?.fee}
              color="rose"
              note={data?.notes?.thue}
            />

            <FinanceRow
              name="Giáo viên"
              group="Chi phí"
              value={data?.giaovien}
              fee={data?.fee}
              color="amber"
              note={data?.notes?.giaovien}
            />

            <FinanceRow
              name="CS tháng"
              group="Chi phí"
              value={data?.csthang}
              fee={data?.fee}
              color="cyan"
              note={data?.notes?.csthang}
            />

            <FinanceRow
              name="CĐHĐ"
              group="Chi phí"
              value={data?.cdhd}
              fee={data?.fee}
              color="purple"
              note={data?.notes?.cdhd}
            />

            <FinanceRow
              name="Thiết bị"
              group="Chi phí"
              value={data?.thietbi}
              fee={data?.fee}
              color="indigo"
              note={data?.notes?.thietbi}
            />

            <FinanceRow
              name="Thuế TNDN"
              group="Chi phí"
              value={data?.thuetndn}
              fee={data?.fee}
              color="pink"
              note={data?.notes?.thuetndn}
            />

            <FinanceRow
              name="Giáo cụ"
              group="Chi phí"
              value={data?.giaoCu}
              fee={data?.fee}
              color="pink"
              note={data?.notes?.giaoCu}
            />
            <FinanceRow
              name="Vận hành"
              group="Chi phí"
              value={data?.vanHanh}
              fee={data?.fee}
              color="slate"
              note={data?.notes?.vanHanh}
            />

            <FinanceRow
              name="Lợi nhuận"
              group="Kết quả"
              value={data?.companyProfit}
              fee={data?.fee}
              color="emerald"
              highlight
              note={data?.notes?.companyProfit}
            />

            {/* EXTRA */}
            <tr className="text-sm border-t border-slate-200 bg-slate-50/70">
              <StickyTd>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Tổng số tiết
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Thông tin bổ sung
                  </p>
                </div>
              </StickyTd>

              <Td>
                <BadgeMini color="slate">Tổng quan</BadgeMini>
              </Td>

              <MoneyTd>{data?.periods}</MoneyTd>

              <CenterTd>tiết</CenterTd>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
