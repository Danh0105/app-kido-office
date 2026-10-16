import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  OctagonPause,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  recruitmentApi,
  type RecruitmentAiUsage,
  type RecruitmentEventStats,
  type RecruitmentHrAlert,
  type RecruitmentOverview,
  type RecruitmentRuntimeControls,
  type RuntimeScope,
} from "@/service/recruitment";

import {
  ALERT_TYPE_LABEL,
  AiUsagePanel,
  ConfirmDialog,
  SEVERITY_TONE,
  errorMessage,
  formatDate,
  formatNumber,
} from "./shared";

const SCOPES: {
  scope: RuntimeScope;
  key: keyof RecruitmentRuntimeControls;
  label: string;
  hint: string;
}[] = [
  {
    scope: "AI",
    key: "aiHalted",
    label: "AI xử lý",
    hint: "API AI + lượt mới của worker",
  },
  {
    scope: "WORKER",
    key: "workerHalted",
    label: "Worker tin đến",
    hint: "nhận và xử lý tin Zalo đến",
  },
  {
    scope: "OUTBOUND",
    key: "outboundHalted",
    label: "Gửi Zalo",
    hint: "mở kết nối gửi tin đã duyệt",
  },
];

const ACTION_LABEL: Record<string, string> = {
  JOB_CREATE: "Tạo vị trí",
  JOB_UPDATE: "Sửa vị trí",
  JOB_PUBLISH: "Công bố vị trí",
  JOB_PAUSE: "Tạm dừng vị trí",
  JOB_CLOSE: "Đóng vị trí",
  CANDIDATE_CREATE: "Tạo ứng viên",
  CANDIDATE_UPDATE: "Cập nhật ứng viên",
  CANDIDATE_DELETION_REQUEST: "Yêu cầu xoá dữ liệu",
  APPLICATION_CREATE: "Tạo hồ sơ ứng tuyển",
  APPLICATION_STATUS_CHANGE: "Đổi trạng thái hồ sơ",
  APPLICATION_SCREEN: "Sàng lọc hồ sơ",
  APPLICATION_RESUME_AI: "Trả hồ sơ cho AI",
  HANDOFF_CREATE: "Chuyển HR",
  HANDOFF_RESOLVE: "HR xử lý yêu cầu",
  INTERVIEW_SLOT_CREATE: "Tạo lịch trống",
  INTERVIEW_SLOT_UPDATE: "Sửa lịch trống",
  INTERVIEW_CREATE: "Tạo lịch phỏng vấn",
  INTERVIEW_PROPOSE: "Đề xuất phỏng vấn",
  INTERVIEW_CONFIRM: "Xác nhận phỏng vấn",
  INTERVIEW_UPDATE: "Cập nhật phỏng vấn",
  AI_SUBJECT_DENIED: "Chặn truy cập sai danh tính",
  CHANNEL_EVENT_DEAD_LETTER: "Tin đến lỗi",
  CHANNEL_EVENT_EXCLUDE: "Loại tin đến",
  CHANNEL_OUTBOX_DEAD_LETTER: "Tin gửi lỗi",
  CHANNEL_OUTBOX_UNKNOWN: "Tin gửi chưa rõ",
  CHANNEL_OUTBOX_SUPPRESSED: "Chặn gửi tin AI",
  CHANNEL_QUARANTINE_VERIFY: "Xác minh webhook cách ly",
  CONVERSATION_TAKEOVER: "HR tiếp quản",
  CONVERSATION_RESUME_AI: "Trả hội thoại cho AI",
  CONVERSATION_CLOSE: "Đóng hội thoại",
  CONVERSATION_HR_MESSAGE: "HR gửi tin",
  OUTBOX_MARK_SENT: "Đánh dấu đã gửi",
  OUTBOX_RETRY: "Gửi lại tin",
  OUTBOX_DEAD_LETTER: "Bỏ tin gửi lỗi",
  OUTBOX_APPROVE: "Duyệt tin AI",
  OUTBOX_EDIT_AND_APPROVE: "Sửa và duyệt tin AI",
  OUTBOX_REJECT: "Từ chối tin AI",
  OUTBOX_APPROVAL_REVOKE: "Thu hồi duyệt",
  OUTBOX_APPROVAL_EXPIRE: "Duyệt hết hạn",
  HR_ALERT_ACKNOWLEDGE: "Xác nhận cảnh báo",
  RUNTIME_STOP: "Dừng khẩn",
  RUNTIME_RESUME: "Mở lại sau dừng khẩn",
};

