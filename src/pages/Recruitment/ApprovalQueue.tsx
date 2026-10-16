import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  Pencil,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  recruitmentApi,
  type ApprovalView,
  type RecruitmentApprovalDetail,
  type RecruitmentApprovalItem,
  type RecruitmentOverview,
} from "@/service/recruitment";

import { MessageBubble } from "./chat";
import {
  APPROVAL_STATE_LABEL,
  CONTROL_MODE_LABEL,
  ConfirmDialog,
  DrawerShell,
  EmptyState,
  LoadingState,
  OUTBOX_STATUS_LABEL,
  Pagination,
  errorMessage,
  formatDate,
  httpStatus,
  newRequestId,
} from "./shared";

const VIEWS: { value: ApprovalView; label: string }[] = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt, chờ gửi" },
  { value: "sent", label: "Đã gửi" },
  { value: "rejected", label: "Từ chối / thu hồi" },
  { value: "failed", label: "Gửi lỗi" },
  { value: "all", label: "Tất cả" },
];

const EVENT_LABEL: Record<string, string> = {
  CREATED: "AI tạo bản nháp",
  APPROVED: "Đã duyệt",
  EDITED_AND_APPROVED: "Đã sửa và duyệt",
  REJECTED: "Đã từ chối",
  REVOKED: "Thu hồi (hội thoại đổi trạng thái)",
  EXPIRED: "Hết hạn duyệt",
};

/** Lỗi nghiệp vụ của API duyệt (p32) → câu tiếng Việt cho HR. */
const APPROVAL_ERRORS: Record<string, string> = {
  APPROVAL_PRECONDITION_FAILED:
    "Tin đã thay đổi trạng thái (có thể HR khác vừa xử lý hoặc hội thoại đã được tiếp quản).",
  EDIT_APPROVAL_PRECONDITION_FAILED:
    "Tin đã thay đổi trạng thái, không còn sửa được.",
  REJECTION_PRECONDITION_FAILED: "Tin đã được xử lý, không còn từ chối được.",
  APPROVAL_REQUEST_ID_REUSED: "Thao tác trùng mã yêu cầu — vui lòng thử lại.",
  APPROVAL_UPDATE_FAILED: "Không cập nhật được bản duyệt — vui lòng thử lại.",
  EDITED_TEXT_UNCHANGED_USE_APPROVE: "Nội dung không đổi — hãy dùng nút Duyệt.",
  APPROVAL_TEXT_LENGTH_INVALID: "Nội dung phải từ 1 đến 2.000 ký tự.",
  RECRUITMENT_APPROVAL_FORBIDDEN: "Bạn không có quyền duyệt tin AI.",
  REJECTION_REASON_INVALID: "Lý do từ chối phải từ 1 đến 500 ký tự.",
  AI_OUTBOX_NOT_FOUND: "Không tìm thấy tin AI.",
};

const approvalError = (error: unknown) => {
  const message = errorMessage(error);
  return APPROVAL_ERRORS[message] || message;
};

const countFor = (
  view: ApprovalView,
  counts?: RecruitmentOverview["counts"]
) => {
  if (!counts) return null;
  switch (view) {
    case "pending":
      return counts.awaitingApproval;
    case "approved":
      return counts.approvedWaitingSend;
    case "sent":
      return counts.sent;
    case "rejected":
      return counts.rejected + counts.revokedOrExpired;
    case "failed":
      return counts.sendFailed;
    default:
      return null;
  }
};

