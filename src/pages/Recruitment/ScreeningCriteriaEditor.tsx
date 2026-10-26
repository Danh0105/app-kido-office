import { useState } from "react";
import toast from "react-hot-toast";
import {
  recruitmentApi,
  type RecruitmentJob,
  type RecruitmentScreeningCriteria
} from "@/service/recruitment";
import { Field, errorMessage, inputClass } from "./shared";
import { uniqueList } from "./workflow";

export default function ScreeningCriteriaEditor({
  job,
  onChanged
}: {
  job: RecruitmentJob;
  onChanged: (job: RecruitmentJob) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = job.screeningCriteria ?? {};
  const [required, setRequired] = useState(
    (current.requiredSkills ?? []).join(", ")
  );
  const [preferred, setPreferred] = useState(
    (current.preferredSkills ?? []).join(", ")
  );
  const [locations, setLocations] = useState(
    (current.locations ?? []).join(", ")
  );
  const [months, setMonths] = useState(
    String(current.minimumExperienceMonths ?? "")
  );
  const [days, setDays] = useState(String(current.maxStartDelayDays ?? ""));
  const [immediate, setImmediate] = useState(
    current.availableImmediatelyPreferred ?? false
  );
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
          const criteria: RecruitmentScreeningCriteria = {
            ...(months !== ""
              ? { minimumExperienceMonths: Number(months) }
              : {}),
            ...(days !== "" ? { maxStartDelayDays: Number(days) } : {}),
            requiredSkills: uniqueList(required),
            preferredSkills: uniqueList(preferred),
            locations: uniqueList(locations),
            availableImmediatelyPreferred: immediate
          };
          const updated = await recruitmentApi.updateJob(job.id, {
            screeningCriteria: criteria
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
      <Field label="Kinh nghiệm tối thiểu (tháng)">
        <input
          type="number"
          min={0}
          max={600}
          className={inputClass}
          value={months}
          onChange={(e) => setMonths(e.target.value)}
        />
      </Field>
      <Field label="Kỹ năng bắt buộc (dấu phẩy)">
        <input
          maxLength={3000}
          className={inputClass}
          value={required}
          onChange={(e) => setRequired(e.target.value)}
        />
      </Field>
      <Field label="Kỹ năng ưu tiên (dấu phẩy)">
        <input
          maxLength={3000}
          className={inputClass}
          value={preferred}
          onChange={(e) => setPreferred(e.target.value)}
        />
      </Field>
      <Field label="Khu vực làm việc (dấu phẩy)">
        <input
          maxLength={5000}
          className={inputClass}
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
        />
      </Field>
      <Field label="Số ngày tối đa để bắt đầu">
        <input
          type="number"
          min={0}
          max={365}
          className={inputClass}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </Field>
      <label className="block text-xs">
        <input
          type="checkbox"
          checked={immediate}
          onChange={(e) => setImmediate(e.target.checked)}
        />{" "}
        Ưu tiên có thể bắt đầu ngay
      </label>
      <button disabled={busy} className={inputClass}>
        Lưu tiêu chí
      </button>{" "}
      <button disabled={busy} type="button" onClick={() => setEditing(false)}>
        Huỷ
      </button>
    </form>
  );
}