export default function OperationsPanel({
  canManage,
  overview,
  aiUsage,
  onChanged,
}: {
  canManage: boolean;
  overview: RecruitmentOverview | null;
  aiUsage: RecruitmentAiUsage | null;
  onChanged: () => void;
}) {
  const [runtime, setRuntime] = useState<RecruitmentRuntimeControls | null>(
    null
  );
  const [stats, setStats] = useState<RecruitmentEventStats | null>(null);
  const [alerts, setAlerts] = useState<RecruitmentHrAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{
    kind: "stop" | "resume";
    scopes: RuntimeScope[];
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s, a] = await Promise.allSettled([
      recruitmentApi.runtimeControls(),
      recruitmentApi.eventStats(),
      recruitmentApi.alerts({ status: "OPEN", limit: 50 }),
    ]);
    if (r.status === "fulfilled") setRuntime(r.value);
    if (s.status === "fulfilled") setStats(s.value);
    if (a.status === "fulfilled") setAlerts(a.value);
    if ([r, s, a].some((x) => x.status === "rejected"))
      toast.error("Một phần dữ liệu vận hành chưa tải được");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRuntime = async () => {
    if (!pendingAction || reason.trim().length < 5) return;
    setBusy(true);
    try {
      const fn =
        pendingAction.kind === "stop"
          ? recruitmentApi.stopRuntime
          : recruitmentApi.resumeRuntime;
      setRuntime(await fn(pendingAction.scopes, reason.trim()));
      toast.success(
        pendingAction.kind === "stop" ? "Đã dừng khẩn" : "Đã mở lại"
      );
      setPendingAction(null);
      setReason("");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async (alert: RecruitmentHrAlert) => {
    try {
      await recruitmentApi.acknowledgeAlert(alert.id);
      setAlerts((list) => list.filter((a) => a.id !== alert.id));
      toast.success("Đã xác nhận cảnh báo");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const counts = overview?.counts;
  const failedEvents = (stats?.byStatus || []).filter(
    (s) => s.status === "FAILED"
  );
  const waitingEvents = (stats?.byStatus || [])
    .filter((s) => s.status === "RECEIVED" || s.status === "PROCESSING")
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-5 p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Dừng khẩn</h3>
            <p className="text-[10px] text-slate-400">
              Có hiệu lực ngay, không cần khởi động lại. Bật tính năng (AI,
              worker, Zalo outbound) là cấu hình triển khai do quản trị hệ thống
              thực hiện sau khi có phê duyệt GO.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Làm mới"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {runtime?.failClosed && (
          <p className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertTriangle size={15} className="shrink-0" /> Không đọc được
            trạng thái điều khiển — hệ thống tự coi như đã dừng cả ba.
          </p>
        )}
        {runtime?.failsafeHalted && (
          <p className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle size={15} className="shrink-0" /> Failsafe đã dừng AI
            {runtime.failsafeReason ? `: ${runtime.failsafeReason}` : ""} (
            {formatDate(runtime.failsafeAt, true)})
          </p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SCOPES.map((item) => {
            const halted = Boolean(runtime?.[item.key]);
            return (
              <div
                key={item.scope}
                className={`rounded-xl border p-3 ${
                  halted ? "border-rose-200 bg-rose-50/60" : "border-slate-200"
                }`}
              >
                <p className="text-xs font-extrabold text-slate-800">
                  {item.label}
                </p>
                <p className="text-[10px] text-slate-400">{item.hint}</p>
                <p
                  className={`mt-2 text-xs font-bold ${
                    halted ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {runtime ? (halted ? "Đang dừng khẩn" : "Không dừng") : "—"}
                </p>
                {canManage && runtime && (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({
                        kind: halted ? "resume" : "stop",
                        scopes: [item.scope],
                      })
                    }
                    className={`mt-2 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold ${
                      halted
                        ? "border border-emerald-200 text-emerald-700"
                        : "border border-rose-200 text-rose-600"
                    }`}
                  >
                    {halted ? (
                      <PlayCircle size={13} />
                    ) : (
                      <OctagonPause size={13} />
                    )}
                    {halted ? "Mở lại" : "Dừng khẩn"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {canManage && runtime && (
          <button
            type="button"
            onClick={() =>
              setPendingAction({
                kind: "stop",
                scopes: ["AI", "WORKER", "OUTBOUND"],
              })
            }
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold text-white sm:w-auto sm:px-4"
          >
            <OctagonPause size={15} /> Dừng khẩn tất cả
          </button>
        )}
        {runtime?.reason && (
          <p className="mt-2 text-[10px] text-slate-400">
            Lần đổi gần nhất: {runtime.reason} ·{" "}
            {formatDate(runtime.updatedAt, true)}
          </p>
        )}
      </section>

      {aiUsage && <AiUsagePanel usage={aiUsage} />}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-extrabold text-slate-800">
            Hàng đợi tin đến
          </h3>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {formatNumber(waitingEvents)}
          </p>
          <p className="text-[10px] text-slate-400">tin chờ xử lý</p>
          {failedEvents.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-rose-600">
              {failedEvents.map((s) => (
                <li key={`${s.status}-${s.failureCode}`}>
                  Lỗi {s.failureCode || "khác"}: {s.count} tin
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-extrabold text-slate-800">
            Hàng đợi gửi Zalo
          </h3>
          {counts ? (
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-slate-500">Chờ duyệt</dt>
              <dd className="text-right font-bold">
                {counts.awaitingApproval}
              </dd>
              <dt className="text-slate-500">Đã duyệt, chờ gửi</dt>
              <dd className="text-right font-bold">
                {counts.approvedWaitingSend}
              </dd>
              <dt className="text-slate-500">Đang gửi lại</dt>
              <dd className="text-right font-bold">{counts.sendRetrying}</dd>
              <dt className="text-slate-500">Lỗi / chưa rõ</dt>
              <dd className="text-right font-bold text-rose-600">
                {counts.sendFailed}
              </dd>
              <dt className="text-slate-500">Đã gửi</dt>
              <dd className="text-right font-bold text-emerald-600">
                {counts.sent}
              </dd>
            </dl>
          ) : (
            <p className="mt-2 text-xs text-slate-400">Chưa có dữ liệu.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-extrabold text-slate-800">
          Cảnh báo cho Nhân sự ({alerts.length})
        </h3>
        {alerts.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700">
                    {ALERT_TYPE_LABEL[alert.type] || alert.type}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {formatDate(alert.createdAt, true)}
                    {alert.conversationId &&
                      ` · hội thoại #${alert.conversationId}`}
                    {alert.details &&
                      typeof alert.details.code === "string" &&
                      ` · ${alert.details.code}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      SEVERITY_TONE[alert.severity] || SEVERITY_TONE.LOW
                    }`}
                  >
                    {alert.severity}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void acknowledge(alert)}
                      aria-label="Xác nhận đã xử lý"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-emerald-600"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Không có cảnh báo đang mở.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-extrabold text-slate-800">
          Hoạt động tuyển dụng gần đây
        </h3>
        {overview?.recent.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.recent.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="font-semibold">
                    {ACTION_LABEL[item.action] || item.action}
                  </span>{" "}
                  ·{" "}
                  {item.actorName || (item.actorId === -1 ? "AI" : "Hệ thống")}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {formatDate(item.createdAt, true)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Chưa có hoạt động.</p>
        )}
      </section>

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.kind === "stop"
              ? `Dừng khẩn ${
                  pendingAction.scopes.length === 3
                    ? "tất cả"
                    : SCOPES.find((s) => s.scope === pendingAction.scopes[0])
                        ?.label
                }?`
              : `Mở lại ${
                  SCOPES.find((s) => s.scope === pendingAction.scopes[0])?.label
                }?`
          }
          message={
            pendingAction.kind === "stop"
              ? "Có hiệu lực trong một chu kỳ xử lý; tin chưa gửi được giữ nguyên chờ. Thao tác ghi vào nhật ký."
              : "Chỉ mở lại khi đã xác nhận nguyên nhân dừng và có phê duyệt vận hành. Thao tác ghi vào nhật ký."
          }
          confirmLabel={pendingAction.kind === "stop" ? "Dừng khẩn" : "Mở lại"}
          tone={pendingAction.kind === "stop" ? "danger" : "primary"}
          busy={busy}
          confirmDisabled={reason.trim().length < 5}
          onCancel={() => {
            setPendingAction(null);
            setReason("");
          }}
          onConfirm={() => void changeRuntime()}
        >
          <label className="mt-3 block">
            <span className="mb-1 block text-[10px] font-bold text-slate-600">
              Lý do (tối thiểu 5 ký tự) *
            </span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
