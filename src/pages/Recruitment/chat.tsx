import { Bot, UserRound, UsersRound } from "lucide-react";

import type { RecruitmentChatMessage } from "@/service/recruitment";

import {
  APPROVAL_STATE_LABEL,
  OUTBOX_STATUS_LABEL,
  SENDER_LABEL,
  formatDate,
} from "./shared";

/** Trạng thái gửi / duyệt của một tin đi (AI hoặc HR). */
export function deliveryLabel(message: RecruitmentChatMessage): {
  text: string;
  tone: string;
} | null {
  if (message.direction !== "OUTBOUND") return null;
  if (message.outboxStatus === "AWAITING_APPROVAL")
    return { text: "Chờ HR duyệt", tone: "bg-amber-50 text-amber-700" };
  if (message.outboxStatus === "SENT")
    return { text: "Đã gửi Zalo", tone: "bg-emerald-50 text-emerald-700" };
  if (
    message.outboxStatus === "SUPPRESSED" ||
    message.delivery?.startsWith("SUPPRESSED")
  )
    return {
      text:
        message.approvalState && message.approvalState !== "APPROVED"
          ? APPROVAL_STATE_LABEL[message.approvalState] || "Không gửi"
          : "Không gửi",
      tone: "bg-slate-100 text-slate-500",
    };
  if (
    message.outboxStatus === "UNKNOWN" ||
    message.outboxStatus === "DEAD_LETTER"
  )
    return {
      text: OUTBOX_STATUS_LABEL[message.outboxStatus],
      tone: "bg-rose-50 text-rose-700",
    };
  if (message.outboxStatus)
    return {
      text: OUTBOX_STATUS_LABEL[message.outboxStatus] || message.outboxStatus,
      tone: "bg-blue-50 text-[#005BEA]",
    };
  return null;
}

const STYLE: Record<
  string,
  { align: string; bubble: string; icon: typeof Bot }
> = {
  CANDIDATE: {
    align: "justify-start",
    bubble: "bg-white border border-slate-200 text-slate-700",
    icon: UserRound,
  },
  AI: {
    align: "justify-end",
    bubble: "bg-violet-50 border border-violet-100 text-slate-800",
    icon: Bot,
  },
  HR: {
    align: "justify-end",
    bubble: "bg-[#005BEA] text-white",
    icon: UsersRound,
  },
  SYSTEM: {
    align: "justify-center",
    bubble: "bg-slate-100 text-slate-500",
    icon: Bot,
  },
};

export function MessageBubble({
  message,
  highlight = false,
}: {
  message: RecruitmentChatMessage;
  highlight?: boolean;
}) {
  const style = STYLE[message.senderType] || STYLE.SYSTEM;
  const Icon = style.icon;
  const status = deliveryLabel(message);
  return (
    <div className={`flex ${style.align}`}>
      <div className="max-w-[85%]">
        <div
          className={`whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${
            style.bubble
          } ${highlight ? "ring-2 ring-amber-300" : ""}`}
        >
          {message.content || (
            <span className="italic opacity-70">(nội dung đã được xoá)</span>
          )}
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 ${
            message.senderType === "CANDIDATE" ? "" : "justify-end"
          }`}
        >
          <Icon size={11} />
          <span className="font-semibold">
            {message.senderType === "HR" && message.authorName
              ? message.authorName
              : SENDER_LABEL[message.senderType] || message.senderType}
          </span>
          <span>· {formatDate(message.createdAt, true)}</span>
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${status.tone}`}
            >
              {status.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
