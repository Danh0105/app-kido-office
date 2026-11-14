import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CircleCheck, Download, FileSpreadsheet, Pencil, Plus, Search, TriangleAlert } from "lucide-react";

import {
  attendanceApi,
  attendanceError,
  type AttendanceEmployee,
  type EmployeeInput,
  type ImportResult,
} from "@/service/attendance";
import { downloadBlob } from "./lib";
import { Badge, Empty, ErrorBox, Field, Modal, Spinner, inputClass, primaryBtn, secondaryBtn } from "./ui";

/** Thêm mới (employee = undefined) hoặc sửa một nhân viên. */
export function EmployeeFormModal({
  employee,
  presetNo,
  onClose,
}: {
  employee?: AttendanceEmployee;
  presetNo?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EmployeeInput>({
    employee_no: employee?.employee_no ?? presetNo ?? "",
    full_name: employee?.full_name ?? "",
    department: employee?.department ?? "",
    shift_code: employee?.shift_code ?? "",
    status: employee?.status ?? "active",
  });
  const set = (k: keyof EmployeeInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      employee
        ? attendanceApi.updateEmployee(employee.id, {
            full_name: form.full_name.trim(),
            department: form.department?.trim() || null,
            shift_code: form.shift_code?.trim() || null,
            status: form.status,
          })
        : attendanceApi.createEmployee({
            ...form,
            employee_no: form.employee_no.trim(),
            full_name: form.full_name.trim(),
            department: form.department?.trim() || null,
            shift_code: form.shift_code?.trim() || null,
          }),
    onSuccess: () => {
      toast.success(employee ? "Đã lưu thay đổi" : "Đã thêm nhân viên");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      onClose();
    },
    onError: (e) => toast.error(attendanceError(e, "Không lưu được nhân viên.")),
  });

  const valid = form.employee_no.trim() && form.full_name.trim();

  return (
    <Modal
      title={employee ? `Sửa nhân viên ${employee.employee_no}` : "Thêm nhân viên"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!valid || save.isPending}
            className={primaryBtn}
          >
            {save.isPending ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Mã NV *"
          hint={employee ? "Không sửa được mã. Mã phải trùng khít với mã trên máy chấm công." : "Phải trùng khít với mã khai báo trên máy chấm công (kể cả số 0 ở đầu)."}
        >
          <input
            value={form.employee_no}
            onChange={(e) => set("employee_no", e.target.value)}
            disabled={Boolean(employee)}
            maxLength={32}
            className={inputClass}
          />
        </Field>
        <Field label="Họ tên *">
          <input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phòng ban">
            <input
              value={form.department ?? ""}
              onChange={(e) => set("department", e.target.value)}
              maxLength={200}
              className={inputClass}
            />
          </Field>
          <Field label="Ca" hint="Để trống = ca chung">
            <input
              value={form.shift_code ?? ""}
              onChange={(e) => set("shift_code", e.target.value)}
              maxLength={32}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Trạng thái">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputClass}
          >
            <option value="active">Đang làm</option>
            <option value="inactive">Nghỉ việc</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function ImportSummary({ r }: { r: ImportResult }) {
  return (
    <div className="space-y-3 text-sm">
      {r.errors.length > 0 ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
          <p className="flex items-center gap-2 font-bold">
            <TriangleAlert className="h-4 w-4" /> File có {r.errors.length} lỗi — chưa ghi gì vào hệ thống.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {r.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Sửa file Excel rồi chọn lại file.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xl font-black text-emerald-700">{r.created}</p>
            <p className="text-[11px] text-emerald-700">thêm mới</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xl font-black text-[#005BEA]">{r.updated}</p>
            <p className="text-[11px] text-[#005BEA]">cập nhật</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xl font-black text-slate-700">{r.unchanged}</p>
            <p className="text-[11px] text-slate-500">không đổi</p>
          </div>
        </div>
      )}
      {r.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-bold">Cần kiểm tra:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Nhập Excel 2 bước: xem trước (không ghi) → xác nhận (ghi). */
function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);

  const check = useMutation({
    mutationFn: (f: File) => attendanceApi.importEmployees(f, false),
    onSuccess: setPreview,
    onError: (e) => toast.error(attendanceError(e, "Không đọc được file.")),
  });
  const apply = useMutation({
    mutationFn: (f: File) => attendanceApi.importEmployees(f, true),
    onSuccess: (r) => {
      setDone(r);
      if (r.applied) {
        toast.success("Đã nhập danh sách nhân viên");
        qc.invalidateQueries({ queryKey: ["attendance"] });
      }
    },
    onError: (e) => toast.error(attendanceError(e, "Không nhập được file.")),
  });

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setDone(null);
    if (f) check.mutate(f);
  };

  const canApply = file && preview && preview.errors.length === 0 && !done;

  return (
    <Modal
      title="Nhập nhân viên từ Excel"
      onClose={onClose}
      footer={
        done ? (
          <button type="button" onClick={onClose} className={primaryBtn}>
            Xong
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => file && apply.mutate(file)}
              disabled={!canApply || apply.isPending}
              className={primaryBtn}
            >
              {apply.isPending ? "Đang nhập…" : `Xác nhận nhập ${preview?.total ?? ""} nhân viên`}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CircleCheck className="h-5 w-5" /> Đã ghi vào hệ thống.
          </p>
          <ImportSummary r={done} />
          {done.rematched > 0 && (
            <p className="text-xs text-slate-600">
              Đã gắn lại {done.rematched} lần chấm công trước đây chưa khớp nhân viên.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>Dùng file mẫu (nút "Tải file mẫu") hoặc file sẵn có có cột "Mã NV" và "Họ tên" ở sheet đầu tiên.</li>
            <li>Chọn file — hệ thống kiểm tra và cho xem trước, CHƯA ghi gì.</li>
            <li>Nếu không có lỗi, bấm "Xác nhận" để ghi. Người không có trong file sẽ không bị xoá.</li>
          </ol>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#005BEA]"
          />
          {check.isPending && <Spinner label="Đang kiểm tra file…" />}
          {preview && (
            <>
              <p className="text-xs font-bold text-slate-600">
                Xem trước: {preview.total} nhân viên trong file {file?.name}
              </p>
              <ImportSummary r={preview} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function EmployeesPanel({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState("active");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<AttendanceEmployee | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["attendance", "employees", status, department, term],
    queryFn: () => attendanceApi.employees({ status, department, q: term }),
    placeholderData: keepPreviousData,
  });
  const all = useQuery({
    queryKey: ["attendance", "employees", "all-departments"],
    queryFn: () => attendanceApi.employees({ status: "all" }),
  });
  const departments = useMemo(
    () =>
      [...new Set((all.data?.employees ?? []).map((e) => e.department).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "vi")
      ),
    [all.data]
  );

  const template = async () => {
    setDownloading(true);
    try {
      downloadBlob(await attendanceApi.template(), "mau-nhan-vien.xlsx");
    } catch (e) {
      toast.error(attendanceError(e, "Không tải được file mẫu."));
    } finally {
      setDownloading(false);
    }
  };

  const employees = q.data?.employees ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full md:w-64">
          <span className="text-xs font-bold text-slate-600">Tìm kiếm</span>
          <span className="relative mt-1 block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tên hoặc mã NV"
              className={`${inputClass} pl-9`}
            />
          </span>
        </label>
        <label className="w-36">
          <span className="text-xs font-bold text-slate-600">Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="active">Đang làm</option>
            <option value="inactive">Nghỉ việc</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
        <label className="w-48">
          <span className="text-xs font-bold text-slate-600">Phòng ban</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <button type="button" onClick={template} disabled={downloading} className={secondaryBtn}>
            <Download className="h-4 w-4" /> Tải file mẫu
          </button>
          {isAdmin && (
            <>
              <button type="button" onClick={() => setImporting(true)} className={secondaryBtn}>
                <FileSpreadsheet className="h-4 w-4" /> Nhập từ Excel
              </button>
              <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>
                <Plus className="h-4 w-4" /> Thêm nhân viên
              </button>
            </>
          )}
        </div>
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBox message={attendanceError(q.error)} onRetry={() => q.refetch()} />}
      {q.data && employees.length === 0 && (
        <Empty>
          {term || department || status !== "active"
            ? "Không có nhân viên phù hợp."
            : isAdmin
            ? 'Chưa có nhân viên. Bấm "Nhập từ Excel" để nhập danh sách.'
            : "Chưa có nhân viên."}
        </Empty>
      )}
      {employees.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã NV</th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Phòng ban</th>
                <th className="px-4 py-3">Ca</th>
                <th className="px-4 py-3">Trạng thái</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.employee_no}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{e.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.department || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.shift_code || "Ca chung"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.status === "active" ? "green" : "slate"}>{e.status_label}</Badge>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#005BEA] hover:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <EmployeeFormModal onClose={() => setAdding(false)} />}
      {editing && <EmployeeFormModal employee={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}
