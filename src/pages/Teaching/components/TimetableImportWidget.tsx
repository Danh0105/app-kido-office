import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { ImageUp, MessageCircle, Sparkles, Trash2, X } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { timetableImportApi } from "@/service/teaching";
import type { DraftView } from "@/types/teaching";

import { ConfirmModal } from "./Modal";
import { EmptyState, Loading } from "./Shared";
import TimetableImportChat from "./TimetableImportChat";
import TimetableImportGrid from "./TimetableImportGrid";
import TimetableImportImage from "./TimetableImportImage";
import TimetableImportResult from "./TimetableImportResult";
import TimetableImportSummary, {
  TimetableImportHeader,
} from "./TimetableImportSummary";
import { canManageTeaching } from "../lib";

/**
 * Lỗi vận hành, không phải lỗi thao tác của Nhân sự: chưa cấu hình khoá hoặc
 * khoá sai. Ẩn hẳn ô upload — bấm bao nhiêu lần cũng vậy.
 */
const AI_UNAVAILABLE = new Set([
  "TIMETABLE_AI_NOT_CONFIGURED",
  "TIMETABLE_AI_UNAUTHORIZED",
]);

const errorCodeOf = (error: any): string | undefined =>
  error?.response?.data?.code;

/**
 * Nút chat nổi mount lại ở mỗi trang trong `TeachingLayout` (mỗi trang tự
 * dựng layout riêng, không có route cha giữ state chung) nên bản nháp đang
 * dở phải nhớ qua localStorage thay vì URL như trang cũ.
 */
const DRAFT_STORAGE_KEY = "teaching_timetable_import_draft_id";

