import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Paperclip,
  RotateCw,
  SendHorizontal,
  Sparkles,
  User,
  X,
} from "lucide-react";

import {
  TIMETABLE_IMAGE_MAX_BYTES,
  TIMETABLE_IMAGE_MIME_TYPES,
  TIMETABLE_MESSAGE_MAX_LENGTH,
  type DraftMessage,
  type PreviewNeed,
} from "@/types/teaching";

const ACCEPT = TIMETABLE_IMAGE_MIME_TYPES.join(",");

const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Chặn ngay ở client những gì backend chắc chắn từ chối — gửi 20 MB lên rồi mới
 * nhận 413 là bắt Nhân sự chờ vô ích trên mạng 3G của trường.
 */
export const checkImageFile = (file: File): string | null => {
  if (!TIMETABLE_IMAGE_MIME_TYPES.includes(file.type)) {
    return "Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF.";
  }
  if (file.size > TIMETABLE_IMAGE_MAX_BYTES) {
    return `Ảnh ${formatMB(file.size)} — vượt quá mức cho phép ${formatMB(
      TIMETABLE_IMAGE_MAX_BYTES,
    )}. Chụp lại ở độ phân giải thấp hơn hoặc cắt bớt phần thừa.`;
  }
  return null;
};

/** Gợi ý riêng cho từng mã lỗi của backend — `message` của BE vẫn hiện nguyên văn. */
const ERROR_HINTS: Record<string, string> = {
  TIMETABLE_AI_RATE_LIMITED:
    "Hệ thống đang bận. Chờ một chút rồi bấm Thử lại — ảnh vẫn được giữ nguyên.",
  TIMETABLE_AI_TRUNCATED:
    "Tờ thời khoá biểu quá dài nên đọc không hết. Cắt ảnh thành 2–3 phần nhỏ (theo nhóm thứ) rồi gửi từng phần.",
  TIMETABLE_AI_REFUSED: "Chụp lại rõ hơn, đủ sáng và thẳng góc với tờ giấy.",
  TIMETABLE_AI_EMPTY: "Chụp lại rõ hơn, đủ sáng và thẳng góc với tờ giấy.",
  TIMETABLE_AI_INVALID: "Chụp lại rõ hơn, đủ sáng và thẳng góc với tờ giấy.",
  TIMETABLE_AI_ERROR: "Chụp lại rõ hơn, đủ sáng và thẳng góc với tờ giấy.",
  TIMETABLE_IMAGE_TOO_LARGE: "Chụp lại ở độ phân giải thấp hơn.",
  TIMETABLE_IMAGE_INVALID: "File ảnh có thể đã hỏng — chọn ảnh khác.",
};

/** Mã lỗi cho phép gửi lại đúng tấm ảnh đó, không cần chọn lại file. */
const RETRYABLE = new Set([
  "TIMETABLE_AI_RATE_LIMITED",
  "TIMETABLE_AI_ERROR",
  "TIMETABLE_AI_EMPTY",
]);

/** Nhãn ngắn của từng mục còn thiếu — câu hỏi đầy đủ do backend viết sẵn. */
const NEED_LABELS: Record<PreviewNeed["field"], string> = {
  schoolId: "Trường",
  schoolYear: "Năm học",
  subjectId: "Môn",
  teacherId: "Giáo viên",
  effectiveFrom: "Áp dụng từ",
  effectiveTo: "Áp dụng đến",
  periodTimes: "Khung giờ",
};

/**
 * Câu trả lời có sẵn cho mục backend không kèm `options`. Chỉ là chữ điền hộ
 * vào ô nhập — vẫn đi qua đúng đường chat, không phải luật riêng của FE.
 */
const QUICK_REPLIES: Partial<Record<PreviewNeed["field"], string[]>> = {
  effectiveTo: ["Không giới hạn"],
};

/** Mẫu câu gợi ý ở màn hình bắt đầu — bấm để điền thẳng vào ô nhập, không tự gửi. */
const EXAMPLE_PROMPTS = [
  "Cô Hồng dạy Toán 1A, thứ 3 tiết 1",
  "Thầy Nam dạy Tin học 4B, thứ 5 tiết 2",
];

