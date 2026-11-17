import { useState } from "react";
import toast from "react-hot-toast";
import {
  recruitmentApi,
  type RecruitmentApplication,
  type RecruitmentInterview,
  type RecruitmentInterviewSlot
} from "@/service/recruitment";
import {
  EmptyState,
  Field,
  LoadingState,
  ModalShell,
  Pagination,
  STATUS_LABEL,
  StatusBadge,
  errorMessage,
  formatDate,
  inputClass
} from "./shared";
import { interviewRange, localRecruitmentTime } from "./workflow";
import { usePagedRecruitment } from "./usePagedRecruitment";

export default function InterviewsPanel({
  canManage,
  reloadKey,
  onChanged
}: {
  canManage: boolean;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [view, setView] = useState("interviews");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<RecruitmentInterview | null>(null);
  const { result, loading, error, reload } = usePagedRecruitment(
    recruitmentApi.interviews,
    { page, limit: 20, status: status || undefined },
    reloadKey
  );
  const changed = () => {
    reload();
    onChanged();
  };
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className={inputClass} onClick={() => setView("interviews")}>
          Lịch phỏng vấn
        </button>
        <button className={inputClass} onClick={() => setView("slots")}>
          Khung giờ cho AI đề xuất
        </button>
        {canManage && view === "interviews" && (
          <button className={inputClass} onClick={() => setShowCreate(true)}>
            Tạo lịch phỏng vấn
          </button>
        )}
      </div>
      {view === "slots" ? (
        <SlotsPanel
          canManage={canManage}
          reloadKey={reloadKey}
          onChanged={onChanged}
        />
      ) : (
        <>
          <select
            aria-label="Lọc trạng thái phỏng vấn"
            className={inputClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Mọi trạng thái</option>
            {["PROPOSED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              )
            )}
          </select>
          {error && (
            <p role="alert" className="text-rose-700 text-xs">
              {error} <button onClick={reload}>Thử lại</button>
            </p>
          )}
          {loading ? (
            <LoadingState />
          ) : result?.data.length ? (
            <ul className="space-y-2">
              {result.data.map((item) => (
                <li key={item.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left hover:border-blue-300"
                    onClick={async () => {
                      try {
                        setSelected(await recruitmentApi.interview(item.id));
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold">
                        {item.candidate?.fullName ||
                          `Ứng viên #${item.candidateId}`}{" "}
                        · {item.job?.title}
                      </p>
                      <p className="mt-1 text-xs">
                        {formatDate(item.scheduledStart, true)} –{" "}
                        {formatDate(item.scheduledEnd, true)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.location ||
                          (item.meetingUrl ? "Trực tuyến" : "Chưa có địa điểm")}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !error && (
              <EmptyState
                title="Chưa có lịch phù hợp"
                text="Tạo lịch cho hồ sơ đủ điều kiện hoặc mở khung giờ để AI đề xuất."
              />
            )
          )}
          {result && (
            <Pagination
              page={page}
              total={result.total}
              limit={20}
              onChange={setPage}
            />
          )}
        </>
      )}
      {showCreate && (
        <InterviewForm
          onClose={() => setShowCreate(false)}
          onChanged={() => {
            setShowCreate(false);
            changed();
          }}
        />
      )}
      {selected && (
        <EditInterview
          key={selected.id}
          initial={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}

export function InterviewForm({
  application,
  onClose,
  onChanged
}: {
  application?: RecruitmentApplication;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [chosen, setChosen] = useState<RecruitmentApplication | undefined>(
    application
  );
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [slotPage, setSlotPage] = useState(1);
  const [method, setMethod] = useState("slot");
  const [slotId, setSlotId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date().toISOString());
  const apps = usePagedRecruitment(recruitmentApi.applications, {
    status: "QUALIFIED,NEEDS_HR_REVIEW,INTERVIEW",
    keyword: keyword || undefined,
    page,
    limit: 20
  });
  const slots = usePagedRecruitment(recruitmentApi.interviewSlots, {
    activeOnly: true,
    from: now,
    page: slotPage,
    limit: 20
  });
  return (
    <ModalShell
      title="Tạo lịch phỏng vấn"
      subtitle="Giờ Việt Nam (UTC+7). Lịch mới chờ xác nhận; thao tác này không gửi tin Zalo."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!chosen || busy) return;
          setBusy(true);
          try {
            const range =
              method === "manual" ? interviewRange(start, end) : null;
            await recruitmentApi.createInterview({
              applicationId: chosen.id,
              ...(range
                ? { scheduledStart: range.from, scheduledEnd: range.to }
                : { slotId: Number(slotId) }),
              ...(location.trim() ? { location: location.trim() } : {}),
              ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
              notes: notes.trim() || undefined
            });
            toast.success("Đã tạo lịch chờ xác nhận");
            onChanged();
          } catch (e) {
            toast.error(
              errorMessage(e) === "Không thể tải dữ liệu tuyển dụng." &&
                e instanceof Error
                ? e.message
                : errorMessage(e)
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {application ? (
          <p className="text-xs font-bold">
            Hồ sơ #{application.id} · {application.candidate?.fullName} ·{" "}
            {application.job?.title}
          </p>
        ) : (
          <>
            <input
              aria-label="Tìm hồ sơ phỏng vấn"
              className={inputClass}
              placeholder="Tìm ứng viên đủ điều kiện…"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
                setChosen(undefined);
                setSlotId("");
              }}
            />
            {apps.error && <p role="alert">{apps.error}</p>}
            <select
              aria-label="Hồ sơ phỏng vấn"
              required
              className={inputClass}
              value={chosen?.id ?? ""}
              disabled={apps.loading}
              onChange={(e) => {
                setChosen(
                  apps.result?.data.find((a) => a.id === Number(e.target.value))
                );
                setSlotId("");
              }}
            >
              <option value="">Chọn hồ sơ ứng tuyển</option>
              {apps.result?.data.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} ·{" "}
                  {a.candidate?.fullName || `Ứng viên #${a.candidateId}`} ·{" "}
                  {a.job?.title}
                </option>
              ))}
            </select>
            {apps.result && (
              <Pagination
                page={page}
                total={apps.result.total}
                limit={20}
                onChange={(value) => {
                  setPage(value);
                  setChosen(undefined);
                  setSlotId("");
                }}
              />
            )}
          </>
        )}
        <Field label="Cách đặt lịch">
          <select
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="slot">Chọn khung giờ đã mở</option>
            <option value="manual">HR nhập giờ trực tiếp</option>
          </select>
        </Field>
        {method === "slot" ? (
          <>
            {slots.error && <p role="alert">{slots.error}</p>}
            <select
              aria-label="Khung giờ phỏng vấn"
              required
              className={inputClass}
              value={slotId}
              disabled={!chosen || slots.loading}
              onChange={(e) => setSlotId(e.target.value)}
            >
              <option value="">Chọn khung giờ</option>
              {slots.result?.data.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  disabled={
                    s.bookedCount >= s.capacity ||
                    (!!s.jobId && s.jobId !== chosen?.jobId)
                  }
                >
                  {formatDate(s.startAt, true)} · {s.location || "Trực tuyến"} ·{" "}
                  {s.bookedCount}/{s.capacity}
                  {s.jobId ? ` · Vị trí #${s.jobId}` : " · Dùng chung"}
                </option>
              ))}
            </select>
            {slots.result && (
              <Pagination
                page={slotPage}
                total={slots.result.total}
                limit={20}
                onChange={(value) => {
                  setSlotPage(value);
                  setSlotId("");
                }}
              />
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu">
              <input
                type="datetime-local"
                required
                className={inputClass}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Kết thúc">
              <input
                type="datetime-local"
                required
                className={inputClass}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
        )}
        <Field label="Địa điểm (bỏ trống để dùng theo khung giờ)">
          <input
            maxLength={500}
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <Field label="Link phỏng vấn">
          <input
            type="url"
            maxLength={1000}
            className={inputClass}
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
          />
        </Field>
        <Field label="Ghi chú HR">
          <textarea
            maxLength={2000}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <button
          disabled={busy || !chosen || (method === "slot" && !slotId)}
          className={inputClass}
        >
          Tạo lịch chờ xác nhận
        </button>
      </form>
    </ModalShell>
  );
}

function EditInterview({
  initial,
  canManage,
  onClose,
  onChanged
}: {
  initial: RecruitmentInterview;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState(initial);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState(initial.notes || "");
  const [location, setLocation] = useState(initial.location || "");
  const [meetingUrl, setMeetingUrl] = useState(initial.meetingUrl || "");
  const [reschedule, setReschedule] = useState(false);
  const [start, setStart] = useState(
    localRecruitmentTime(initial.scheduledStart)
  );
  const [end, setEnd] = useState(localRecruitmentTime(initial.scheduledEnd));
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell
      title={`Lịch phỏng vấn #${item.id}`}
      subtitle="Xác nhận sau khi ứng viên đã đồng ý lịch. Giờ Việt Nam (UTC+7)."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const range = reschedule ? interviewRange(start, end) : null;
            setItem(
              await recruitmentApi.updateInterview(item.id, {
                ...(status ? { status } : {}),
                ...(status === "CANCELLED"
                  ? { cancellationReason: reason.trim() }
                  : {}),
                ...(range
                  ? { scheduledStart: range.from, scheduledEnd: range.to }
                  : {}),
                ...(notes !== (item.notes || "") ? { notes } : {}),
                ...(location !== (item.location || "") ? { location } : {}),
                ...(meetingUrl !== (item.meetingUrl || "")
                  ? { meetingUrl: meetingUrl || null }
                  : {})
              })
            );
            toast.success("Đã cập nhật lịch");
            setStatus("");
            setReschedule(false);
            onChanged();
          } catch (e) {
            toast.error(
              e instanceof Error && !(e as any).response
                ? e.message
                : errorMessage(e)
            );
            try {
              setItem(await recruitmentApi.interview(item.id));
            } catch {
              /* keep draft */
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-xs">
          {item.candidate?.fullName} · {item.job?.title}
        </p>
        <StatusBadge status={item.status} />
        <p className="text-xs">
          {formatDate(item.scheduledStart, true)} –{" "}
          {formatDate(item.scheduledEnd, true)}
        </p>
        {item.meetingUrl && (
          <a
            className="text-xs text-blue-700"
            href={item.meetingUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mở link phỏng vấn
          </a>
        )}
        {item.cancellationReason && (
          <p className="text-xs">Lý do huỷ: {item.cancellationReason}</p>
        )}
        <fieldset disabled={!canManage || busy} className="space-y-3">
          {!!item.allowedNextStatuses?.length && (
            <Field label="Trạng thái mới">
              <select
                aria-label="Trạng thái mới"
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Giữ trạng thái hiện tại</option>
                {item.allowedNextStatuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {status === "CANCELLED" && (
            <Field label="Lý do huỷ">
              <textarea
                required
                maxLength={2000}
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          )}
          {["PROPOSED", "CONFIRMED"].includes(item.status) && (
            <label className="text-xs block">
              <input
                type="checkbox"
                checked={reschedule}
                onChange={(e) => setReschedule(e.target.checked)}
              />{" "}
              Dời giờ phỏng vấn (trả chỗ khung giờ cũ)
            </label>
          )}
          {reschedule && (
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Bắt đầu mới"
                type="datetime-local"
                required
                className={inputClass}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <input
                aria-label="Kết thúc mới"
                type="datetime-local"
                required
                className={inputClass}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          )}
          <Field label="Địa điểm">
            <input
              maxLength={500}
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field label="Link phỏng vấn">
            <input
              type="url"
              maxLength={1000}
              className={inputClass}
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              maxLength={2000}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          {canManage && (
            <button
              disabled={status === "CANCELLED" && !reason.trim()}
              className={inputClass}
            >
              Lưu lịch phỏng vấn
            </button>
          )}
        </fieldset>
      </form>
    </ModalShell>
  );
}

function SlotsPanel({
  canManage,
  reloadKey,
  onChanged
}: {
  canManage: boolean;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [onlyActive, setOnlyActive] = useState(true);
  const [form, setForm] = useState<RecruitmentInterviewSlot | "new" | null>(
    null
  );
  const [busy, setBusy] = useState<number | null>(null);
  const { result, loading, error, reload } = usePagedRecruitment(
    recruitmentApi.interviewSlots,
    { page, limit: 20, activeOnly: onlyActive },
    reloadKey
  );
  return (
    <section className="space-y-3">
      <div className="flex gap-3 items-center">
        <label className="text-xs">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => {
              setOnlyActive(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Chỉ khung giờ đang mở
        </label>
        {canManage && (
          <button className={inputClass} onClick={() => setForm("new")}>
            Mở khung giờ
          </button>
        )}
      </div>
      {error && (
        <p role="alert">
          {error} <button onClick={reload}>Thử lại</button>
        </p>
      )}
      {loading ? (
        <LoadingState />
      ) : (
        <ul className="space-y-2">
          {result?.data.map((s) => (
            <li className="rounded-xl border p-4 text-xs space-y-2" key={s.id}>
              <p className="font-bold">
                {formatDate(s.startAt, true)} – {formatDate(s.endAt, true)}
              </p>
              <p>
                {s.location || "Chưa có địa điểm"} ·{" "}
                {s.jobId ? `Vị trí #${s.jobId}` : "Dùng chung"} ·{" "}
                {s.bookedCount}/{s.capacity} đã đặt ·{" "}
                {s.isActive ? "Đang mở" : "Đã đóng"}
              </p>
              {canManage && (
                <div className="flex gap-3">
                  <button
                    className="text-blue-700"
                    disabled={busy !== null}
                    onClick={() => setForm(s)}
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(s.id);
                      try {
                        await recruitmentApi.updateInterviewSlot(s.id, {
                          isActive: !s.isActive
                        });
                        toast.success(
                          s.isActive
                            ? "Đã đóng khung giờ; lịch đã đặt được giữ nguyên"
                            : "Đã mở lại khung giờ"
                        );
                        reload();
                        onChanged();
                      } catch (e) {
                        toast.error(errorMessage(e));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {s.isActive ? "Đóng khung giờ" : "Mở lại"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && !result?.data.length && (
        <EmptyState
          title="Chưa có khung giờ"
          text="HR mở khung giờ để AI chỉ đề xuất những lịch hợp lệ."
        />
      )}
      {result && (
        <Pagination
          page={page}
          total={result.total}
          limit={20}
          onChange={setPage}
        />
      )}
      {form && (
        <SlotForm
          key={form === "new" ? "new" : form.id}
          initial={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onChanged={() => {
            setForm(null);
            reload();
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function SlotForm({
  initial,
  onClose,
  onChanged
}: {
  initial?: RecruitmentInterviewSlot;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [start, setStart] = useState(
    initial ? localRecruitmentTime(initial.startAt) : ""
  );
  const [end, setEnd] = useState(
    initial ? localRecruitmentTime(initial.endAt) : ""
  );
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(initial?.meetingUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell
      title={
        initial ? `Sửa khung giờ #${initial.id}` : "Mở khung giờ dùng chung"
      }
      subtitle="Giờ Việt Nam (UTC+7). Khung giờ có người đặt không thể đổi giờ."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const changedTime =
              !initial ||
              start !== localRecruitmentTime(initial.startAt) ||
              end !== localRecruitmentTime(initial.endAt);
            const range = changedTime ? interviewRange(start, end) : null;
            const payload = {
              capacity,
              location,
              meetingUrl: meetingUrl || undefined,
              notes,
              ...(range ? { startAt: range.from, endAt: range.to } : {})
            };
            if (initial)
              await recruitmentApi.updateInterviewSlot(initial.id, {
                ...payload,
                meetingUrl: meetingUrl || null
              });
            else
              await recruitmentApi.createInterviewSlot({
                ...payload,
                startAt: range!.from,
                endAt: range!.to
              });
            toast.success("Đã lưu khung giờ");
            onChanged();
          } catch (e) {
            toast.error(
              e instanceof Error && !(e as any).response
                ? e.message
                : errorMessage(e)
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Bắt đầu">
          <input
            type="datetime-local"
            required
            disabled={!!initial?.bookedCount}
            className={inputClass}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Kết thúc">
          <input
            type="datetime-local"
            required
            disabled={!!initial?.bookedCount}
            className={inputClass}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <Field label="Sức chứa">
          <input
            type="number"
            min={Math.max(1, initial?.bookedCount ?? 0)}
            max={50}
            required
            className={inputClass}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </Field>
        <Field label="Địa điểm">
          <input
            maxLength={500}
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <Field label="Link phỏng vấn">
          <input
            type="url"
            maxLength={1000}
            className={inputClass}
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
          />
        </Field>
        <Field label="Ghi chú">
          <textarea
            maxLength={2000}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <button disabled={busy} className={inputClass}>
          Lưu khung giờ
        </button>
      </form>
    </ModalShell>
  );
}
