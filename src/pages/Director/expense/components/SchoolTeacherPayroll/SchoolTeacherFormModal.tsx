// Thêm / sửa giáo viên của trường (nhận lương ở bảng Giáo viên trường).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { Loader2, X } from "lucide-react";

import {
  schoolTeacherApi,
  type SchoolTeacher,
} from "@/service/schoolExpense";
import { getApiErrorMessage } from "@/utils/apiError";

type Props = {
  open: boolean;
  schoolId: number;
  /** Có thì sửa, không thì thêm mới. */
  teacher?: SchoolTeacher | null;
  /** Tên điền sẵn khi thêm nhanh từ bảng. */
  defaultName?: string;
  onClose: () => void;
  onSaved: (teacher: SchoolTeacher) => void;
};

const fieldClass =
  "mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

export default function SchoolTeacherFormModal({
  open,
  schoolId,
  teacher,
  defaultName = "",
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState({
    name: "",
    bankAccount: "",
    bankName: "",
    taxCode: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: teacher?.name ?? defaultName,
      bankAccount: teacher?.bankAccount ?? "",
      bankName: teacher?.bankName ?? "",
      taxCode: teacher?.taxCode ?? "",
      note: teacher?.note ?? "",
    });
  }, [open, teacher, defaultName]);

  if (!open) return null;

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nhập tên giáo viên");
      return;
    }
    setSaving(true);
    try {
      const saved = teacher
        ? await schoolTeacherApi.update(teacher.id, form)
        : await schoolTeacherApi.create({ ...form, schoolId });
      toast.success(teacher ? "Đã lưu giáo viên" : "Đã thêm giáo viên");
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được giáo viên"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-base font-bold text-slate-800">
            {teacher ? "Sửa giáo viên trường" : "Thêm giáo viên trường"}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <label className="block font-medium text-slate-700">
            Họ tên *
            <input value={form.name} onChange={set("name")} maxLength={255} autoFocus className={fieldClass} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block font-medium text-slate-700">
              Số tài khoản
              <input value={form.bankAccount} onChange={set("bankAccount")} maxLength={50} inputMode="numeric" className={fieldClass} />
            </label>
            <label className="block font-medium text-slate-700">
              Ngân hàng
              <input value={form.bankName} onChange={set("bankName")} maxLength={100} placeholder="VD: Vietcombank" className={fieldClass} />
            </label>
          </div>
          <label className="block font-medium text-slate-700">
            Mã số thuế cá nhân
            <input value={form.taxCode} onChange={set("taxCode")} maxLength={20} inputMode="numeric" className={fieldClass} />
          </label>
          <label className="block font-medium text-slate-700">
            Ghi chú
            <input value={form.note} onChange={set("note")} maxLength={2000} className={fieldClass} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Lưu
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
