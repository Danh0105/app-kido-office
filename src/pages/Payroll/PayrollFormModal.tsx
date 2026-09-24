import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "react-hot-toast";

import DecimalInput from "@/components/DecimalInput";
import SearchableSelect from "@/components/SearchableSelect";
import type { Employee } from "@/service/employee";
import { payrollApi } from "@/service/payroll";
import type {
  CreatePayrollPayload,
  Payroll,
  PayrollNumberField,
  UpdatePayrollPayload,
} from "@/types/payroll";
import { PAYROLL_NUMBER_FIELDS } from "@/types/payroll";
import {
  calculatePayrollPreview,
  currentPayrollPeriod,
  formatPayrollMoney,
} from "./payroll.utils";

/** Hai khoản phát sinh riêng theo từng tháng — không tự mang sang tháng kế tiếp. */
const NON_RECURRING_FIELDS: PayrollNumberField[] = ["adjustmentAmount", "advancePayment"];

const FIELD_GROUPS: {
  title: string;
  hint?: string;
  fields: { key: PayrollNumberField; label: string; allowNegative?: boolean }[];
}[] = [
  {
    title: "Ngày công và phép",
    fields: [
      { key: "standardWorkingDays", label: "Ngày công chuẩn" },
      { key: "probationWorkingDays", label: "Ngày công thử việc" },
      { key: "officialWorkingDays", label: "Ngày công chính thức" },
      { key: "annualLeaveDays", label: "Nghỉ phép năm" },
      { key: "holidayDays", label: "Nghỉ lễ" },
      { key: "unpaidLeaveDays", label: "Nghỉ không lương" },
      { key: "excessPeriods", label: "Số tiết vượt" },
      { key: "remainingLeavePreviousYear", label: "Phép còn năm trước" },
      { key: "remainingLeaveCurrentYear", label: "Phép còn năm nay" },
    ],
  },
  {
    title: "Thành phần lương",
    hint: "Mức lương chỉ là giá trị tham chiếu, không cộng trực tiếp vào tổng thu nhập.",
    fields: [
      { key: "baseSalary", label: "Mức lương" },
      { key: "officialWorkSalary", label: "Lương ngày công chính thức" },
      { key: "probationWorkSalary", label: "Lương ngày công thử việc" },
      { key: "fuelAllowance", label: "Phụ cấp xăng xe" },
      { key: "overtimeAllowance", label: "Phụ cấp tăng ca" },
      { key: "excessPeriodAllowance", label: "Phụ cấp vượt tiết" },
      { key: "otherSupport", label: "Hỗ trợ khác" },
      { key: "bonus", label: "Thưởng" },
    ],
  },
  {
    title: "Các khoản khấu trừ",
    hint: "Truy thu nhập số dương; truy lãnh nhập số âm.",
    fields: [
      { key: "socialInsurance", label: "BHXH + BHYT + BHTN" },
      { key: "personalIncomeTax", label: "Thuế thu nhập cá nhân" },
      { key: "adjustmentAmount", label: "Truy thu / truy lãnh", allowNegative: true },
      { key: "advancePayment", label: "Tạm ứng đã chi" },
    ],
  },
];

const blankNumbers = () =>
  Object.fromEntries(PAYROLL_NUMBER_FIELDS.map((field) => [field, 0])) as Record<
    PayrollNumberField,
    number
  >;

