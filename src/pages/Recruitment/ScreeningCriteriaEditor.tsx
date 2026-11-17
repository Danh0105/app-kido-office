import { useState } from "react";
import toast from "react-hot-toast";
import {
  recruitmentApi,
  type RecruitmentJob,
  type RecruitmentScreeningCriteria
} from "@/service/recruitment";
import { Field, errorMessage, inputClass } from "./shared";
import { uniqueList } from "./workflow";

export type CriteriaForm = {
  required: string;
  preferred: string;
  locations: string;
  months: string;
  days: string;
  immediate: boolean;
};

export const toCriteriaForm = (
  current: RecruitmentScreeningCriteria = {}
): CriteriaForm => ({
  required: (current.requiredSkills ?? []).join(", "),
  preferred: (current.preferredSkills ?? []).join(", "),
  locations: (current.locations ?? []).join(", "),
  months: String(current.minimumExperienceMonths ?? ""),
  days: String(current.maxStartDelayDays ?? ""),
  immediate: current.availableImmediatelyPreferred ?? false
});

export const toScreeningCriteria = (
  form: CriteriaForm
): RecruitmentScreeningCriteria => ({
  ...(form.months !== ""
    ? { minimumExperienceMonths: Number(form.months) }
    : {}),
  ...(form.days !== "" ? { maxStartDelayDays: Number(form.days) } : {}),
  requiredSkills: uniqueList(form.required),
  preferredSkills: uniqueList(form.preferred),
  locations: uniqueList(form.locations),
  availableImmediatelyPreferred: form.immediate
});

/** Các ô tiêu chí, dùng chung cho form tạo vị trí và nút sửa trong drawer. */
export function ScreeningCriteriaFields({
  value,
  onChange
}: {
  value: CriteriaForm;
  onChange: (value: CriteriaForm) => void;
}) {
  const set =
    (key: Exclude<keyof CriteriaForm, "immediate">) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.target.value });
  return (
    <>
      <Field label="Kinh nghiệm tối thiểu (tháng)">
        <input
          type="number"
          min={0}
          max={600}
          className={inputClass}
          value={value.months}
          onChange={set("months")}
        />
      </Field>
      <Field label="Kỹ năng bắt buộc (dấu phẩy)">
        <input
          maxLength={3000}
          className={inputClass}
          value={value.required}
          onChange={set("required")}
        />
      </Field>
      <Field label="Kỹ năng ưu tiên (dấu phẩy)">
        <input
          maxLength={3000}
          className={inputClass}
          value={value.preferred}
          onChange={set("preferred")}
        />
      </Field>
      <Field label="Khu vực làm việc (dấu phẩy)">
        <input
          maxLength={5000}
          className={inputClass}
          value={value.locations}
          onChange={set("locations")}
        />
      </Field>
      <Field label="Số ngày tối đa để bắt đầu">
        <input
          type="number"
          min={0}
          max={365}
          className={inputClass}
          value={value.days}
          onChange={set("days")}
        />
      </Field>
      <label className="block text-xs">
        <input
          type="checkbox"
          checked={value.immediate}
          onChange={(e) => onChange({ ...value, immediate: e.target.checked })}
        />{" "}
        Ưu tiên có thể bắt đầu ngay
      </label>
    </>
  );
}

export default function ScreeningCriteriaEditor({
  job,
  onChanged
}: {
  job: RecruitmentJob;
  onChanged: (job: RecruitmentJob) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => toCriteriaForm(job.screeningCriteria));
  if (!editing)
    return (
      <button
        type="button"
        className={`${inputClass} mt-3`}
        onClick={() => setEditing(true)}
      >
        Sửa tiêu chí sàng lọc
      </button>
    );
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const updated = await recruitmentApi.updateJob(job.id, {
            screeningCriteria: toScreeningCriteria(form)
          });
          toast.success("Đã lưu tiêu chí; kết quả sàng lọc cũ được giữ nguyên");
          setEditing(false);
          onChanged(updated);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <ScreeningCriteriaFields value={form} onChange={setForm} />
      <button disabled={busy} className={inputClass}>
        Lưu tiêu chí
      </button>{" "}
      <button disabled={busy} type="button" onClick={() => setEditing(false)}>
        Huỷ
      </button>
    </form>
  );
}
