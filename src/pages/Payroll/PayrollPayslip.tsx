import { Printer, X } from "lucide-react";

import type { Payroll } from "@/types/payroll";
import {
  formatPayrollDeduction,
  formatPayrollMoney,
  formatPayrollNumber,
} from "./payroll.utils";

type Row = {
  label: string;
  value: number;
  note?: string | null;
  deduction?: boolean;
  strong?: boolean;
};

function SlipTable({ rows }: { rows: Row[] }) {
  return (
    <table className="payroll-slip-table w-full border-collapse text-[12px]">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className={row.strong ? "font-bold" : ""}>
            <td className="border border-slate-300 px-3 py-2">{row.label}</td>
            <td className="w-[30%] border border-slate-300 px-3 py-2 text-right tabular-nums">
              {row.deduction
                ? formatPayrollDeduction(row.value)
                : formatPayrollMoney(row.value)}
            </td>
            <td className="w-[32%] border border-slate-300 px-3 py-2 text-slate-500">
              {row.note || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PayrollPayslip({
  payroll,
  onClose,
}: {
  payroll: Payroll;
  onClose: () => void;
}) {
  const department = payroll.employee?.department?.name || "—";

  return (
    <div className="payroll-modal fixed inset-0 z-[10000] overflow-y-auto bg-black/50 p-3 md:p-8">
      <div className="payroll-print-shell mx-auto max-w-[850px] bg-white shadow-2xl">
        <div className="payroll-no-print flex items-center justify-end gap-2 border-b px-4 py-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer size={16} /> In phiếu
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <article className="payroll-print-root px-5 py-6 text-slate-900 md:px-12 md:py-10">
          <header className="border-b-2 border-slate-800 pb-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Kido Skill
            </p>
            <h1 className="mt-3 bg-[#ffd84d] px-4 py-3 text-xl font-black uppercase md:text-2xl">
              Phiếu lương tháng {payroll.month}/{payroll.year}
            </h1>
          </header>

          <section className="grid grid-cols-1 gap-x-8 gap-y-2 py-5 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Họ và tên:</span> {payroll.employeeName}</p>
            <p><span className="font-semibold">Chức vụ:</span> {payroll.jobTitle || "—"}</p>
            <p><span className="font-semibold">Phòng ban:</span> {department}</p>
            <p><span className="font-semibold">Mã nhân viên:</span> {payroll.employeeId}</p>
          </section>

          <section className="mb-5">
            <h2 className="mb-2 bg-slate-100 px-3 py-2 text-sm font-bold uppercase">
              I. Ngày công và phép
            </h2>
            <div className="grid grid-cols-2 border-l border-t border-slate-300 text-[12px] md:grid-cols-3">
              {[
                ["Ngày công chuẩn", payroll.standardWorkingDays],
                ["Ngày công thử việc", payroll.probationWorkingDays],
                ["Ngày công chính thức", payroll.officialWorkingDays],
                ["Nghỉ phép năm", payroll.annualLeaveDays],
                ["Nghỉ lễ", payroll.holidayDays],
                ["Nghỉ không lương", payroll.unpaidLeaveDays],
                ["Số tiết vượt", payroll.excessPeriods],
                ["Phép còn năm trước", payroll.remainingLeavePreviousYear],
                ["Phép còn năm nay", payroll.remainingLeaveCurrentYear],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-b border-r border-slate-300 px-3 py-2">
                  <span className="text-slate-500">{label}</span>
                  <strong className="float-right tabular-nums">{formatPayrollNumber(value as number)}</strong>
                </div>
              ))}
            </div>
            {payroll.leaveNote && (
              <p className="border border-t-0 border-slate-300 px-3 py-2 text-xs">
                <span className="font-semibold">Ghi chú nghỉ:</span> {payroll.leaveNote}
              </p>
            )}
          </section>

          <section className="mb-5">
            <h2 className="mb-2 bg-slate-100 px-3 py-2 text-sm font-bold uppercase">
              II. Thành phần lương
            </h2>
            <SlipTable
              rows={[
                { label: "Mức lương", value: payroll.baseSalary, note: "Tham chiếu" },
                { label: "Lương ngày công chính thức", value: payroll.officialWorkSalary },
                { label: "Lương ngày công thử việc", value: payroll.probationWorkSalary },
                { label: "Phụ cấp xăng xe", value: payroll.fuelAllowance },
                { label: "Phụ cấp tăng ca", value: payroll.overtimeAllowance },
                { label: "Phụ cấp vượt tiết", value: payroll.excessPeriodAllowance },
                { label: "Hỗ trợ khác", value: payroll.otherSupport },
                { label: "Thưởng", value: payroll.bonus },
                { label: "Tổng thu nhập", value: payroll.totalIncome, strong: true },
              ]}
            />
          </section>

          <section className="mb-5">
            <h2 className="mb-2 bg-slate-100 px-3 py-2 text-sm font-bold uppercase">
              III. Các khoản khấu trừ
            </h2>
            <SlipTable
              rows={[
                { label: "BHXH + BHYT + BHTN", value: payroll.socialInsurance, deduction: true },
                { label: "Thuế thu nhập cá nhân", value: payroll.personalIncomeTax, deduction: true },
                {
                  label: "Truy thu / truy lãnh",
                  value: payroll.adjustmentAmount,
                  note: payroll.adjustmentNote,
                  deduction: true,
                },
                { label: "Tạm ứng đã chi", value: payroll.advancePayment, deduction: true },
                { label: "Tổng khấu trừ", value: payroll.totalDeduction, deduction: true, strong: true },
              ]}
            />
          </section>

          <div className="flex items-center justify-between gap-4 bg-[#ffd84d] px-4 py-4 text-base font-black uppercase md:text-xl">
            <span>Lương thực nhận</span>
            <span className="tabular-nums">{formatPayrollMoney(payroll.netSalary)} VNĐ</span>
          </div>

          {payroll.note && (
            <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Ghi chú:</span> {payroll.note}
            </p>
          )}

          <footer className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="font-bold">Người lập phiếu</p>
              <p className="mt-14">{payroll.createdByName || ""}</p>
            </div>
            <div>
              <p className="font-bold">Người nhận</p>
              <p className="mt-14">{payroll.employeeName}</p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
