import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PolicySubject } from "../types";
import MoneyInput from "./MoneyInput";
import NumberInput from "./NumberInput";

type PolicySubjectFormModalProps = {
  open: boolean;
  subject?: PolicySubject | null;
  nextId: number;
  databaseFieldsReadonly?: boolean;
  onClose: () => void;
  onSubmit: (subject: PolicySubject) => void;
};

const createEmptySubject = (id: number): PolicySubject => ({
  id,
  code: "",
  name: "",
  tuitionPrice: 0,
  schoolRetainUnit: 0,
  policyTotalAmount: 0,
  policyStudentBase: 1000,
  policyMonthBase: 9,
  taxPercent: 10,
});

export default function PolicySubjectFormModal({
  open,
  subject,
  nextId,
  databaseFieldsReadonly = false,
  onClose,
  onSubmit,
}: PolicySubjectFormModalProps) {
  const [draft, setDraft] = useState<PolicySubject>(() =>
    subject ? { ...subject } : createEmptySubject(nextId),
  );

  useEffect(() => {
    if (open) {
      setDraft(subject ? { ...subject } : createEmptySubject(nextId));
    }
  }, [open, subject, nextId]);

  if (!open) return null;

  const setField = <K extends keyof PolicySubject>(
    field: K,
    value: PolicySubject[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              {subject ? "Sửa cấu hình môn học" : "Thêm môn học"}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-400">
              Các giá trị này được dùng để tính chính sách từng tháng.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Mã môn
            </span>
            <input
              value={draft.code}
              disabled={databaseFieldsReadonly}
              onChange={(event) =>
                setField("code", event.target.value.toUpperCase())
              }
              placeholder="VD: STEM"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Tên môn
            </span>
            <input
              value={draft.name}
              disabled={databaseFieldsReadonly}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Tên môn học"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Học phí/tháng
            </span>
            <MoneyInput
              value={draft.tuitionPrice}
              onChange={(value) => setField("tuitionPrice", value)}
              className="h-11 w-full"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Để lại trường/HS/tháng
            </span>
            <MoneyInput
              value={draft.schoolRetainUnit}
              onChange={(value) => setField("schoolRetainUnit", value)}
              className="h-11 w-full"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Tổng chính sách năm
            </span>
            <MoneyInput
              value={draft.policyTotalAmount}
              onChange={(value) => setField("policyTotalAmount", value)}
              className="h-11 w-full"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Học sinh chuẩn
            </span>
            <NumberInput
              value={draft.policyStudentBase}
              onChange={(value) => setField("policyStudentBase", value)}
              className="h-11 w-full"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Số tháng chuẩn
            </span>
            <NumberInput
              value={draft.policyMonthBase}
              min={1}
              max={12}
              onChange={(value) => setField("policyMonthBase", value)}
              className="h-11 w-full"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Thuế chính sách (%)
            </span>
            <NumberInput
              value={draft.taxPercent}
              min={0}
              max={100}
              onChange={(value) => setField("taxPercent", value)}
              className="h-11 w-full"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!draft.name.trim() || !draft.code.trim()}
            onClick={() => onSubmit(draft)}
            className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subject ? "Cập nhật" : "Thêm môn"}
          </button>
        </div>
      </div>
    </div>
  );
}
