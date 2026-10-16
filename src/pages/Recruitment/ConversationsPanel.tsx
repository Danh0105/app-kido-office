import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Hand,
  Lock,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  recruitmentApi,
  type ConversationControlMode,
  type RecruitmentConversationControl,
  type RecruitmentConversationDetail,
  type RecruitmentConversationSummary,
} from "@/service/recruitment";

import { MessageBubble } from "./chat";
import {
  Avatar,
  CONTROL_MODE_LABEL,
  ConfirmDialog,
  DrawerShell,
  EmptyState,
  LoadingState,
  Pagination,
  SENDER_LABEL,
  STATUS_LABEL,
  errorMessage,
  formatDate,
  httpStatus,
  newRequestId,
} from "./shared";

const MODE_TONE: Record<string, string> = {
  AI_ACTIVE: "bg-violet-50 text-violet-700",
  AI_PAUSED: "bg-amber-50 text-amber-700",
  HUMAN_TAKEOVER: "bg-blue-50 text-[#005BEA]",
  CLOSED: "bg-slate-100 text-slate-500",
};

const PAUSE_REASON: Record<string, string> = {
  HANDOFF_OPEN: "đang có yêu cầu chuyển HR",
  APPLICATION_PAUSED: "hồ sơ đã tạm dừng AI",
  CANDIDATE_AI_STOPPED: "ứng viên yêu cầu dừng AI / xoá dữ liệu",
};

const CONTROL_ERRORS: Record<string, string> = {
  CONVERSATION_CLOSED: "Hội thoại đã đóng.",
  CHANNEL_NOT_SUPPORTED: "Hội thoại không thuộc kênh Zalo.",
  OA_MISMATCH: "Hội thoại thuộc OA khác.",
  CONTENT_INVALID: "Nội dung phải từ 1 đến 2.000 ký tự.",
};

const controlError = (error: unknown) => {
  const data = (error as { response?: { data?: { code?: string } } })?.response
    ?.data;
  return (data?.code && CONTROL_ERRORS[data.code]) || errorMessage(error);
};

