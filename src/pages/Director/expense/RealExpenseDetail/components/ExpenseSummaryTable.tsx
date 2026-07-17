import { unwrap, arrayFrom } from "./ExpenseSummary";

type Props = {
  data: any;
  subjects: any[];
  school?: any;
};

const amount = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
};

export default function ExpenseSummaryTable({ data, subjects, school }: Props) {
  const payload = unwrap(data);
  const sources = [payload?.summary, payload].filter(Boolean);

  const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
  const schoolItems = arrayFrom(sources, ["schoolExpenseItems", "schoolItems"]);
  const managementItems = arrayFrom(sources, ["managementExpenseItems", "managementItems"]);

  const subjectLabel = (subjectId: number) => {
    const subject = subjects.find((s: any) => Number(s.id) === subjectId);
    return subject ? subject.code || subject.name : "-";
  };

  const rowMap = new Map<
    string,
    {
      subjectId: number;
      rowIndex: number;
      revenue?: any;
      schoolItem?: any;
      managementItem?: any;
    }
  >();

  const addItems = (
    items: any[],
    field: "revenue" | "schoolItem" | "managementItem",
  ) => {
    items.forEach((item, index) => {
      const subjectId = Number(item.subjectId || 0);
      const rowIndex = Number(item.rowIndex ?? index);
      const key = `${subjectId}:${rowIndex}`;
      const row = rowMap.get(key) || { subjectId, rowIndex };

      row[field] = item;
      rowMap.set(key, row);
    });
  };

  addItems(revenues, "revenue");
  addItems(schoolItems, "schoolItem");
  addItems(managementItems, "managementItem");

  const rows = [...rowMap.values()]
    .sort((a, b) => a.subjectId - b.subjectId || a.rowIndex - b.rowIndex)
    .map(({ subjectId, revenue, schoolItem, managementItem }) => {
      const sourceItem = revenue || schoolItem || managementItem || {};

      const invoiceAmount =
        Number(revenue?.invoiceAmount || 0) ||
        Number(revenue?.unitPrice || 0) *
          Number(revenue?.studentCount || 0) *
          Number(revenue?.monthsCount || 0);

      const schoolExpenseAmount =
        Number(schoolItem?.schoolExpenseAmount || 0) ||
        (Number(schoolItem?.teacherUnitPrice || 0) +
          Number(schoolItem?.taxUnitPrice || 0) +
          Number(schoolItem?.csvcUnitPrice || 0)) *
          Number(schoolItem?.studentCount || 0) *
          Number(schoolItem?.monthsCount || 0);

      const managementExpenseAmount =
        Number(managementItem?.totalOutside || managementItem?.totalOutsideExpense || 0) ||
        (Number(managementItem?.ql1UnitPrice || 0) +
          Number(managementItem?.ql2UnitPrice || 0)) *
          Number(managementItem?.studentCount || 0) *
          Number(managementItem?.monthsCount || 0);

      const totalOutsideExpense = schoolExpenseAmount + managementExpenseAmount;
      const paidOutsideExpense =
        Number(schoolItem?.paidAmount || 0) + Number(managementItem?.paidAmount || 0);
      const remainingOutsideExpense = totalOutsideExpense - paidOutsideExpense;

      return {
        subjectLabel: subjectLabel(subjectId),
        content:
          revenue?.content || schoolItem?.content || managementItem?.content || "-",
        totalPeriods: sourceItem.totalPeriods,
        studentCount: sourceItem.studentCount,
        monthsCount: sourceItem.monthsCount,
        invoiceAmount,
        paymentDate: revenue?.paymentDate,
        totalOutsideExpense,
        paidOutsideExpense,
        remainingOutsideExpense,
        expenseDate: schoolItem?.expenseDate || managementItem?.expenseDate,
        payer: schoolItem?.payer || managementItem?.payer,
      };
    });

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Chưa có dữ liệu chi tiết để tổng hợp
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-xl font-black text-slate-900">Bảng tổng hợp chi tiết</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1300px] whitespace-nowrap text-sm">
          <thead>
            <tr className="bg-slate-900 text-white font-bold">
              <th className="px-4 py-3 text-left">STT</th>
              <th className="px-4 py-3 text-left">Tư vấn</th>
              <th className="px-4 py-3 text-left">Phường/Xã</th>
              <th className="px-4 py-3 text-left">Tên trường</th>
              <th className="px-4 py-3 text-left">KNS/STEM</th>
              <th className="px-4 py-3 text-left">Diễn giải thu-chi</th>
              <th className="px-4 py-3 text-right">Số tiết</th>
              <th className="px-4 py-3 text-right">Số học sinh</th>
              <th className="px-4 py-3 text-right">Số tháng thu</th>
              <th className="px-4 py-3 text-right">Số tiền hoá đơn</th>
              <th className="px-4 py-3 text-left">Ngày thu tiền</th>
              <th className="px-4 py-3 text-right">Tổng chi ngoài HĐ</th>
              <th className="px-4 py-3 text-right">Đã chi</th>
              <th className="px-4 py-3 text-right">Còn phải chi ngoài HĐ</th>
              <th className="px-4 py-3 text-left">Ngày chi</th>
              <th className="px-4 py-3 text-left">Người chi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{index + 1}</td>
                <td className="px-4 py-3">{school?.employee?.name || "-"}</td>
                <td className="px-4 py-3">{school?.ward?.name || "-"}</td>
                <td className="px-4 py-3 font-semibold">{school?.name || "-"}</td>
                <td className="px-4 py-3">{row.subjectLabel}</td>
                <td className="px-4 py-3">{row.content}</td>
                <td className="px-4 py-3 text-right">{row.totalPeriods}</td>
                <td className="px-4 py-3 text-right">{row.studentCount}</td>
                <td className="px-4 py-3 text-right">{row.monthsCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">
                  {amount(row.invoiceAmount)}
                </td>
                <td className="px-4 py-3">{formatDate(row.paymentDate)}</td>
                <td className="px-4 py-3 text-right font-semibold text-rose-700">
                  {amount(row.totalOutsideExpense)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  {amount(row.paidOutsideExpense)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-orange-700">
                  {amount(row.remainingOutsideExpense)}
                </td>
                <td className="px-4 py-3">{formatDate(row.expenseDate)}</td>
                <td className="px-4 py-3">{row.payer || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
