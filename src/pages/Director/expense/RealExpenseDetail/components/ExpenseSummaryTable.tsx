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

const findItem = (items: any[], subjectId: number, rowIndex: number) =>
  items.find(
    (item) =>
      Number(item.subjectId) === Number(subjectId) &&
      Number(item.rowIndex ?? 0) === Number(rowIndex),
  );

export default function ExpenseSummaryTable({ data, subjects, school }: Props) {
  const payload = unwrap(data);
  const sources = [payload?.summary, payload].filter(Boolean);

  const revenues = arrayFrom(sources, ["revenueItems", "revenues"]);
  const schoolItems = arrayFrom(sources, ["schoolExpenseItems", "schoolItems"]);
  const managementItems = arrayFrom(sources, ["managementExpenseItems", "managementItems"]);

  const subjectLabel = (subjectId: number) => {
    const subject = subjects.find((s: any) => s.id === subjectId);
    return subject ? subject.code || subject.name : "-";
  };

  const rows = [...revenues]
    .sort(
      (a, b) =>
        Number(a.subjectId) - Number(b.subjectId) ||
        Number(a.rowIndex ?? 0) - Number(b.rowIndex ?? 0),
    )
    .map((revenue) => {
      const schoolItem = findItem(schoolItems, revenue.subjectId, revenue.rowIndex ?? 0);
      const managementItem = findItem(
        managementItems,
        revenue.subjectId,
        revenue.rowIndex ?? 0,
      );

      const invoiceAmount =
        Number(revenue.invoiceAmount || 0) ||
        Number(revenue.unitPrice || 0) *
          Number(revenue.studentCount || 0) *
          Number(revenue.monthsCount || 0);

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
        subjectLabel: subjectLabel(revenue.subjectId),
        content: revenue.content || "-",
        totalPeriods: revenue.totalPeriods,
        studentCount: revenue.studentCount,
        monthsCount: revenue.monthsCount,
        invoiceAmount,
        paymentDate: revenue.paymentDate,
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