function StateBadge({ item }: { item: RecruitmentApprovalItem }) {
  const text =
    item.status === "AWAITING_APPROVAL" || item.status === "SUPPRESSED"
      ? APPROVAL_STATE_LABEL[item.approvalState || ""] ||
        OUTBOX_STATUS_LABEL[item.status]
      : OUTBOX_STATUS_LABEL[item.status] || item.status;
  const tone =
    item.status === "AWAITING_APPROVAL"
      ? "bg-amber-50 text-amber-700 ring-amber-600/15"
      : item.status === "SENT"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
      : item.status === "UNKNOWN" || item.status === "DEAD_LETTER"
      ? "bg-rose-50 text-rose-700 ring-rose-600/15"
      : item.status === "SUPPRESSED"
      ? "bg-slate-100 text-slate-500 ring-slate-500/15"
      : "bg-blue-50 text-[#005BEA] ring-blue-600/15";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${tone}`}
    >
      {text}
    </span>
  );
}

export default function ApprovalQueue({
  canManage,
  counts,
  onChanged,
}: {
  canManage: boolean;
  counts?: RecruitmentOverview["counts"];
  onChanged: () => void;
}) {
  const [view, setView] = useState<ApprovalView>("pending");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: RecruitmentApprovalItem[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const limit = 20;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await recruitmentApi.approvals({ view, page, limit });
        setResult({ data: data.data, total: data.total });
      } catch (error) {
        if (!silent) toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [view, page]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Tự làm mới để thấy thao tác của HR khác (không tải khi tab ẩn / đang mở chi tiết).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && selected === null)
        void load(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load, selected]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
          {VIEWS.map((item) => {
            const n = countFor(item.value, counts);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setView(item.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                  view === item.value
                    ? "bg-white text-[#005BEA] shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
                {n != null && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                      item.value === "pending" && n > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-9 items-center gap-2 self-start rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 lg:self-auto"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>
      <p className="flex items-start gap-2 bg-blue-50/60 px-4 py-2.5 text-[11px] leading-5 text-blue-900">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        Mọi tin AI soạn chỉ được gửi tới ứng viên sau khi Nhân sự duyệt. Bản
        duyệt gắn với đúng nội dung, người nhận và trạng thái hội thoại; hết
        hiệu lực sau 30 phút hoặc khi hội thoại đổi trạng thái.
      </p>
      {loading && !result ? (
        <LoadingState />
      ) : !result?.data.length ? (
        <EmptyState
          title={
            view === "pending" ? "Không có tin chờ duyệt" : "Chưa có tin nào"
          }
          text="Tin AI soạn cho ứng viên qua Zalo OA sẽ xuất hiện tại đây."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {result.data.map((item) => (
            <li key={item.outboxId}>
              <button
                type="button"
                onClick={() => setSelected(item.outboxId)}
                className="w-full px-4 py-3.5 text-left transition hover:bg-blue-50/40 focus-visible:bg-blue-50/60 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-800">
                      {item.candidateName || `Ứng viên #${item.candidateId}`}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">
                      {item.jobTitle || "Chưa gắn vị trí"} · AI soạn{" "}
                      {formatDate(item.draftedAt, true)}
                    </p>
                  </div>
                  <StateBadge item={item} />
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-600">
                  {item.messageText || "(nội dung đã được xoá)"}
                </p>
                {(item.approvedByName || item.rejectedByName) && (
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    {item.rejectedByName
                      ? `Từ chối bởi ${item.rejectedByName} · ${formatDate(
                          item.rejectedAt,
                          true
                        )}`
                      : `Duyệt bởi ${item.approvedByName} · ${formatDate(
                          item.approvedAt,
                          true
                        )}`}
                  </p>
                )}
                {item.lastErrorCode && item.status !== "SENT" && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">
                    Mã lỗi: {item.lastErrorCode}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {result && (
        <Pagination
          page={page}
          limit={limit}
          total={result.total}
          onChange={setPage}
        />
      )}
      {selected !== null && (
        <ApprovalDrawer
          outboxId={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onChanged={() => {
            onChanged();
            void load(true);
          }}
        />
      )}
    </div>
  );
}

type Action = "approve" | "edit" | "reject";
type Reconcile = "sent" | "retry" | "dead";

const RECONCILE_TEXT: Record<
  Reconcile,
  { title: string; message: string; label: string }
> = {
  sent: {
    title: "Đánh dấu đã gửi?",
    message:
      "Chỉ chọn khi đã kiểm tra (trên OA hoặc hỏi ứng viên) rằng tin đã tới. Tin không được gửi lại.",
    label: "Đã gửi",
  },
  retry: {
    title: "Gửi lại tin này?",
    message:
      "Tin có thể đã tới Zalo — gửi lại có thể khiến ứng viên nhận trùng. Bản duyệt vẫn được kiểm lại trước khi gửi.",
    label: "Gửi lại",
  },
  dead: {
    title: "Bỏ qua tin này?",
    message:
      "Tin chuyển sang Gửi lỗi, không gửi lại. Nhân sự liên hệ ứng viên trực tiếp nếu cần.",
    label: "Bỏ qua",
  },
};

function ApprovalDrawer({
  outboxId,
  canManage,
  onClose,
  onChanged,
}: {
  outboxId: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<RecruitmentApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [reconcile, setReconcile] = useState<Reconcile | null>(null);
  const [busy, setBusy] = useState(false);
  // Giữ requestId cho tới khi thao tác thành công → bấm lại không tạo quyết định thứ hai.
  const requestIds = useRef<Record<Action, string>>({
    approve: newRequestId(),
    edit: newRequestId(),
    reject: newRequestId(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recruitmentApi.approval(outboxId);
      setDetail(data);
      setDraft(data.messageText || "");
    } catch (error) {
      toast.error(approvalError(error));
    } finally {
      setLoading(false);
    }
  }, [outboxId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = detail?.status === "AWAITING_APPROVAL";
  const aiActive = detail?.controlMode === "AI_ACTIVE";
  const editInvalid =
    !draft.trim() ||
    draft.trim().length > 2000 ||
    draft.trim() === (detail?.messageText || "").trim();
  const reasonInvalid = !reason.trim() || reason.trim().length > 500;

  const run = async (action: Action) => {
    if (!detail) return;
    setBusy(true);
    try {
      const id = requestIds.current[action];
      if (action === "approve")
        await recruitmentApi.approveOutbox(detail.outboxId, id);
      if (action === "edit")
        await recruitmentApi.editAndApproveOutbox(
          detail.outboxId,
          draft.trim(),
          id
        );
      if (action === "reject")
        await recruitmentApi.rejectOutbox(detail.outboxId, reason.trim(), id);
      requestIds.current[action] = newRequestId();
      toast.success(
        action === "reject"
          ? "Đã từ chối tin AI"
          : "Đã duyệt — tin sẽ được gửi khi Zalo outbound mở"
      );
      setConfirm(null);
      setMode("view");
      onChanged();
      await load();
    } catch (error) {
      toast.error(approvalError(error));
      setConfirm(null);
      // 409: trạng thái đã đổi (HR khác / tiếp quản) → tải lại để thấy đúng hiện trạng.
      if (httpStatus(error) === 409) {
        requestIds.current[action] = newRequestId();
        setMode("view");
        onChanged();
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const runReconcile = async (action: Reconcile) => {
    if (!detail) return;
    setBusy(true);
    try {
      if (action === "sent")
        await recruitmentApi.markOutboxSent(detail.outboxId);
      if (action === "retry") await recruitmentApi.retryOutbox(detail.outboxId);
      if (action === "dead")
        await recruitmentApi.deadLetterOutbox(detail.outboxId);
      toast.success("Đã đối soát tin");
      onChanged();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
      if (httpStatus(error) === 409) await load();
    } finally {
      setReconcile(null);
      setBusy(false);
    }
  };

  const footer =
    canManage && detail && pending ? (
      mode === "view" ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("reject")}
            className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-xs font-bold text-rose-600"
          >
            <XCircle size={14} /> Từ chối
          </button>
          <button
            type="button"
            disabled={!aiActive}
            onClick={() => setMode("edit")}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 disabled:opacity-40"
          >
            <Pencil size={14} /> Sửa rồi duyệt
          </button>
          <button
            type="button"
            disabled={!aiActive}
            onClick={() => setConfirm("approve")}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 disabled:opacity-40"
          >
            <Check size={14} /> Duyệt
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("view")}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={mode === "edit" ? editInvalid : reasonInvalid}
            onClick={() => setConfirm(mode === "edit" ? "edit" : "reject")}
            className={`h-10 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-40 ${
              mode === "edit" ? "bg-[#005BEA]" : "bg-rose-600"
            }`}
          >
            {mode === "edit" ? "Duyệt bản đã sửa" : "Từ chối tin"}
          </button>
        </div>
      )
    ) : canManage && detail?.status === "UNKNOWN" ? (
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500">
          Tin có thể đã tới Zalo nhưng hệ thống không chắc — hệ thống không tự
          gửi lại. Kiểm tra rồi chọn:
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setReconcile("dead")}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={() => setReconcile("retry")}
            className="h-10 rounded-xl border border-amber-200 px-4 text-xs font-bold text-amber-700"
          >
            Gửi lại
          </button>
          <button
            type="button"
            onClick={() => setReconcile("sent")}
            className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
          >
            Đã gửi
          </button>
        </div>
      </div>
    ) : !canManage ? (
      <p className="flex items-center gap-2 text-xs font-semibold text-blue-800">
        <AlertCircle size={15} /> Chế độ chỉ xem. Duyệt tin thuộc quyền Nhân sự.
      </p>
    ) : null;

  return (
    <DrawerShell
      eyebrow={`Tin AI #${outboxId}`}
      title={
        detail
          ? detail.candidateName || `Ứng viên #${detail.candidateId}`
          : "Chi tiết tin AI"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
      busy={loading || busy}
      footer={footer}
    >
      {!detail ? (
        loading ? (
          <LoadingState />
        ) : (
          <EmptyState title="Không tải được tin" text="Thử đóng và mở lại." />
        )
      ) : (
        <div className="space-y-5 p-5">
          <section className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <StateBadge item={detail} />
            <span>{detail.jobTitle || "Chưa gắn vị trí"}</span>
            <span>·</span>
            <span>
              Hội thoại:{" "}
              {CONTROL_MODE_LABEL[detail.controlMode] || detail.controlMode}
            </span>
          </section>
          {pending && !aiActive && (
            <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle size={15} className="shrink-0" />
              Hội thoại không còn ở chế độ AI hỗ trợ — tin này không duyệt được,
              chỉ có thể từ chối.
            </p>
          )}
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {mode === "edit"
                ? "Sửa nội dung trước khi duyệt"
                : "Nội dung AI đề xuất"}
            </h3>
            {mode === "edit" ? (
              <>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-invalid={editInvalid}
                  className="min-h-40 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-right text-[10px] text-slate-400">
                  {draft.trim().length}/2000
                  {draft.trim() === (detail.messageText || "").trim() &&
                    " · nội dung chưa đổi"}
                </p>
              </>
            ) : (
              <p className="whitespace-pre-line rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-slate-800">
                {detail.messageText || "(nội dung đã được xoá)"}
              </p>
            )}
          </section>
          {mode === "reject" && (
            <section>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                  Lý do từ chối *
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-invalid={reasonInvalid}
                  placeholder="Ví dụ: thông tin lương chưa chính xác"
                  className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </section>
          )}
          {detail.approvalState === "APPROVED" && detail.expiresAt && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Clock3 size={13} /> Bản duyệt hiệu lực đến{" "}
              {formatDate(detail.expiresAt, true)}
            </p>
          )}
          {detail.rejectionReason && (
            <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              Lý do từ chối: {detail.rejectionReason}
            </p>
          )}
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Ngữ cảnh hội thoại
            </h3>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              {detail.context.length ? (
                detail.context.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    highlight={message.id === detail.messageId}
                  />
                ))
              ) : (
                <p className="text-xs text-slate-400">Chưa có tin trước đó.</p>
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Lịch sử duyệt
            </h3>
            <ol className="space-y-2">
              {detail.events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs"
                >
                  <p className="font-bold text-slate-700">
                    {EVENT_LABEL[event.action] || event.action}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {event.actorName ||
                      (event.actorId ? `#${event.actorId}` : "Hệ thống")}{" "}
                    · {formatDate(event.createdAt, true)} · phiên bản{" "}
                    {event.version}
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {event.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {reconcile && detail && (
        <ConfirmDialog
          title={RECONCILE_TEXT[reconcile].title}
          message={RECONCILE_TEXT[reconcile].message}
          confirmLabel={RECONCILE_TEXT[reconcile].label}
          tone={reconcile === "retry" ? "danger" : "primary"}
          busy={busy}
          onCancel={() => setReconcile(null)}
          onConfirm={() => void runReconcile(reconcile)}
        />
      )}
      {confirm && detail && (
        <ConfirmDialog
          title={
            confirm === "reject"
              ? "Từ chối tin AI này?"
              : confirm === "edit"
              ? "Duyệt bản đã sửa?"
              : "Duyệt tin AI này?"
          }
          message={
            confirm === "reject" ? (
              <>
                Tin sẽ không được gửi cho {detail.candidateName || "ứng viên"}.
                Thao tác được ghi vào nhật ký.
              </>
            ) : (
              <>
                Tin sẽ được gửi tới {detail.candidateName || "ứng viên"} qua
                Zalo OA khi outbound được bật. Bản duyệt gắn với đúng nội dung
                dưới đây và hết hiệu lực sau 30 phút.
                <span className="mt-2 block max-h-40 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-slate-700">
                  {confirm === "edit" ? draft.trim() : detail.messageText}
                </span>
              </>
            )
          }
          confirmLabel={confirm === "reject" ? "Từ chối" : "Duyệt"}
          tone={confirm === "reject" ? "danger" : "primary"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(confirm)}
        />
      )}
    </DrawerShell>
  );
}
