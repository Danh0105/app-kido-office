import { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass } from "@/pages/Teaching/components/Shared";
import { toast } from "react-hot-toast";
import {
  ATTENDANCE_MODE_LABELS,
  ATTENDANCE_MODES,
  DUPLICATE_WARNING_LABELS,
  GENDER_LABELS,
  GENDERS,
  type HrAttendanceMode,
  type HrDuplicateWarning,
  type HrGender,
  type ProfileForm,
} from "../lib/hrEmployeeProfile";

/** Các trường hồ sơ cơ bản — dùng chung cho tạo và sửa. */
export default function ProfileFields({
  form,
  onChange,
  today,
}: {
  form: ProfileForm;
  onChange: (form: ProfileForm) => void;
  today: string;
}) {
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => onChange({ ...form, [key]: value });
  return (
    <>
      <Field label="Họ tên" required>
        <input className={inputClass} value={form.fullName} maxLength={200} onChange={(e) => set("fullName", e.target.value)} />
      </Field>
      <Field
        label="Kiểu chấm công"
        required
        hint="Văn phòng: theo ca. Giáo viên: theo tiết dạy. Chưa rõ thì để “Chưa phân loại” — phải phân loại trước khi dùng chấm công."
      >
        <select
          className={`${selectClass} w-full`}
          value={form.attendanceMode}
          onChange={(e) => set("attendanceMode", e.target.value as HrAttendanceMode)}
        >
          {ATTENDANCE_MODES.map((m) => (
            <option key={m} value={m}>
              {ATTENDANCE_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày sinh">
          <input
            type="date"
            className={inputClass}
            min="1900-01-01"
            max={today}
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </Field>
        <Field label="Giới tính">
          <select className={`${selectClass} w-full`} value={form.gender} onChange={(e) => set("gender", e.target.value as HrGender | "")}>
            <option value="">— Không chọn —</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Số điện thoại" hint="Được dùng khoảng trắng, dấu chấm, gạch nối — hệ thống tự bỏ khi lưu.">
        <input className={inputClass} inputMode="tel" maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email công việc">
          <input type="email" className={inputClass} maxLength={254} value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} />
        </Field>
        <Field label="Email cá nhân">
          <input
            type="email"
            className={inputClass}
            maxLength={254}
            value={form.personalEmail}
            onChange={(e) => set("personalEmail", e.target.value)}
          />
        </Field>
      </div>
    </>
  );
}

/** Cảnh báo trùng SĐT/email sau khi lưu — chỉ nhắc, không chặn. */
export function toastDuplicateWarnings(warnings: HrDuplicateWarning[] | undefined) {
  if (!warnings?.length) return;
  toast(`${warnings.map((w) => DUPLICATE_WARNING_LABELS[w]).join(" ")} Đã lưu — kiểm tra lại nếu nhầm.`, {
    icon: "⚠️",
    duration: 8000,
  });
}
