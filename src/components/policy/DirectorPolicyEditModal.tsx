import { useEffect, useState } from "react";
import { PolicyData } from "@/types/policy";

type PathPart = string | number;

const fieldLabels: Record<string, string> = {
  fee: "Học phí",
  durationMonths: "Số tháng",
  studentPerClass: "Sĩ số lớp",
  csvc: "CSVC",
  thue: "Thuế",
  giaovien: "Giáo viên trường",
  teacherCompany: "Giáo viên công ty",
  csthang: "CS tháng",
  cdhd: "CS ký hợp đồng",
  thietbi: "Thiết bị",
  giaoCu: "Giáo cụ",
  vanHanh: "Vận hành",
  thuetndn: "Thuế TNDN",
  companyProfit: "Lợi nhuận công ty",
  companyProfitPerHS: "Lợi nhuận / học sinh",
  ttcs: "Chính sách vận hành",
  httienmat: "Hỗ trợ tiền mặt",
  htthietbi: "Hỗ trợ thiết bị",
  notes: "Ghi chú",
  giaTriHopDong: "Giá trị hợp đồng",
  soTietThucDay: "Số tiết thực dạy",
  donGia: "Đơn giá",
  ghiChu: "Ghi chú",
};

const cloneData = <T,>(data: T): T => JSON.parse(JSON.stringify(data));

const formatFieldName = (fieldName: string) =>
  fieldLabels[fieldName] ||
  fieldName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

const setValueAtPath = (
  source: PolicyData,
  path: PathPart[],
  value: any,
) => {
  const next = cloneData(source);
  let cursor: any = next;

  path.slice(0, -1).forEach((pathPart) => {
    cursor = cursor[pathPart];
  });
  cursor[path[path.length - 1]] = value;

  return next;
};

type EditorNodeProps = {
  value: any;
  fieldName: string;
  path: PathPart[];
  onChange: (path: PathPart[], value: any) => void;
  depth?: number;
};

function EditorNode({
  value,
  fieldName,
  path,
  onChange,
  depth = 0,
}: EditorNodeProps) {
  const label = formatFieldName(fieldName);

  if (Array.isArray(value)) {
    return (
      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <legend className="px-2 text-sm font-black text-slate-700">
          {label} ({value.length})
        </legend>
        <div className="space-y-3">
          {value.map((item, index) => (
            <div
              key={`${fieldName}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                Dòng {index + 1}
              </p>
              <EditorNode
                value={item}
                fieldName={String(index)}
                path={[...path, index]}
                onChange={onChange}
                depth={depth + 1}
              />
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (value && typeof value === "object") {
    return (
      <fieldset
        className={`rounded-2xl border border-slate-200 ${
          depth > 1 ? "bg-white p-2" : "bg-slate-50 p-3"
        }`}
      >
        {fieldName && !/^\d+$/.test(fieldName) && (
          <legend className="px-2 text-sm font-black text-slate-700">
            {label}
          </legend>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Object.entries(value)
            .sort(([, left], [, right]) => {
              const leftNested = left && typeof left === "object" ? 1 : 0;
              const rightNested = right && typeof right === "object" ? 1 : 0;
              return leftNested - rightNested;
            })
            .map(([childName, childValue]) => (
              <div
                key={childName}
                className={
                  childValue && typeof childValue === "object"
                    ? "lg:col-span-2"
                    : ""
                }
              >
                <EditorNode
                  value={childValue}
                  fieldName={childName}
                  path={[...path, childName]}
                  onChange={onChange}
                  depth={depth + 1}
                />
              </div>
            ))}
        </div>
      </fieldset>
    );
  }

  const readOnlyField = fieldName === "id";
  const inputClass =
    "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";

  if (typeof value === "boolean") {
    return (
      <label className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <input
          type="checkbox"
          checked={value}
          disabled={readOnlyField}
          onChange={(event) => onChange(path, event.target.checked)}
          className="h-5 w-5 accent-blue-600"
        />
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        <input
          type="number"
          step="0.01"
          value={value}
          disabled={readOnlyField}
          onChange={(event) =>
            onChange(path, event.target.value === "" ? 0 : Number(event.target.value))
          }
          className={inputClass}
        />
      </label>
    );
  }

  const useTextarea =
    /note|ghiChu|log/i.test(fieldName) || String(value || "").length > 80;

  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {useTextarea ? (
        <textarea
          value={value ?? ""}
          disabled={readOnlyField}
          onChange={(event) => onChange(path, event.target.value)}
          className={`${inputClass} min-h-24 py-3`}
        />
      ) : (
        <input
          value={value ?? ""}
          disabled={readOnlyField}
          onChange={(event) => onChange(path, event.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

export default function DirectorPolicyEditModal({
  open,
  data,
  durationMonths,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  data: PolicyData;
  durationMonths?: number;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    data: PolicyData;
    note?: string;
    durationMonths?: number;
  }) => void;
}) {
  const [formData, setFormData] = useState<PolicyData>({});
  const [note, setNote] = useState("");
  const [months, setMonths] = useState<number | undefined>(durationMonths);

  useEffect(() => {
    if (!open) return;
    setFormData(cloneData(data || {}));
    setNote("");
    setMonths(durationMonths);
  }, [data, durationMonths, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Chỉnh sửa chính sách
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Toàn bộ dữ liệu hiện tại đã được điền sẵn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-slate-100 text-xl text-slate-600 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <EditorNode
            value={formData}
            fieldName="data"
            path={[]}
            onChange={(path, value) =>
              setFormData((current) => setValueAtPath(current, path, value))
            }
          />

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 md:grid-cols-[220px_1fr]">
            <label className="text-sm font-bold text-slate-700">
              Số tháng áp dụng
              <input
                type="number"
                min="1"
                step="1"
                value={months ?? ""}
                onChange={(event) =>
                  setMonths(
                    event.target.value === ""
                      ? undefined
                      : Math.max(1, Number(event.target.value)),
                  )
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-sm font-bold text-slate-700">
              Lý do chỉnh sửa
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nhập ghi chú để nhân viên hiểu lý do thay đổi..."
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-xl bg-slate-100 px-5 font-bold text-slate-700 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSubmit({
                data: formData,
                note: note.trim() || undefined,
                durationMonths: months,
              })
            }
            className="h-11 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