export default function ConversationsPanel({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ConversationControlMode | "">("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: RecruitmentConversationSummary[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const limit = 20;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await recruitmentApi.conversations({
          keyword: query || undefined,
          mode: mode || undefined,
          pendingOnly: pendingOnly || undefined,
          page,
          limit,
        });
        setResult({ data: data.data, total: data.total });
      } catch (error) {
        if (!silent) toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [query, mode, pendingOnly, page]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && selected === null)
        void load(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [load, selected]);

  return (
    <div>
      <form
        className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(keyword.trim());
        }}
      >
        <label className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-2.5 text-slate-400"
          />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên hoặc SĐT ứng viên…"
            aria-label="Tìm hội thoại"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <select
          value={mode}
          onChange={(event) => {
            setPage(1);
            setMode(event.target.value as ConversationControlMode | "");
          }}
          aria-label="Lọc chế độ"
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="">Mọi chế độ</option>
          <option value="AI_ACTIVE">AI đang hỗ trợ</option>
          <option value="HUMAN_TAKEOVER">HR đang xử lý</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
        <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => {
              setPage(1);
              setPendingOnly(event.target.checked);
            }}
          />
          Có tin chờ duyệt
        </label>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Làm mới"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
        >
          <RefreshCw size={14} />
        </button>
      </form>
      {loading && !result ? (
        <LoadingState />
      ) : !result?.data.length ? (
        <EmptyState
          title="Chưa có hội thoại"
          text="Hội thoại Zalo OA với ứng viên sẽ xuất hiện tại đây."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {result.data.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-blue-50/40 focus-visible:bg-blue-50/60 focus-visible:outline-none"
              >
                <Avatar name={item.candidateName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-extrabold text-slate-800">
                      {item.candidateName || `Ứng viên #${item.candidateId}`}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDate(item.lastMessageAt || item.createdAt, true)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {item.jobTitle || "Chưa gắn vị trí"}
                    {item.applicationStatus &&
                      ` · ${
                        STATUS_LABEL[item.applicationStatus] ||
                        item.applicationStatus
                      }`}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {item.lastSenderType && (
                      <span className="font-semibold">
                        {SENDER_LABEL[item.lastSenderType] ||
                          item.lastSenderType}
                        :{" "}
                      </span>
                    )}
                    {item.lastMessagePreview || "Chưa có tin nhắn"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        MODE_TONE[item.controlMode] || MODE_TONE.CLOSED
                      }`}
                    >
                      {CONTROL_MODE_LABEL[item.controlMode] || item.controlMode}
                    </span>
                    {item.pendingApprovals > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {item.pendingApprovals} tin chờ duyệt
                      </span>
                    )}
                    {item.aiPaused && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                        AI tạm dừng
                      </span>
                    )}
                  </div>
                </div>
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
        <ConversationDrawer
          conversationId={selected}
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

type ControlAction = "takeover" | "resume" | "close";

function ConversationDrawer({
  conversationId,
  canManage,
  onClose,
  onChanged,
}: {
  conversationId: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<RecruitmentConversationDetail | null>(
    null
  );
  const [control, setControl] = useState<RecruitmentConversationControl | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState<ControlAction | null>(null);
  // clientMessageId giữ nguyên tới khi gửi thành công → bấm lại không tạo tin trùng.
  const clientMessageId = useRef(newRequestId());
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [messages, state] = await Promise.all([
        recruitmentApi.conversationMessages(conversationId),
        recruitmentApi.conversationControl(conversationId),
      ]);
      setDetail(messages);
      setControl(state);
    } catch (error) {
      toast.error(controlError(error));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [detail?.messages.length]);

  const state = control?.state;
  const closed = state === "CLOSED";
  const human = state === "HUMAN_TAKEOVER";
  const pendingApprovals =
    detail?.messages.filter((m) => m.outboxStatus === "AWAITING_APPROVAL")
      .length ?? 0;

  const act = async (action: ControlAction) => {
    setBusy(true);
    try {
      if (action === "takeover")
        await recruitmentApi.takeoverConversation(conversationId);
      if (action === "resume")
        await recruitmentApi.resumeConversationAi(
          conversationId,
          "HR trả lại AI từ giao diện hội thoại"
        );
      if (action === "close")
        await recruitmentApi.closeConversation(conversationId);
      toast.success(
        action === "takeover"
          ? "HR đã tiếp quản — tin AI chưa gửi bị thu hồi"
          : action === "resume"
          ? "Đã trả hội thoại lại cho AI"
          : "Đã đóng hội thoại"
      );
      setConfirm(null);
      onChanged();
      await load();
    } catch (error) {
      toast.error(controlError(error));
      setConfirm(null);
      if (httpStatus(error) === 409) await load();
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const content = text.trim();
    if (!content || content.length > 2000) return;
    setBusy(true);
    try {
      await recruitmentApi.sendHrMessage(
        conversationId,
        content,
        clientMessageId.current
      );
      clientMessageId.current = newRequestId();
      setText("");
      toast.success("Đã xếp tin vào hàng gửi Zalo");
      onChanged();
      await load();
    } catch (error) {
      toast.error(controlError(error));
    } finally {
      setBusy(false);
    }
  };

  const conversation = detail?.conversation;
  const footer = !canManage ? (
    <p className="flex items-center gap-2 text-xs font-semibold text-blue-800">
      <AlertCircle size={15} /> Chế độ chỉ xem. Thao tác hội thoại thuộc quyền
      Nhân sự.
    </p>
  ) : closed ? (
    <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <Lock size={14} /> Hội thoại đã đóng.
    </p>
  ) : human ? (
    <div className="space-y-2">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nhập tin Nhân sự gửi ứng viên…"
          aria-label="Tin nhắn Nhân sự"
          className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim() || text.trim().length > 2000}
          aria-label="Gửi"
          className="flex w-12 items-center justify-center rounded-xl bg-[#005BEA] text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirm("close")}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"
        >
          Đóng hội thoại
        </button>
        <button
          type="button"
          onClick={() => setConfirm("resume")}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 px-3 text-xs font-bold text-violet-700"
        >
          <Bot size={14} /> Trả lại AI
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => setConfirm("close")}
        className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"
      >
        Đóng hội thoại
      </button>
      <button
        type="button"
        onClick={() => setConfirm("takeover")}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white"
      >
        <Hand size={14} /> Tiếp quản
      </button>
    </div>
  );

  return (
    <DrawerShell
      eyebrow={`Hội thoại Zalo #${conversationId}`}
      title={
        conversation
          ? conversation.candidateName ||
            `Ứng viên #${conversation.candidateId}`
          : "Hội thoại"
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
          <EmptyState
            title="Không tải được hội thoại"
            text="Thử đóng và mở lại."
          />
        )
      ) : (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {state && (
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${
                  MODE_TONE[state] || MODE_TONE.CLOSED
                }`}
              >
                {CONTROL_MODE_LABEL[state] || state}
              </span>
            )}
            <span>{conversation?.jobTitle || "Chưa gắn vị trí"}</span>
            {conversation?.takenOverByName && human && (
              <span>· tiếp quản bởi {conversation.takenOverByName}</span>
            )}
          </div>
          {state === "AI_PAUSED" && (
            <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle size={15} className="shrink-0" />
              AI không trả lời hội thoại này (
              {(control?.pausedBy || [])
                .map((r) => PAUSE_REASON[r] || r)
                .join(", ") || "đang tạm dừng"}
              ). Nhân sự nên tiếp quản.
            </p>
          )}
          {pendingApprovals > 0 && (
            <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle size={15} className="shrink-0" />
              Có {pendingApprovals} tin AI đang chờ duyệt — xử lý ở mục “Duyệt
              tin AI”. Tiếp quản sẽ thu hồi các tin chưa gửi.
            </p>
          )}
          <div className="space-y-3">
            {detail.messages.length ? (
              detail.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">
                Chưa có tin nhắn.
              </p>
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "takeover"
              ? "Tiếp quản hội thoại?"
              : confirm === "resume"
              ? "Trả hội thoại lại cho AI?"
              : "Đóng hội thoại?"
          }
          message={
            confirm === "takeover"
              ? "AI ngừng trả lời; các tin AI chưa gửi (kể cả đang chờ duyệt) bị thu hồi. Nhân sự nhắn trực tiếp cho ứng viên."
              : confirm === "resume"
              ? "AI tiếp tục hỗ trợ ứng viên ở các tin sau. Tin AI vẫn phải được duyệt trước khi gửi."
              : "Không nhận xử lý thêm trong hội thoại này; tin AI chưa gửi bị thu hồi."
          }
          confirmLabel={
            confirm === "takeover"
              ? "Tiếp quản"
              : confirm === "resume"
              ? "Trả lại AI"
              : "Đóng"
          }
          tone={confirm === "close" ? "danger" : "primary"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void act(confirm)}
        />
      )}
    </DrawerShell>
  );
}
