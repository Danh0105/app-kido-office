import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { schoolApi } from "@/service/school.api";
import { getApiErrorMessage } from "@/utils/apiError";

export type SchoolInfo = {
  id: number;
  name: string;
  address?: string | null;
  taxCode?: string | null;
  budgetCode?: string | null;
  representative?: string | null;
  phone?: string | null;
};

type Form = {
  name: string;
  address: string;
  taxCode: string;
  budgetCode: string;
  representative: string;
  phone: string;
};

const FIELDS: Array<{
  key: keyof Form;
  label: string;
  placeholder?: string;
  numeric?: boolean;
}> = [
  { key: "name", label: "Tên trường *" },
  { key: "address", label: "Địa chỉ *" },
  { key: "taxCode", label: "Mã số thuế *", numeric: true },
  {
    key: "budgetCode",
    label: "Mã ĐV QH ngân sách *",
    placeholder: "7 chữ số",
    numeric: true,
  },
  { key: "representative", label: "Người đại diện" },
  { key: "phone", label: "SĐT trường", numeric: true },
];

/** Mẫu 1: 0312770607 · Mẫu 2: 0312770607-001 (theo tài liệu Viettel S-Invoice). */
const TAX_CODE = /^[0-9]{10,13}$|^[0-9]{10}-[0-9]{3}$/;

/**
 * Kế toán sửa thông tin trường in trên hóa đơn điện tử (bên mua): tên, địa
 * chỉ, MST, mã đơn vị quan hệ ngân sách — không cần nhờ sale phụ trách.
 */
export default function SchoolInfoModal({
  school,
  onClose,
  onSaved,
}: {
  school: SchoolInfo;
  onClose: () => void;
  onSaved: (school: SchoolInfo) => void;
}) {
  const [form, setForm] = useState<Form>({
    name: school.name ?? "",
    address: school.address ?? "",
    taxCode: school.taxCode ?? "",
    budgetCode: school.budgetCode ?? "",
    representative: school.representative ?? "",
    phone: school.phone ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = "Vui lòng nhập tên trường";
    if (!form.address.trim()) next.address = "Vui lòng nhập địa chỉ";
    if (!TAX_CODE.test(form.taxCode.trim())) {
      next.taxCode = "MST gồm 10-13 số (hoặc dạng 0312770607-001)";
    }
    if (!/^[0-9]{7}$/.test(form.budgetCode.trim())) {
      next.budgetCode = "Mã ĐVQHNS gồm 7 chữ số";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      taxCode: form.taxCode.trim(),
      budgetCode: form.budgetCode.trim(),
      representative: form.representative.trim() || null,
      phone: form.phone.trim() || null,
    };
    setSaving(true);
    try {
      await schoolApi.update(school.id, payload);
      toast.success("Đã cập nhật thông tin trường");
      onSaved({ ...school, ...payload });
    } catch (error: any) {
      toast.error(
        getApiErrorMessage(error, "Không cập nhật được thông tin trường"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
      >
        <h3 className="text-base font-bold text-slate-800">
          Thông tin trường
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Thông tin bên mua trên hóa đơn điện tử.
        </p>

        <div className="space-y-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="text-xs font-semibold text-slate-600">
                {field.label}
              </span>
              <input
                value={form[field.key]}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    [field.key]: e.target.value,
                  }))
                }
                placeholder={field.placeholder}
                inputMode={field.numeric ? "numeric" : undefined}
                className={`mt-1 w-full h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2 ${
                  errors[field.key]
                    ? "border-red-400 focus:ring-red-200"
                    : "border-slate-200 focus:ring-blue-200"
                }`}
              />
              {errors[field.key] && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors[field.key]}
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
