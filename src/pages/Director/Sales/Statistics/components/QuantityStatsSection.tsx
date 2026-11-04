import { Calculator, Clock3, GraduationCap, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { SchoolQuantitySummary } from "../quantityStats";

type Props = {
  rows: SchoolQuantitySummary[];
  loading?: boolean;
  accountingAvailable?: boolean;
  error?: string;
};

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export default function QuantityStatsSection({
  rows,
  loading = false,
  accountingAvailable = true,
  error = "",
}: Props) {
  const canShowAccounting = accountingAvailable && !error;
  const totals = rows.reduce(
    (result, row) => ({
      policyStudents: result.policyStudents + row.policyStudents,
      policyPeriods: result.policyPeriods + row.policyPeriods,
      accountingStudents: result.accountingStudents + row.accountingStudents,
      accountingPeriods: result.accountingPeriods + row.accountingPeriods,
    }),
    {
      policyStudents: 0,
      policyPeriods: 0,
      accountingStudents: 0,
      accountingPeriods: 0,
    },
  );

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
            Tổng hợp theo trường
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-black">
            <GraduationCap size={23} />
            Số học sinh / số tiết
          </h2>
          <p className="mt-1 text-sm text-blue-100">
            Đối chiếu số liệu kinh doanh khai trong chính sách và số liệu kế
            toán nhập.
          </p>
        </div>
        <div className="rounded-xl bg-white/15 px-5 py-2 text-center backdrop-blur">
          <p className="text-xs text-blue-100">Trường</p>
          <p className="text-2xl font-black">{rows.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm font-semibold text-slate-500">
          <Loader2 size={20} className="animate-spin text-blue-600" />
          Đang tải số liệu kế toán...
        </div>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={<GraduationCap size={18} />}
              label="HS kinh doanh"
              value={formatQuantity(totals.policyStudents)}
              className="bg-blue-50 text-blue-700"
            />
            <SummaryCard
              icon={<Clock3 size={18} />}
              label="Tiết kinh doanh"
              value={formatQuantity(totals.policyPeriods)}
              className="bg-indigo-50 text-indigo-700"
            />
            <SummaryCard
              icon={<Calculator size={18} />}
              label="HS kế toán"
              value={
                canShowAccounting
                  ? formatQuantity(totals.accountingStudents)
                  : "—"
              }
              className="bg-emerald-50 text-emerald-700"
            />
            <SummaryCard
              icon={<Clock3 size={18} />}
              label="Tiết kế toán"
              value={
                canShowAccounting
                  ? formatQuantity(totals.accountingPeriods)
                  : "—"
              }
              className="bg-teal-50 text-teal-700"
            />
          </div>

          {!accountingAvailable && (
            <p className="mx-4 mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Tài khoản hiện tại không có quyền xem số liệu kế toán.
            </p>
          )}

          {error && (
            <p className="mx-4 mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {rows.length > 0 ? (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th rowSpan={2} className="px-4 py-3 text-left">
                      Trường
                    </th>
                    <th
                      colSpan={2}
                      className="border-l border-slate-700 px-4 py-2 text-center"
                    >
                      Kinh doanh nhập
                    </th>
                    <th
                      colSpan={2}
                      className="border-l border-slate-700 px-4 py-2 text-center"
                    >
                      Kế toán nhập
                    </th>
                    <th
                      colSpan={2}
                      className="border-l border-slate-700 px-4 py-2 text-center"
                    >
                      Chênh lệch
                    </th>
                  </tr>
                  <tr className="text-xs text-slate-200">
                    <th className="border-l border-slate-700 px-4 py-2 text-right">
                      Học sinh
                    </th>
                    <th className="px-4 py-2 text-right">Số tiết</th>
                    <th className="border-l border-slate-700 px-4 py-2 text-right">
                      Học sinh
                    </th>
                    <th className="px-4 py-2 text-right">Số tiết</th>
                    <th className="border-l border-slate-700 px-4 py-2 text-right">
                      Học sinh
                    </th>
                    <th className="px-4 py-2 text-right">Số tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr
                      key={row.schoolId}
                      className="transition hover:bg-blue-50/50"
                    >
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {row.schoolName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">
                        {formatQuantity(row.policyStudents)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                        {formatQuantity(row.policyPeriods)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {canShowAccounting
                          ? formatQuantity(row.accountingStudents)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">
                        {canShowAccounting
                          ? formatQuantity(row.accountingPeriods)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">
                        {canShowAccounting
                          ? formatQuantity(
                              row.accountingStudents - row.policyStudents,
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">
                        {canShowAccounting
                          ? formatQuantity(
                              row.accountingPeriods - row.policyPeriods,
                            )
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-800">
                  <tr>
                    <td className="px-4 py-3">Tổng cộng</td>
                    <td className="px-4 py-3 text-right">
                      {formatQuantity(totals.policyStudents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatQuantity(totals.policyPeriods)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canShowAccounting
                        ? formatQuantity(totals.accountingStudents)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canShowAccounting
                        ? formatQuantity(totals.accountingPeriods)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canShowAccounting
                        ? formatQuantity(
                            totals.accountingStudents - totals.policyStudents,
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canShowAccounting
                        ? formatQuantity(
                            totals.accountingPeriods - totals.policyPeriods,
                          )
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              Không có dữ liệu phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-bold uppercase">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
