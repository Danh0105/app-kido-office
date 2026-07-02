import { Pencil, Trash2 } from "lucide-react";
import { PolicySubject } from "../types";
import { formatCurrency } from "../utils";

type PolicySubjectConfigCardProps = {
  subject: PolicySubject;
  onEdit: (subject: PolicySubject) => void;
  onDelete: (subjectId: number) => void;
  disabled?: boolean;
  disableDelete?: boolean;
};

export default function PolicySubjectConfigCard({
  subject,
  onEdit,
  onDelete,
  disabled = false,
  disableDelete = false,
}: PolicySubjectConfigCardProps) {
  const fields = [
    ["Học phí/tháng", `${formatCurrency(subject.tuitionPrice)} đ`],
    ["Để lại trường", `${formatCurrency(subject.schoolRetainUnit)} đ`],
    ["Chính sách năm", `${formatCurrency(subject.policyTotalAmount)} đ`],
    ["Học sinh chuẩn", formatCurrency(subject.policyStudentBase)],
    ["Số tháng chuẩn", subject.policyMonthBase],
    ["Thuế chính sách", `${subject.taxPercent}%`],
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
            {subject.code.slice(0, 3)}
          </span>
          <div>
            <h4 className="font-black text-slate-900">{subject.name}</h4>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              Cấu hình chính sách
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled || disableDelete}
            onClick={() => onEdit(subject)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Sửa ${subject.name}`}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(subject.id)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Xóa ${subject.name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-bold text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