/**
 * Khung chat **duy nhất** của màn Nhập TKB — hiện ngay từ đầu, giống ô chat
 * của ChatGPT: chưa có bản nháp thì đính kèm ảnh ngay trong ô nhập để bắt đầu;
 * có bản nháp rồi thì trở thành ô trả lời các mục còn thiếu (không đính kèm
 * ảnh được nữa — backend chỉ đọc đúng 1 ảnh lúc tạo bản nháp).
 */
export default function TimetableImportChat({
  hasDraft,
  fill = false,
  messages,
  needs,
  blockerCount,
  sending,
  uploadError,
  focusToken,
  onSendText,
  onSendImage,
}: {
  hasDraft: boolean;
  /**
   * true khi khung chat là cột chính của widget: cao bằng khung, danh sách tin
   * nhắn tự co giãn và ô nhập luôn ghim đáy — dùng như đang chat với trợ lý,
   * không phải một hộp nhỏ nhét giữa các khối khác.
   */
  fill?: boolean;
  messages: DraftMessage[];
  needs: PreviewNeed[];
  /**
   * Số lỗi đang chặn xác nhận. Hết `needs` chưa chắc đã xong: lỗi kiểu đọc lệch
   * hàng (SLOT_COLLISION) không có mục nào để điền, nói "đã đủ thông tin" lúc
   * đó là dắt Nhân sự tới cái nút đang tắt.
   */
  blockerCount: number;
  /** true khi đang đọc ảnh (chưa có draft) hoặc đang gửi tin nhắn (đã có draft). */
  sending: boolean;
  /** Lỗi lần đọc ảnh trước — chỉ có ý nghĩa khi chưa có draft. */
  uploadError?: { code?: string; message: string } | null;
  /** Tăng giá trị này để kéo con trỏ về ô nhập (sau khi commit bị chặn). */
  focusToken?: number;
  /**
   * Gửi tin nhắn văn bản — dùng cả khi chưa có draft (mô tả lịch cần xếp,
   * backend tự tạo bản nháp trống rồi chat luôn từ câu này) lẫn khi đã có
   * draft (bổ sung/sửa thông tin còn thiếu).
   */
  onSendText?: (text: string) => void;
  /** Tạo draft từ ảnh — chỉ dùng khi chưa có draft. */
  onSendImage?: (file: File) => void;
}) {
  const [text, setText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, sending]);

  useEffect(() => {
    if (!focusToken) return;
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusToken]);

  // Data URL hoạt động ổn định cả trên browser lẫn Capacitor WebView.
  useEffect(() => {
    if (!attachedFile) {
      setAttachedPreview(null);
      return;
    }
    let alive = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (alive && typeof reader.result === "string") {
        setAttachedPreview(reader.result);
      }
    };
    reader.onerror = () => {
      if (alive) {
        setAttachedPreview(null);
        setAttachError("Không đọc được ảnh đã chọn. Vui lòng chọn ảnh khác.");
      }
    };
    reader.readAsDataURL(attachedFile);
    return () => {
      alive = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [attachedFile]);

  const pickImage = (picked?: File | null) => {
    if (!picked) return;
    const message = checkImageFile(picked);
    setAttachError(message);
    setAttachedFile(message ? null : picked);
  };

  const canRetryImage =
    !!uploadError?.code && RETRYABLE.has(uploadError.code) && !!attachedFile;

  const sendText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    onSendText?.(trimmed.slice(0, TIMETABLE_MESSAGE_MAX_LENGTH));
    setText("");
  };

  const sendImage = () => {
    if (!attachedFile || sending) return;
    onSendImage?.(attachedFile);
  };

  const handleSend = () => {
    // Có ảnh đính kèm thì gửi ảnh trước — gộp ảnh + mô tả trong một lần gửi
    // chưa hỗ trợ, đơn giản hoá bằng cách ưu tiên ảnh, mô tả thêm nói sau khi
    // đã có bản nháp.
    if (!hasDraft && attachedFile) {
      sendImage();
      return;
    }
    sendText(text);
  };

  const canSend = hasDraft
    ? !!text.trim()
    : !!attachedFile || !!text.trim();

  return (
    <div
      className={
        fill
          ? "flex h-full min-h-0 flex-col bg-white"
          : "flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      }
    >
      {!fill && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3.5 py-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Sparkles size={13} />
          </div>
          <span className="text-xs font-semibold text-gray-700">
            {hasDraft ? "Bổ sung thông tin" : "Nhập thời khoá biểu"}
          </span>
        </div>
      )}

      <div
        ref={listRef}
        className={`space-y-3 overflow-y-auto bg-gradient-to-b from-gray-50/60 to-white px-3 py-3 ${
          fill ? "min-h-0 flex-1 md:px-5 md:py-4" : "max-h-72 min-h-[10rem]"
        }`}
      >
        {!hasDraft && messages.length === 0 && !sending && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-blue-100 bg-blue-50/40 px-4 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Mô tả lịch cần xếp
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                Gõ thành lời hoặc đính kèm ảnh chụp thời khoá biểu (
                <Paperclip size={11} className="inline -mt-0.5" />) để đọc
                hàng loạt — tờ dài thì cắt thành vài phần, gửi từng phần.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setText(prompt);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasDraft && messages.length === 0 && (
          <p className="py-4 text-center text-xs leading-relaxed text-gray-400">
            Ảnh chụp hiếm khi đủ thông tin. Trả lời các mục bên dưới để hoàn
            thiện bản nháp.
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.at}-${index}`}
            className={`flex items-end gap-2 ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                message.role === "user"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {message.role === "user" ? (
                <User size={12} />
              ) : (
                <Bot size={12} />
              )}
            </div>
            <p
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "rounded-br-sm bg-blue-500 text-white"
                  : "rounded-bl-sm border border-gray-100 bg-white text-gray-700"
              }`}
            >
              {message.text}
            </p>
          </div>
        ))}

        {/* Đang đọc ảnh (chưa có draft): hiện lại ảnh vừa "gửi" + trạng thái xử lý. */}
        {!hasDraft && sending && (
          <>
            {attachedPreview && (
              <div className="flex justify-end">
                <img
                  src={attachedPreview}
                  alt="Ảnh đã gửi"
                  className="max-h-40 max-w-[70%] rounded-2xl rounded-br-sm object-contain shadow-sm"
                />
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Bot size={12} />
              </div>
              <p className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm">
                <Loader2 size={13} className="animate-spin text-blue-500" />{" "}
                Đang đọc ảnh, mất khoảng 30 giây… đừng đóng trang.
              </p>
            </div>
          </>
        )}

        {/* Lỗi đọc ảnh lần trước (chưa có draft). */}
        {!hasDraft && !sending && uploadError && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p className="font-medium">{uploadError.message}</p>
              {uploadError.code && ERROR_HINTS[uploadError.code] && (
                <p className="mt-1 leading-relaxed text-red-500">
                  {ERROR_HINTS[uploadError.code]}
                </p>
              )}
              {canRetryImage && (
                <button
                  onClick={sendImage}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 active:scale-95"
                >
                  <RotateCw size={12} /> Thử lại đúng ảnh này
                </button>
              )}
            </div>
          </div>
        )}

        {sending && hasDraft && (
          <div className="flex items-end gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <Bot size={12} />
            </div>
            <p className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-3 py-2 text-xs text-gray-400 shadow-sm">
              <Loader2 size={13} className="animate-spin text-blue-500" />{" "}
              Đang xử lý…
            </p>
          </div>
        )}

        {hasDraft &&
          (needs.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                <AlertTriangle size={12} /> Còn thiếu {needs.length} mục
              </p>

              {needs.map((need) => (
                <div
                  key={need.field}
                  className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 shadow-sm"
                >
                  <p className="text-[10px] font-semibold uppercase text-amber-600">
                    {NEED_LABELS[need.field] ?? need.field}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-700">
                    {need.question}
                  </p>

                  {(need.options?.length || QUICK_REPLIES[need.field]) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {need.options?.map((option) => (
                        <button
                          key={option.id}
                          disabled={sending}
                          onClick={() => sendText(option.name)}
                          title={option.hint}
                          className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 active:scale-95 disabled:opacity-50"
                        >
                          {option.name}
                          {option.hint && (
                            <span className="ml-1 font-normal text-gray-400">
                              {option.hint}
                            </span>
                          )}
                        </button>
                      ))}

                      {QUICK_REPLIES[need.field]?.map((reply) => (
                        <button
                          key={reply}
                          disabled={sending}
                          onClick={() => sendText(reply)}
                          className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 active:scale-95 disabled:opacity-50"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : blockerCount > 0 ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              Không còn mục nào để điền, nhưng còn {blockerCount} lỗi chặn xác
              nhận — xem bảng nháp. Sửa bằng cách mô tả lại ở đây.
            </p>
          ) : (
            <p className="flex items-start gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 size={14} className="mt-px shrink-0" />
              Đã đủ thông tin — kiểm lại bảng nháp rồi bấm Xác nhận.
            </p>
          ))}
      </div>

      <div
        className={`shrink-0 border-t border-gray-100 bg-white p-3 ${
          fill ? "md:px-5 md:pb-4" : ""
        }`}
      >
        {/* Ảnh đã đính kèm, chưa gửi (chỉ áp dụng khi chưa có draft). */}
        {!hasDraft && attachedFile && !sending && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-2 py-1.5 shadow-sm">
            {attachedPreview && (
              <img
                src={attachedPreview}
                alt="Ảnh đã chọn"
                className="h-10 w-10 shrink-0 rounded-lg border border-white object-cover shadow-sm"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-600">
              {attachedFile.name} · {formatMB(attachedFile.size)}
            </span>
            <button
              type="button"
              onClick={() => {
                setAttachedFile(null);
                setAttachError(null);
              }}
              aria-label="Bỏ ảnh đã chọn"
              className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!hasDraft && attachError && (
          <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
            {attachError}
          </p>
        )}

        <div className="flex items-end gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
          {!hasDraft && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  pickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Đính kèm ảnh"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 active:scale-95 disabled:opacity-40"
              >
                <Paperclip size={16} />
              </button>
            </>
          )}

          {/* Đã đính kèm ảnh (chưa có draft): gửi ảnh, không gộp thêm mô tả trong cùng lượt này. */}
          {!hasDraft && attachedFile ? (
            <div className="flex-1 px-1.5 py-2 text-left text-xs text-gray-400">
              Đã đính kèm ảnh — bấm gửi để đọc
            </div>
          ) : (
            <textarea
              ref={inputRef}
              rows={fill ? 3 : 2}
              value={text}
              maxLength={TIMETABLE_MESSAGE_MAX_LENGTH}
              disabled={sending}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                hasDraft
                  ? "VD: cô Lê Thị Hồng Diễm dạy, chiều tiết 1 từ 13:30, mỗi tiết 40 phút, áp dụng đến 31/05/2026"
                  : "VD: xếp cô Hồng dạy lớp 1A môn Toán thứ 3 tiết 1, từ tuần sau"
              }
              className="flex-1 resize-none bg-transparent px-1.5 py-2 text-xs text-gray-700 md:text-[13px] placeholder:text-gray-400 focus:outline-none disabled:text-gray-400"
            />
          )}

          <button
            onClick={handleSend}
            disabled={sending || !canSend}
            aria-label="Gửi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition hover:bg-blue-600 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            <SendHorizontal size={15} />
          </button>
        </div>

        <p className="mt-1.5 text-[10px] text-gray-400">
          {hasDraft
            ? "Trả lời nhiều mục trong một câu cũng được. Muốn sửa một ô đọc sai thì ra lệnh ở đây — không sửa trực tiếp trên lưới."
            : `Ảnh: JPEG, PNG, WebP, GIF · tối đa ${formatMB(TIMETABLE_IMAGE_MAX_BYTES)}.`}
        </p>
      </div>
    </div>
  );
}
