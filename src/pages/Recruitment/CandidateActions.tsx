import { useState } from "react";
import toast from "react-hot-toast";
import {
  recruitmentApi,
  type CandidateProfilePayload,
  type RecruitmentCandidateDetail
} from "@/service/recruitment";
import {
  Field,
  Pagination,
  errorCode,
  errorMessage,
  inputClass
} from "./shared";
import { profileChanges, uniqueList } from "./workflow";
import { usePagedRecruitment } from "./usePagedRecruitment";

const profileFields = [
  ["fullName", "Họ tên", "text", 255],
  ["phone", "Số điện thoại", "tel", 30],
  ["email", "Email", "email", 255],
  ["location", "Khu vực", "text", 255],
  ["education", "Học vấn", "text", 500],
  ["currentJob", "Công việc hiện tại", "text", 255],
  ["totalExperienceMonths", "Kinh nghiệm (tháng)", "number", 600],
  ["expectedSalary", "Lương mong muốn (VND)", "number", 1_000_000_000_000],
  ["availableFrom", "Ngày có thể bắt đầu", "date", 10],
  ["cvUrl", "Đường dẫn CV", "url", 1000]
] as const;

function initialProfile(candidate: RecruitmentCandidateDetail) {
  return Object.fromEntries([
    ...profileFields.map(([key]) => [key, String(candidate[key] ?? "")]),
    ["experienceSummary", candidate.experienceSummary ?? ""],
    ["notes", candidate.notes ?? ""],
    ["skills", candidate.skills.join(", ")]
  ]);
}

function payload(form: Record<string, string>): CandidateProfilePayload {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      key === "skills"
        ? uniqueList(value)
        : ["expectedSalary", "totalExperienceMonths"].includes(key)
          ? value === ""
            ? null
            : Number(value)
          : value.trim() || null
    ])
  );
}

export default function CandidateActions({
  candidate,
  onChanged
}: {
  candidate: RecruitmentCandidateDetail;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"edit" | "apply" | "privacy" | null>(null);
  const [form, setForm] = useState(() => initialProfile(candidate));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const close = () => {
    if (!busy) {
      setMode(null);
      setDuplicate(false);
      setAllowDuplicate(false);
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const changes = profileChanges(
        payload(initialProfile(candidate)),
        payload(form)
      );
      if (!Object.keys(changes).length) {
        setMode(null);
        return;
      }
      await recruitmentApi.updateCandidate(candidate.id, {
        ...changes,
        ...(allowDuplicate ? { allowDuplicate: true } : {})
      });
      toast.success("Đã lưu hồ sơ ứng viên");
      setMode(null);
      await onChanged();
    } catch (error) {
      if (errorCode(error) === "POSSIBLE_DUPLICATE") setDuplicate(true);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const privacy = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await recruitmentApi.requestCandidateDeletion(candidate.id, note.trim());
      toast.success("Đã ghi nhận yêu cầu xoá và chuyển HR xử lý");
      setMode(null);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <h3 className="text-xs font-bold">Thao tác HR</h3>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className={inputClass}
          onClick={() => {
            setForm(initialProfile(candidate));
            setDuplicate(false);
            setAllowDuplicate(false);
            setMode("edit");
          }}
        >
          Sửa hồ sơ
        </button>
        <button
          disabled={busy || !!candidate.deletionRequestedAt}
          className={inputClass}
          onClick={() => setMode("apply")}
        >
          Gắn vị trí tuyển dụng
        </button>
        {!candidate.deletionRequestedAt && (
          <button
            disabled={busy}
            className={inputClass}
            onClick={() => setMode("privacy")}
          >
            Ghi nhận yêu cầu xoá
          </button>
        )}
      </div>
      {mode === "edit" && (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {profileFields.map(([key, label, type, max]) => (
              <Field key={key} label={label}>
                <input
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  max={type === "number" ? max : undefined}
                  step={key === "expectedSalary" ? "0.01" : "1"}
                  maxLength={type === "number" ? undefined : max}
                  className={inputClass}
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setAllowDuplicate(false);
                    setDuplicate(false);
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Kỹ năng (phân cách bằng dấu phẩy)">
            <input
              maxLength={5000}
              className={inputClass}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </Field>
          {(
            [
              ["experienceSummary", "Tóm tắt kinh nghiệm"],
              ["notes", "Ghi chú nội bộ HR"]
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                maxLength={5000}
                className={inputClass}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          {duplicate && (
            <label className="block text-xs text-amber-800">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
              />{" "}
              Tôi đã đối chiếu cảnh báo trùng liên hệ và vẫn muốn lưu riêng hồ
              sơ này.
            </label>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || (duplicate && !allowDuplicate)}
              className={inputClass}
            >
              Lưu hồ sơ
            </button>
            <button type="button" disabled={busy} onClick={close}>
              Huỷ
            </button>
          </div>
        </form>
      )}
      {mode === "apply" && (
        <ApplicationForm
          candidateId={candidate.id}
          onClose={close}
          onChanged={async () => {
            setMode(null);
            await onChanged();
          }}
        />
      )}
      {mode === "privacy" && (
        <form onSubmit={privacy} className="space-y-3">
          <p className="text-xs text-rose-700">
            Chỉ ghi nhận khi ứng viên đã yêu cầu. AI sẽ dừng với ứng viên này và
            HR nhận việc xử lý dữ liệu; thao tác này chưa xoá hồ sơ.
          </p>
          <Field label="Nội dung yêu cầu của ứng viên">
            <textarea
              required
              maxLength={2000}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button disabled={busy || !note.trim()} className={inputClass}>
            Xác nhận ghi nhận yêu cầu
          </button>{" "}
          <button disabled={busy} type="button" onClick={close}>
            Huỷ
          </button>
        </form>
      )}
    </section>
  );
}

function ApplicationForm({
  candidateId,
  onClose,
  onChanged
}: {
  candidateId: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const { result, loading, error } = usePagedRecruitment(recruitmentApi.jobs, {
    status: "ACTIVE",
    keyword: keyword || undefined,
    page,
    limit: 20
  });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await recruitmentApi.createApplication(candidateId, Number(jobId));
          toast.success("Đã tạo hồ sơ ứng tuyển");
          await onChanged();
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        aria-label="Tìm vị trí đang tuyển"
        placeholder="Tìm vị trí đang tuyển…"
        className={inputClass}
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          setPage(1);
          setJobId("");
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
      <select
        required
        aria-label="Vị trí ứng tuyển"
        className={inputClass}
        value={jobId}
        disabled={loading}
        onChange={(e) => setJobId(e.target.value)}
      >
        <option value="">{loading ? "Đang tải…" : "Chọn vị trí"}</option>
        {result?.data.map((job) => (
          <option key={job.id} value={job.id}>
            {job.code} · {job.title}
          </option>
        ))}
      </select>
      {result && (
        <Pagination
          page={page}
          total={result.total}
          limit={20}
          onChange={(value) => {
            setPage(value);
            setJobId("");
          }}
        />
      )}
      <button disabled={busy || loading || !jobId} className={inputClass}>
        Tạo hồ sơ ứng tuyển
      </button>{" "}
      <button type="button" disabled={busy} onClick={onClose}>
        Huỷ
      </button>
    </form>
  );
}
