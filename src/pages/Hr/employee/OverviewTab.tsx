import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Pencil } from "lucide-react";
import Modal from "@/pages/Teaching/components/Modal";
import { hrEmployeeApi, type HrEmployee } from "@/service/hr/hr.api";
import { HrAlert, HrCard, HrFormError, buttonSecondary } from "../components/HrUi";
import { formatVnDate, vnToday } from "../lib/hrAccess";
import {
  ATTENDANCE_MODE_LABELS,
  GENDER_LABELS,
  profileFormFrom,
  profilePatch,
  profileProblems,
  type ProfileSource,
} from "../lib/hrEmployeeProfile";
import ProfileFields, { toastDuplicateWarnings } from "./ProfileFields";
import type { EmployeeTabProps } from "./types";

const isoToVn = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const source = (e: HrEmployee): ProfileSource => ({
  fullName: e.fullName,
  attendanceMode: e.attendanceMode,
  dateOfBirth: e.dateOfBirth ?? null,
  gender: e.gender ?? null,
  phone: e.phone,
  workEmail: e.workEmail,
  personalEmail: e.personalEmail ?? null,
});

export default function OverviewTab({ employee, canEdit }: EmployeeTabProps) {
  const [editing, setEditing] = useState(false);
  const rows: [string, string][] = [
    ["Mã nhân viên", employee.employeeCode],
    ["Họ tên", employee.fullName],
    ["Kiểu chấm công", ATTENDANCE_MODE_LABELS[employee.attendanceMode] ?? employee.attendanceMode],
    ["Ngày sinh", isoToVn(employee.dateOfBirth)],
    ["Giới tính", employee.gender ? GENDER_LABELS[employee.gender] : "—"],
    ["Số điện thoại", employee.phone ?? "—"],
    ["Email công việc", employee.workEmail ?? "—"],
    ["Email cá nhân", employee.personalEmail ?? "—"],
    ["Tài khoản liên kết", employee.accountId === null ? "—" : `#${employee.accountId}`],
    ["Tạo lúc", formatVnDate(employee.createdAt)],
    ["Cập nhật", formatVnDate(employee.updatedAt)],
  ];
  return (
    <HrCard
      title="Thông tin cơ bản"
      action={
        canEdit && (
          <button className={buttonSecondary} onClick={() => setEditing(true)}>
            <Pencil size={14} /> Sửa
          </button>
        )
      }
    >
      {employee.attendanceMode === "UNASSIGNED" && (
        <HrAlert tone="warning">Hồ sơ chưa phân loại kiểu chấm công — cần phân loại trước khi dùng chấm công.</HrAlert>
      )}
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="text-sm text-gray-800 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-400">
        Trạng thái ở đầu trang là trạng thái hồ sơ trong hệ thống. Phòng ban, chức danh, ngày vào làm, quá trình công tác sẽ có ở
        phần Quá trình công tác (Phase 1.4).
      </p>
      {editing && <EditProfileDialog employee={employee} onClose={() => setEditing(false)} />}
    </HrCard>
  );
}

/** Sửa hồ sơ cơ bản — gửi CHỈ trường đã đổi + version; không sửa mã NV / tài khoản. */
function EditProfileDialog({ employee, onClose }: { employee: HrEmployee; onClose: () => void }) {
  const queryClient = useQueryClient();
  const today = vnToday();
  const [form, setForm] = useState(() => profileFormFrom(source(employee)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const problems = profileProblems(form, today);
  const patch = profilePatch(source(employee), form);
  const changed = Object.keys(patch).length > 0;

  const submit = async () => {
    if (problems.length || !changed) return;
    setLoading(true);
    setError(null);
    try {
      const saved = await hrEmployeeApi.update(employee.id, { ...patch, version: employee.version });
      toast.success("Đã cập nhật hồ sơ.");
      toastDuplicateWarnings(saved.warnings);
      queryClient.setQueryData(["hr", "employee", employee.id], saved);
      queryClient.invalidateQueries({ queryKey: ["hr", "employees"] });
      onClose();
    } catch (err) {
      setError(err);
      // 409: dữ liệu đã đổi — tải lại để người dùng thấy bản mới rồi sửa lại.
      if ((err as { response?: { status?: number } })?.response?.status === 409)
        queryClient.invalidateQueries({ queryKey: ["hr", "employee", employee.id] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Sửa hồ sơ — ${employee.employeeCode}`}
      submitLabel="Lưu"
      loading={loading}
      disabled={problems.length > 0 || !changed}
      onClose={onClose}
      onSubmit={submit}
      wide
    >
      <ProfileFields form={form} onChange={setForm} today={today} />
      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-700">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <HrFormError error={error} />
    </Modal>
  );
}
