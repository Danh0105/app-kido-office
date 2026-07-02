import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { PolicyMonthlyInput, PolicySubject } from "../types";
import { calculatePolicyRow, formatCurrency } from "../utils";
import MoneyInput from "./MoneyInput";
import NumberInput from "./NumberInput";

type PolicyMonthlyFormModalProps = {
  open: boolean;
  row?: PolicyMonthlyInput | null;
  subjects: PolicySubject[];
  nextId: number;
  databaseFieldsReadonly?: boolean;
  onClose: () => void;
  onSubmit: (row: PolicyMonthlyInput) => void;
};

const createEmptyRow = (
  subject: PolicySubject | undefined,
  nextId: number,
): PolicyMonthlyInput => ({
  id: nextId,
  subjectId: subject?.id || 0,
  month: "2025-09",
  studentCount: subject?.policyStudentBase || 0,
  unitPrice: subject?.tuitionPrice || 0,
  monthsCount: 1,
  principalPolicyAmount: 0,
  cashPolicyAmount: 0,
  equipmentPolicyAmount: 0,
  paidCashAmount: 0,
  paidEquipmentAmount: 0,
  note: "",
});

export default function PolicyMonthlyFormModal({
  open,
  row,
  subjects,
  nextId,
  databaseFieldsReadonly = false,
  onClose,
  onSubmit,
}: PolicyMonthlyFormModalProps) {
  const [draft, setDraft] = useState<PolicyMonthlyInput>(() =>
    row ? { ...row } : createEmptyRow(subjects[0], nextId),
  );

  useEffect(() => {
    if (open) {
      setDraft(row ? { ...row } : createEmptyRow(subjects[0], nextId));
    }
  }, [open, row, subjects, nextId]);

  const subject = subjects.find((item) => item.id === draft.subjectId);
  const preview = useMemo(
    () => (subject ? calculatePolicyRow(draft, subject) : null),
    [draft, subject],
  );

  if (!open) return null;

  const setField = <K extends keyof PolicyMonthlyInput>(
    field: K,
    value: PolicyMonthlyInput[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const fields = [
    {
      label: "Chi hiệu trưởng",
      field: "principalPolicyAmount" as const,
    },
    { label: "Chi tiền mặt", field: "cashPolicyAmount" as const },
    { label: "Chi thiết bị", field: "equipmentPolicyAmount" as const },
    { label: "Đã chi tiền mặt", field: "paidCashAmount" as const },
    { label: "Đã chi thiết bị", field: "paidEquipmentAmount" as const },
  ];

  const previewItems = preview
    ? [
        ["Doanh thu trường", preview.schoolRevenue, "text-emerald-700"],
        ["Để lại trường", preview.schoolRetainAmount, "text-blue-700"],
        ["Công ty nhận", preview.companyPaymentAmount, "text-violet-700"],
        ["Chính sách sau thuế", preview.policyAfterTaxAmount, "text-orange-700"],
        ["Đã chi", preview.totalPaidAmount, "text-slate-700"],
        ["Còn lại chi", preview.remainingAmount, "text-rose-700"],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              {row ? "Sửa dòng chi tiết tháng" : "Thêm dòng chi tiết tháng"}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-400">
              Số liệu tính toán được cập nhật ngay khi bạn nhập.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Môn học
              </span>
              <select
                value={draft.subjectId}
                disabled={databaseFieldsReadonly}
                onChange={(event) => {
                  const nextSubject = subjects.find(
                    (item) => item.id === Number(event.target.value),
                  );
                  setDraft((current) => ({
                    ...current,
                    subjectId: nextSubject?.id || 0,
                    unitPrice: nextSubject?.tuitionPrice || current.unitPrice,
                  }));
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Tháng
              </span>
              <input
                type="month"
                value={draft.month}
                disabled={databaseFieldsReadonly}
                onChange={(event) => setField("month", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                SL HS đã thu
              </span>
              <NumberInput
                value={draft.studentCount}
                disabled={databaseFieldsReadonly}
                onChange={(value) => setField("studentCount", value)}
                className="h-11 w-full"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Đơn giá
              </span>
              <MoneyInput
                value={draft.unitPrice}
                onChange={(value) => setField("unitPrice", value)}
                className="h-11 w-full"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Số tháng thu
              </span>
              <NumberInput
                value={draft.monthsCount}
                min={1}
                max={12}
                onChange={(value) => setField("monthsCount", value)}
                className="h-11 w-full"
              />
            </label>

            {fields.map((field) => (
              <label key={field.field}>
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                  {field.label}
                </span>
                <MoneyInput
                  value={draft[field.field]}
                  onChange={(value) => setField(field.field, value)}
                  className="h-11 w-full"
                />
              </label>
            ))}

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Ghi chú
              </span>
              <textarea
                value={draft.note}
                onChange={(event) => setField("note", event.target.value)}
                rows={3}
                placeholder="Nhập nội dung ghi chú..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <aside className="h-fit rounded-2xl border border-blue-100 bg-blue-50/60 p-4 lg:sticky lg:top-24">
            <p className="text-sm font-black text-blue-900">
              Xem trước tính toán
            </p>
            <div className="mt-3 space-y-2.5">
              {previewItems.map(([label, value, className]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-white bg-white/90 p-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className={`mt-1 text-base font-black ${className}`}>
                    {formatCurrency(Math.round(Number(value)))} đ
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!subject || !draft.month}
            onClick={() => onSubmit(draft)}
            className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {row ? "Cập nhật dòng" : "Thêm dòng"}
          </button>
        </div>
      </div>
    </div>
  );
}
