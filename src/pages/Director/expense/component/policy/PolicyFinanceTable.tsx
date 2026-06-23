import { BadgeMini, StickyTd, TableHead } from "./TableUI";

type Props = {
  policy: any;
  classCount: number;
};

type FinanceItem = {
  name: string;
  group: string;
  value: number;
  color: string;
  note?: string;
  highlight?: boolean;
  unit?: string;
  showPercent?: boolean;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  });

const percentOfFee = (value: number, fee: number) => {
  const feeValue = Number(fee || 0);
  const rowValue = Number(value || 0);

  return feeValue > 0 ? `${((rowValue / feeValue) * 100).toFixed(1)}%` : "0%";
};

const cellClass = (item: FinanceItem, className = "") =>
  [
    "px-4 py-4 border-b border-slate-100 text-sm text-slate-700 ",
    item.highlight && "bg-emerald-50/40",
    className,
  ]
    .filter(Boolean)
    .join(" ");

export default function PolicyFinanceTable({ policy, classCount }: Props) {
  const data = policy?.data;
  console.log(policy);
  if (!data) return null;

  const fee = Number(data?.fee || 0);
  const items: FinanceItem[] = [
    {
      name: "Học phí",
      group: "Doanh thu",
      value: data?.fee,
      color: "blue",
      note: data?.notes?.fee,
    },
    {
      name: "CSVC",
      group: "Chi phí",
      value: data?.csvc,
      color: "orange",
      note: data?.notes?.csvc,
    },
    {
      name: "Thuế",
      group: "Chi phí",
      value: data?.thue,
      color: "rose",
      note: data?.notes?.thue,
    },
    {
      name: "Giáo viên",
      group: "Chi phí",
      value: data?.giaovien,
      color: "amber",
      note: data?.notes?.giaovien,
    },
    {
      name: "Giáo viên công ty",
      group: "Chi phí",
      value: data?.teacherCompany,
      color: "yellow",
      note: data?.notes?.teacherCompany,
    },
    {
      name: "CS tháng",
      group: "Chi phí ngoài hợp đồng",
      value: data?.csthang,
      color: "cyan",
      note: data?.notes?.csthang,
    },
    {
      name: "CĐHĐ",
      group: "Chi phí",
      value: data?.cdhd,
      color: "purple",
      note: data?.notes?.cdhd,
    },
    {
      name: "Thiết bị",
      group: "Chi phí",
      value: data?.thietbi,
      color: "indigo",
      note: data?.notes?.thietbi,
    },
    {
      name: "Thuế TNDN",
      group: "Chi phí",
      value: data?.thuetndn,
      color: "pink",
      note: data?.notes?.thuetndn,
    },
    {
      name: "Giáo cụ",
      group: "Chi phí",
      value: data?.giaoCu,
      color: "fuchsia",
      note: data?.notes?.giaoCu,
    },
    {
      name: "Vận hành",
      group: "Chi phí",
      value: data?.vanHanh,
      color: "teal",
      note: data?.notes?.vanHanh,
    },
    {
      name: "Lợi nhuận",
      group: "Kết quả",
      value: data?.companyProfit,
      color: "emerald",
      highlight: true,
      note: data?.notes?.companyProfit,
    },
    {
      name: "Tổng số tiết",
      group: "Tổng quan",
      value: data?.periods,
      color: "lime",
      unit: "tiết",
      showPercent: false,
      note: "Thông tin bổ sung",
    },
    {
      name: "Tổng số lớp",
      group: "Tổng quan",
      value: classCount,
      color: "sky",
      unit: "lớp",
      showPercent: false,
      note: "Thông tin bổ sung",
    },
  ];

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
        <table className="w-full min-w-[1700px] border-collapse text-sm">
          <colgroup>
            <col className="w-[220px]" />

            {items.map((item) => (
              <col key={item.name} className="w-[130px]" />
            ))}
          </colgroup>

          <thead className="bg-slate-50">
            <tr>
              <TableHead sticky>Thông tin</TableHead>

              {items.map((item) => (
                <TableHead key={item.name} align="center">
                  {item.name}
                </TableHead>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="transition-colors hover:bg-slate-50">
              <StickyTd>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Nhóm</p>

                  <p className="text-xs text-slate-400 mt-1">
                    Phân loại khoản mục
                  </p>
                </div>
              </StickyTd>

              {items.map((item) => (
                <td key={item.name} className={cellClass(item, "text-center")}>
                  <BadgeMini color={item.color}>{item.group}</BadgeMini>
                </td>
              ))}
            </tr>

            <tr className="transition-colors hover:bg-slate-50">
              <StickyTd>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Giá trị
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Số tiền hoặc số tiết
                  </p>
                </div>
              </StickyTd>

              {items.map((item) => (
                <td key={item.name} className={cellClass(item, "text-center ")}>
                  <span className="font-semibold text-slate-900">
                    {money(item.value)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                </td>
              ))}
            </tr>

            <tr className="transition-colors hover:bg-slate-50">
              <StickyTd>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    % học phí
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Tỷ lệ so với học phí
                  </p>
                </div>
              </StickyTd>

              {items.map((item) => (
                <td key={item.name} className={cellClass(item, "text-center")}>
                  <span className="font-semibold text-slate-700">
                    {item.showPercent === false
                      ? "-"
                      : percentOfFee(item.value, fee)}
                  </span>
                </td>
              ))}
            </tr>

            <tr className="transition-colors hover:bg-slate-50">
              <StickyTd>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Ghi chú
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Diễn giải chi tiết
                  </p>
                </div>
              </StickyTd>

              {items.map((item) => (
                <td
                  key={item.name}
                  className={cellClass(
                    item,
                    "text-center whitespace-normal break-words",
                  )}
                >
                  {item.note ? (
                    <span className="text-xs text-slate-600">{item.note}</span>
                  ) : (
                    "-"
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