const loadStoredDraftId = (): number | null => {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const storeDraftId = (id: number | null) => {
  if (id) localStorage.setItem(DRAFT_STORAGE_KEY, String(id));
  else localStorage.removeItem(DRAFT_STORAGE_KEY);
};

/**
 * "Nhập TKB" bằng ảnh chụp — trước là một trang riêng, giờ là chatbot nổi cố
 * định góc phải dưới màn hình để dùng được ngay từ bất kỳ trang nào trong
 * module Giảng dạy mà không phải rời trang đang xem.
 *
 * Bảng preview vẫn là **chốt chặn duy nhất** giữa một ô đọc sai và hàng chục
 * bản ghi sai trong database, nên khi mở ra vẫn đủ 4 phần như trang cũ: chat,
 * ảnh gốc phóng to, lưới preview cùng hình dạng tờ giấy, và kết quả.
 *
 * FE không validate lại bất cứ điều gì — `blockers` / `needs` / `canCommit`
 * của backend là nguồn sự thật duy nhất.
 */
export default function TimetableImportWidget() {
  const canManage = canManageTeaching();
  const [open, setOpen] = useState(false);
  // Mobile chỉ đủ chỗ cho một cột — chọn đang xem chat hay bản nháp.
  const [pane, setPane] = useState<"chat" | "draft">("chat");
  const [draftId, setDraftId] = useState<number | null>(loadStoredDraftId);

  const [draft, setDraft] = useState<DraftView | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<{
    code?: string;
    message: string;
  } | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [focusToken, setFocusToken] = useState(0);

  // Ảnh gốc chỉ sống trong phiên: backend không lưu file, chỉ lưu phần đọc được.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageReadTokenRef = useRef(0);
  // Bản nháp đã nạp — tránh gọi lại GET ngay sau khi upload xong đã có dữ liệu.
  const loadedIdRef = useRef<number | null>(null);

  const showImage = useCallback((file: File) => {
    const token = ++imageReadTokenRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (
        token === imageReadTokenRef.current &&
        typeof reader.result === "string"
      ) {
        setImageUrl(reader.result);
      }
    };
    reader.onerror = () => {
      if (token === imageReadTokenRef.current) {
        setImageUrl(null);
        toast.error("Không đọc được ảnh đã chọn. Vui lòng chọn ảnh khác.");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => () => void ++imageReadTokenRef.current, []);

  const backToUpload = useCallback(() => {
    setPane("chat");
    loadedIdRef.current = null;
    setDraft(null);
    setDraftId(null);
    storeDraftId(null);
  }, []);

  const reload = useCallback(async (id: number) => {
    try {
      const res = await timetableImportApi.findOne(id);
      loadedIdRef.current = id;
      setDraft(res);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải lại được bản nháp"));
      }
    }
  }, []);

  /** Mở lại widget vẫn khôi phục đúng bản nháp nhờ draftId nhớ trong localStorage. */
  useEffect(() => {
    if (!open || !draftId) return;
    if (loadedIdRef.current === draftId) return;

    let alive = true;
    setLoading(true);
    timetableImportApi
      .findOne(draftId)
      .then((res) => {
        if (!alive) return;
        loadedIdRef.current = draftId;
        setDraft(res);
      })
      .catch((error: any) => {
        if (!alive) return;
        const status = error?.response?.status;
        if (status === 404) {
          toast.error(
            getApiErrorMessage(error, "Không tìm thấy bản nháp thời khoá biểu"),
          );
          backToUpload();
          return;
        }
        if (status !== 403) {
          toast.error(getApiErrorMessage(error, "Không tải được bản nháp"));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, draftId, backToUpload]);

  /** Lỗi chung của các thao tác trên một bản nháp đang mở. */
  const handleDraftError = useCallback(
    async (error: any, fallback: string) => {
      const status = error?.response?.status;

      if (status === 404) {
        toast.error(getApiErrorMessage(error, "Bản nháp không còn tồn tại"));
        backToUpload();
        return;
      }

      // Bản nháp đã chốt ở tab khác / lần bấm khác → nạp lại đúng trạng thái,
      // không tạo thêm lần nữa.
      if (status === 409 && draftId) {
        toast.error(getApiErrorMessage(error, "Bản nháp đã được chốt"));
        await reload(draftId);
        return;
      }

      if (status !== 403) toast.error(getApiErrorMessage(error, fallback));
    },
    [backToUpload, draftId, reload],
  );

  const upload = async (file: File) => {
    if (uploading) return;

    setUploading(true);
    setUploadError(null);
    showImage(file);

    try {
      const res = await timetableImportApi.create({ image: file });
      loadedIdRef.current = res.draftId;
      setDraft(res);
      setDraftId(res.draftId);
      storeDraftId(res.draftId);
    } catch (error: any) {
      const code = errorCodeOf(error);
      const message = getApiErrorMessage(
        error,
        "Không đọc được ảnh thời khoá biểu",
      );
      if (code && AI_UNAVAILABLE.has(code)) setUnavailable(message);
      else if (error?.response?.status !== 403) {
        setUploadError({ code, message });
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Chưa có bản nháp mà gõ mô tả (không đính kèm ảnh) — backend tự tạo bản
   * nháp trống rồi chat luôn từ câu này, không cần bước đọc ảnh nào cả.
   */
  const startFromText = async (text: string) => {
    if (uploading) return;

    setUploading(true);
    setUploadError(null);

    try {
      const res = await timetableImportApi.create({ message: text });
      loadedIdRef.current = res.draftId;
      setDraft(res);
      setDraftId(res.draftId);
      storeDraftId(res.draftId);
    } catch (error: any) {
      const code = errorCodeOf(error);
      const message = getApiErrorMessage(error, "Không xử lý được yêu cầu");
      if (code && AI_UNAVAILABLE.has(code)) setUnavailable(message);
      else if (error?.response?.status !== 403) {
        setUploadError({ code, message });
      }
    } finally {
      setUploading(false);
    }
  };

  const send = async (text: string) => {
    if (!draft || sending) return;
    setSending(true);
    try {
      setDraft(await timetableImportApi.chat(draft.draftId, text));
    } catch (error: any) {
      await handleDraftError(error, "Không gửi được tin nhắn");
    } finally {
      setSending(false);
    }
  };

  const commit = async () => {
    if (!draft || committing) return;
    setConfirmOpen(false);
    setCommitting(true);

    try {
      const res = await timetableImportApi.commit(draft.draftId);
      setDraft(res);
      toast.success("Đã tạo lớp và mẫu lịch");
    } catch (error: any) {
      if (errorCodeOf(error) === "TIMETABLE_DRAFT_INCOMPLETE") {
        toast.error(
          getApiErrorMessage(error, "Bản nháp còn thiếu thông tin"),
        );
        // Backend trả chính blockers + needs vừa chặn commit trong body lỗi.
        // Áp ngay vào preview để người dùng thấy lý do mà không phụ thuộc một
        // GET kế tiếp; chỉ reload làm phương án dự phòng cho backend cũ.
        const errorData = error?.response?.data;
        const hasPreviewDetails =
          Array.isArray(errorData?.blockers) || Array.isArray(errorData?.needs);

        if (hasPreviewDetails) {
          setDraft((current) =>
            current
              ? {
                  ...current,
                  preview: {
                    ...current.preview,
                    blockers: Array.isArray(errorData.blockers)
                      ? errorData.blockers
                      : current.preview.blockers,
                    needs: Array.isArray(errorData.needs)
                      ? errorData.needs
                      : current.preview.needs,
                    canCommit: false,
                  },
                }
              : current,
          );
        } else {
          await reload(draft.draftId);
        }
        setFocusToken((value) => value + 1);
        return;
      }
      await handleDraftError(error, "Xác nhận thất bại");
    } finally {
      setCommitting(false);
    }
  };

  const requestCommit = () => {
    if (!draft?.preview.canCommit) return;
    // Còn cảnh báo mà vẫn commit được → hỏi lại một lần nữa, liệt kê rõ.
    if (draft.preview.warnings.length > 0) setConfirmOpen(true);
    else commit();
  };

  const cancelDraft = async () => {
    if (!draft || cancelling) return;
    setCancelling(true);
    try {
      await timetableImportApi.cancel(draft.draftId);
      setCancelOpen(false);
      toast.success("Đã huỷ bản nháp");
      backToUpload();
    } catch (error: any) {
      setCancelOpen(false);
      await handleDraftError(error, "Huỷ bản nháp thất bại");
    } finally {
      setCancelling(false);
    }
  };

  // Màn này ghi dữ liệu nên chỉ nhansu/giaovu — role chỉ-xem không thấy nút.
  // Đặt sau mọi hook để thứ tự hook luôn cố định giữa các lần render.
  if (!canManage) return null;

  const isDraft = draft?.status === "DRAFT";

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Nhập thời khoá biểu bằng ảnh"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 transition hover:shadow-xl active:scale-95 lg:bottom-6 lg:right-6"
        >
          <MessageCircle size={24} />
          {draftId && (
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-white" />
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center md:p-4">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:h-[88vh] md:max-h-[820px] md:w-[1120px] md:max-w-[96vw] md:rounded-2xl">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white md:rounded-t-2xl">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold leading-tight">
                    Trợ lý xếp lịch
                  </h2>
                  <p className="truncate text-[11px] leading-tight text-blue-100">
                    Ra lệnh bằng lời hoặc gửi ảnh thời khoá biểu
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Mobile không đủ chỗ cho 2 cột: đổi qua lại giữa chat và bản nháp. */}
                {draft && (
                  <div className="flex rounded-full bg-white/15 p-0.5 text-[11px] font-medium md:hidden">
                    {(
                      [
                        ["chat", "Trò chuyện"],
                        ["draft", "Bản nháp"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setPane(value)}
                        className={`rounded-full px-2.5 py-1 transition ${
                          pane === value ? "bg-white text-blue-600" : "text-white/90"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15 active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {unavailable ? (
              <div className="flex-1 overflow-y-auto p-4">
                <EmptyState
                  icon="🔌"
                  title="Chức năng đọc ảnh chưa sẵn sàng"
                  description={`${unavailable} Đây là lỗi cấu hình phía hệ thống, không phải thao tác của bạn — báo bộ phận kỹ thuật. Trong lúc chờ, vẫn xếp lịch tay được ở màn Thời khóa biểu.`}
                />
              </div>
            ) : loading ? (
              <div className="flex-1 p-4">
                <Loading label="Đang tải bản nháp…" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1">
                {/* Cột chính: cuộc trò chuyện, ô nhập luôn ghim đáy khung. */}
                <div
                  className={`min-w-0 flex-1 flex-col ${
                    draft && pane === "draft" ? "hidden md:flex" : "flex"
                  }`}
                >
                  <TimetableImportChat
                    key={draft ? draft.draftId : "new"}
                    fill
                    hasDraft={!!draft && isDraft}
                    messages={draft?.messages ?? []}
                    needs={draft?.preview.needs ?? []}
                    blockerCount={draft?.preview.blockers.length ?? 0}
                    sending={draft ? sending : uploading}
                    uploadError={draft ? null : uploadError}
                    focusToken={focusToken}
                    onSendText={draft ? send : startFromText}
                    onSendImage={draft ? undefined : upload}
                  />
                </div>

                {/* Cột phụ: bản nháp đang dựng — chốt chặn trước khi ghi dữ liệu. */}
                {draft && (
                  <aside
                    className={`min-w-0 flex-col border-gray-200 bg-gray-50/70 md:flex md:w-[500px] md:shrink-0 md:border-l ${
                      pane === "draft" ? "flex flex-1" : "hidden"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
                      <StatusChip status={draft.status} />
                      <span className="text-xs text-gray-400">
                        Bản nháp #{draft.draftId}
                      </span>

                      <div className="ml-auto flex gap-2">
                        {isDraft && (
                          <button
                            onClick={() => setCancelOpen(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 active:scale-95"
                          >
                            <Trash2 size={13} /> Huỷ
                          </button>
                        )}
                        <button
                          onClick={backToUpload}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 active:scale-95"
                        >
                          <ImageUp size={13} /> Bắt đầu lại
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                      {draft.status === "COMMITTED" && (
                        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                          Bản nháp đã được chốt — dữ liệu đã tạo xong, chỉ còn
                          để xem lại.
                        </p>
                      )}

                      {draft.status === "CANCELLED" && (
                        <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          Bản nháp này đã huỷ, không tạo dữ liệu nào.
                        </p>
                      )}

                      {imageUrl && (
                        <TimetableImportImage url={imageUrl} onPick={showImage} />
                      )}

                      <TimetableImportHeader preview={draft.preview} />
                      <TimetableImportGrid preview={draft.preview} />

                      {isDraft && (
                        <TimetableImportSummary
                          hideCommit
                          preview={draft.preview}
                          committing={committing}
                          onCommit={requestCommit}
                        />
                      )}

                      {!isDraft && draft.commitResult && (
                        <TimetableImportResult
                          result={draft.commitResult}
                          resolution={draft.preview.resolution}
                        />
                      )}
                    </div>

                    {/* Nút xác nhận ghim đáy — không phải cuộn xuống tìm. */}
                    {isDraft && (
                      <div className="shrink-0 border-t border-gray-200 bg-white p-3">
                        <button
                          onClick={requestCommit}
                          disabled={!draft.preview.canCommit || committing}
                          title={commitBlockReason(draft) || undefined}
                          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
                        >
                          {committing
                            ? "Đang tạo…"
                            : `Xác nhận · ${draft.preview.scheduleCount} lịch`}
                        </button>
                        {!draft.preview.canCommit && commitBlockReason(draft) && (
                          <p className="mt-1.5 text-center text-[11px] leading-relaxed text-gray-500">
                            Chưa xác nhận được: {commitBlockReason(draft)}
                          </p>
                        )}
                      </div>
                    )}
                  </aside>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmOpen && draft && (
        <ConfirmModal
          title="Xác nhận tạo lớp và lịch"
          submitLabel="Vẫn tạo"
          submitColor="bg-emerald-600"
          loading={committing}
          onClose={() => setConfirmOpen(false)}
          onSubmit={commit}
          message={
            <>
              Sẽ tạo <b>{draft.preview.newClassNames.length}</b> lớp mới và{" "}
              <b>{draft.preview.scheduleCount}</b> mẫu lịch. Còn{" "}
              {draft.preview.warnings.length} cảnh báo chưa xử lý:
            </>
          }
          hint={
            <ul className="list-disc space-y-1 pl-4">
              {draft.preview.warnings.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          }
        />
      )}

      {cancelOpen && (
        <ConfirmModal
          title="Huỷ bản nháp"
          message="Bỏ toàn bộ kết quả đọc ảnh của bản nháp này? Chưa có dữ liệu nào được tạo nên không ảnh hưởng lịch dạy hiện có."
          submitLabel="Huỷ bản nháp"
          loading={cancelling}
          onClose={() => setCancelOpen(false)}
          onSubmit={cancelDraft}
        />
      )}
    </>
  );
}

/** Lý do nút xác nhận đang tắt — backend là nguồn sự thật, FE chỉ hiện lại. */
const commitBlockReason = (draft: DraftView): string =>
  draft.preview.blockers[0]?.message ?? draft.preview.needs[0]?.question ?? "";

function StatusChip({ status }: { status: DraftView["status"] }) {
  const meta = {
    DRAFT: { label: "Bản nháp", style: "bg-amber-100 text-amber-700" },
    COMMITTED: { label: "Đã tạo dữ liệu", style: "bg-emerald-100 text-emerald-700" },
    CANCELLED: { label: "Đã huỷ", style: "bg-gray-100 text-gray-500" },
  }[status];

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.style}`}
    >
      {meta.label}
    </span>
  );
}