export default function PayrollFormModal({
  payroll,
  employees,
  onClose,
  onSubmit,
}: {
  payroll: Payroll | null;
  employees: Employee[];
  onClose: () => void;
  onSubmit: (payload: CreatePayrollPayload | UpdatePayrollPayload) => Promise<void>;
}) {
  const initialPeriod = currentPayrollPeriod();
  const [employeeId, setEmployeeId] = useState(payroll ? String(payroll.employeeId) : "");
  const [month, setMonth] = useState(payroll?.month ?? initialPeriod.month);
  const [year, setYear] = useState(payroll?.year ?? initialPeriod.year);
  const [numbers, setNumbers] = useState<Record<PayrollNumberField, number>>(() => {
    const values = blankNumbers();
    if (payroll) {
      PAYROLL_NUMBER_FIELDS.forEach((field) => {
        values[field] = Number(payroll[field] ?? 0);
      });
    }
    return values;
  });
  const [jobTitle, setJobTitle] = useState(payroll?.jobTitle || "");
  const [leaveNote, setLeaveNote] = useState(payroll?.leaveNote || "");
  const [adjustmentNote, setAdjustmentNote] = useState(payroll?.adjustmentNote || "");
  const [note, setNote] = useState(payroll?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [prefilledPeriod, setPrefilledPeriod] = useState<{ month: number; year: number } | null>(null);
  const [fuelAllowanceLoading, setFuelAllowanceLoading] = useState(false);
  const totals = useMemo(() => calculatePayrollPreview(numbers), [numbers]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === employeeId),
    [employees, employeeId],
  );
  // Giáo viên công ty nhận xăng xe theo khoảng cách chốt trên từng buổi dạy
  // đã chấm công "Có dạy" — không nhập tay để tránh lệch với chấm công thật.
  const isCompanyTeacher = !!selectedEmployee?.roles?.includes("giaovien_congty");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  // Đọc tháng/năm mới nhất mà không bắt effect bên dưới chạy lại mỗi khi
  // người dùng đổi tháng/năm — chỉ áp dụng dữ liệu tháng trước một lần, ngay
  // khi chọn nhân viên, dựa trên kỳ đang chọn tại thời điểm đó.
  const periodRef = useRef({ month, year });
  useEffect(() => {
    periodRef.current = { month, year };
  }, [month, year]);

  // Tạo phiếu mới cho một nhân viên: tự lấy dữ liệu phiếu tháng liền trước
  // (nếu có) để điền sẵn — người dùng vẫn chỉnh sửa được mọi trường trước khi
  // lưu. Các khoản phát sinh riêng theo tháng (truy thu/truy lãnh, tạm ứng)
  // không được mang sang.
  useEffect(() => {
    if (payroll || !employeeId) return;
    let cancelled = false;
    setPrefilledPeriod(null);
    const { month: currentMonth, year: currentYear } = periodRef.current;
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    // Xăng xe của giáo viên công ty do effect chấm công bên dưới tự tính —
    // không copy số cũ từ tháng trước, kẻo đè lên/đụng race với fetch đó.
    const employeeIsCompanyTeacher = employees
      .find((employee) => String(employee.id) === employeeId)
      ?.roles?.includes("giaovien_congty");

    payrollApi
      .list({ employeeId: Number(employeeId), month: prevMonth, year: prevYear, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        const previous = result.data[0];
        if (!previous) return;

        setNumbers((current) => {
          const next = { ...current };
          PAYROLL_NUMBER_FIELDS.forEach((field) => {
            if (NON_RECURRING_FIELDS.includes(field)) return;
            if (field === "fuelAllowance" && employeeIsCompanyTeacher) return;
            next[field] = Number(previous[field] ?? 0);
          });
          return next;
        });
        setJobTitle(previous.jobTitle || "");
        setPrefilledPeriod({ month: prevMonth, year: prevYear });
        toast.success(
          `Đã áp dụng thông tin lương từ tháng ${prevMonth}/${prevYear}, bạn có thể điều chỉnh trước khi lưu.`,
        );
      })
      .catch(() => {
        // Không tìm được phiếu tháng trước — giữ nguyên biểu mẫu trống, không báo lỗi.
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, payroll]);

  // Phụ cấp xăng xe của giáo viên công ty: luôn lấy từ tổng chấm công thật,
  // kể cả khi sửa phiếu — chấm công có thể được cập nhật sau khi tạo phiếu.
  useEffect(() => {
    if (!employeeId || !isCompanyTeacher) return;
    let cancelled = false;
    setFuelAllowanceLoading(true);
    payrollApi
      .getFuelAllowance(Number(employeeId), month, year)
      .then((fuelAllowance) => {
        if (cancelled || fuelAllowance === null) return;
        setNumbers((current) => ({ ...current, fuelAllowance }));
      })
      .catch(() => {
        // Không lấy được chấm công — để người lập phiếu tự nhập bù, không chặn form.
      })
      .finally(() => {
        if (!cancelled) setFuelAllowanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, month, year, isCompanyTeacher]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!payroll && !employeeId) {
      setError("Vui lòng chọn nhân viên.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const editable = {
        ...numbers,
        jobTitle,
        leaveNote,
        adjustmentNote,
        note,
      };
      await onSubmit(
        payroll
          ? editable
          : {
              ...editable,
              employeeId: Number(employeeId),
              month,
              year,
            },
      );
    } catch (submitError: any) {
      const backendMessage = submitError?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(", ")
        : backendMessage;
      setError(
        submitError?.response?.status === 409
          ? message || "Nhân viên đã có phiếu lương trong tháng này."
          : message || "Không lưu được phiếu lương. Vui lòng kiểm tra lại dữ liệu.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200";

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/50 p-3 md:p-8">
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {payroll ? "Sửa phiếu lương" : "Tạo phiếu lương"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Các tổng được xem trước ở đây và sẽ do máy chủ tính lại khi lưu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>

        <div className="space-y-4 p-4 md:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold uppercase text-slate-700">Thông tin chung</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs font-medium text-slate-600 md:col-span-2">
                Nhân viên <span className="text-red-500">*</span>
                <SearchableSelect
                  value={employeeId}
                  onChange={setEmployeeId}
                  disabled={!!payroll}
                  options={employees.map((employee) => ({
                    id: employee.id,
                    name: employee.name || `Nhân viên #${employee.id}`,
                  }))}
                  placeholder="Chọn nhân viên"
                  searchPlaceholder="Tìm tên nhân viên…"
                  className="mt-1"
                  portal
                />
                {prefilledPeriod && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-normal text-blue-600">
                    <Sparkles size={12} />
                    Đã áp dụng dữ liệu tháng {prefilledPeriod.month}/{prefilledPeriod.year}, có thể điều chỉnh.
                  </p>
                )}
              </label>
              <label className="text-xs font-medium text-slate-600">
                Tháng <span className="text-red-500">*</span>
                <select
                  value={month}
                  disabled={!!payroll}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                    <option key={item} value={item}>Tháng {item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Năm <span className="text-red-500">*</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  disabled={!!payroll}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs font-medium text-slate-600 md:col-span-4">
                Chức vụ
                <input
                  value={jobTitle}
                  maxLength={255}
                  onChange={(event) => setJobTitle(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="Để trống nếu không có"
                />
              </label>
            </div>
          </section>

          {FIELD_GROUPS.map((group) => (
            <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold uppercase text-slate-700">{group.title}</h3>
                {group.hint && <p className="mt-1 text-xs text-amber-700">{group.hint}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((field) => {
                  const isAutoFuelAllowance = field.key === "fuelAllowance" && isCompanyTeacher;
                  return (
                    <label key={field.key} className="text-xs font-medium text-slate-600">
                      {field.label}
                      <DecimalInput
                        value={numbers[field.key]}
                        min={field.allowNegative ? -999_999_999_999 : 0}
                        disabled={isAutoFuelAllowance && fuelAllowanceLoading}
                        onValueChange={(value) =>
                          setNumbers((current) => ({ ...current, [field.key]: value }))
                        }
                        className={`${inputClass} ${isAutoFuelAllowance ? "bg-blue-50" : ""}`}
                      />
                      {isAutoFuelAllowance && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-normal text-blue-600">
                          <Sparkles size={12} />
                          {fuelAllowanceLoading
                            ? "Đang lấy từ bảng chấm công…"
                            : "Lấy từ bảng chấm công, có thể điều chỉnh."}
                        </p>
                      )}
                    </label>
                  );
                })}
              </div>

              {group.title === "Ngày công và phép" && (
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Ghi chú nghỉ
                  <textarea
                    value={leaveNote}
                    maxLength={2000}
                    onChange={(event) => setLeaveNote(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              )}
              {group.title === "Các khoản khấu trừ" && (
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Diễn giải truy thu / truy lãnh
                  <textarea
                    value={adjustmentNote}
                    maxLength={2000}
                    onChange={(event) => setAdjustmentNote(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              )}
            </section>
          ))}

          <section className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm md:grid-cols-3">
            <div><span className="text-slate-500">Tổng thu nhập</span><strong className="mt-1 block text-lg text-slate-900">{formatPayrollMoney(totals.totalIncome)}</strong></div>
            <div><span className="text-slate-500">Tổng khấu trừ</span><strong className="mt-1 block text-lg text-slate-900">{formatPayrollMoney(totals.totalDeduction)}</strong></div>
            <div><span className="text-slate-500">Lương thực nhận</span><strong className="mt-1 block text-xl text-blue-700">{formatPayrollMoney(totals.netSalary)} VNĐ</strong></div>
          </section>

          <label className="block rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-600">
            Ghi chú chung
            <textarea
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Đang lưu…" : "Lưu phiếu"}
          </button>
        </footer>
      </form>
    </div>
  );
}
