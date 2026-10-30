import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "react-hot-toast";

import { financeApi } from "@/service/finance";
import type { AttachmentKind, FinanceAttachment, FinanceDetail } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { ATTACHMENT_KIND_LABELS, formatBytes, formatDateTime, secondaryButton } from "../lib";
import { Badge, Modal } from "./FinanceUi";

/** Ảnh xem trước tải qua API có kiểm tra quyền (không dùng URL công khai). */
function Thumb({ requestId, attachment }: { requestId: number; attachment: FinanceAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!attachment.mimeType.startsWith("image/")) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    financeApi
      .attachmentBlob(requestId, attachment.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestId, attachment.id, attachment.mimeType]);
  if (url) return <img src={url} alt={attachment.originalName} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
      <FileText size={30} />
      <span className="text-[10px] font-semibold uppercase">{attachment.originalName.split(".").pop()}</span>
    </div>
  );
}

export default function AttachmentGrid({
  detail,
  onChanged,
}: {
  detail: FinanceDetail;
  onChanged: (next?: FinanceDetail) => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AttachmentKind>("DOCUMENT");
  const [itemId, setItemId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ attachment: FinanceAttachment; url: string } | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const perms = detail.permissions;
  const kinds: AttachmentKind[] = [
    ...(perms.canUploadDocuments ? (["DOCUMENT", "INVOICE"] as AttachmentKind[]) : []),
    ...(perms.canUploadPaymentProof ? (["PAYMENT_PROOF", "REFUND_PROOF"] as AttachmentKind[]) : []),
    ...(perms.canCancel ? (["ADJUSTMENT_EVIDENCE"] as AttachmentKind[]) : []),
    ...(perms.requiresPaymentAccount ? (["CONTROL_EVIDENCE"] as AttachmentKind[]) : []),
  ];

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const next = await financeApi.uploadAttachments(detail.id, Array.from(files), {
        kind,
        itemId: itemId ? Number(itemId) : undefined,
      });
      toast.success("Đã tải tệp lên");
      await onChanged(next);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải lên được tệp."));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const open = async (attachment: FinanceAttachment, download = false) => {
    setOpening(attachment.id);
    try {
      const blob = await financeApi.attachmentBlob(detail.id, attachment.id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.originalName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } else {
        setPreview({ attachment, url });
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không mở được tệp."));
    } finally {
      setOpening(null);
    }
  };

  const remove = async (attachment: FinanceAttachment) => {
    if (!window.confirm(`Xoá tệp "${attachment.originalName}"?`)) return;
    try {
      const next = await financeApi.removeAttachment(detail.id, attachment.id);
      toast.success("Đã xoá tệp");
      await onChanged(next);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xoá được tệp."));
    }
  };

  const itemName = (id: number | null) => {
    const item = detail.items.find((i) => i.id === id);
    return item ? `Dòng ${item.lineNo}: ${item.description}` : null;
  };

  return (
    <div className="space-y-4">
      {kinds.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-end">
          <label className="text-xs font-semibold text-slate-600">
            Loại tệp
            <select
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as AttachmentKind)}
            >
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {ATTACHMENT_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          {(kind === "INVOICE" || kind === "DOCUMENT") && detail.items.length > 0 && (
            <label className="flex-1 text-xs font-semibold text-slate-600">
              Gắn với dòng
              <select
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">Cả phiếu</option>
                {detail.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.lineNo}. {item.description}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <button type="button" className={secondaryButton} disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Tải tệp lên
          </button>
        </div>
      )}
      <p className="text-xs text-slate-400">Nhận PDF, JPG, PNG, WEBP, Excel, Word — tối đa 10MB/tệp, 10 tệp mỗi lần.</p>

      {detail.attachments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Chưa có tệp đính kèm.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {detail.attachments.map((attachment) => (
            <div key={attachment.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button type="button" className="block aspect-[4/3] w-full bg-slate-50" onClick={() => void open(attachment)}>
                <Thumb requestId={detail.id} attachment={attachment} />
              </button>
              <div className="space-y-1 p-2.5">
                <p className="truncate text-xs font-semibold text-slate-800" title={attachment.originalName}>
                  {attachment.originalName}
                </p>
                <Badge tone="slate">{ATTACHMENT_KIND_LABELS[attachment.kind]}</Badge>
                {itemName(attachment.itemId) && (
                  <p className="truncate text-[11px] text-slate-500">{itemName(attachment.itemId)}</p>
                )}
                <p className="text-[11px] text-slate-400">
                  {formatBytes(attachment.sizeBytes)} · {attachment.uploadedByName} · {formatDateTime(attachment.createdAt)}
                </p>
                <div className="flex gap-1 pt-1">
                  <button type="button" title="Xem" onClick={() => void open(attachment)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                    {opening === attachment.id ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  </button>
                  <button type="button" title="Tải về" onClick={() => void open(attachment, true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                    <Download size={15} />
                  </button>
                  {attachment.canDelete && (
                    <button type="button" title="Xoá" onClick={() => void remove(attachment)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal
          open
          wide
          title={preview.attachment.originalName}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        >
          {preview.attachment.mimeType.startsWith("image/") ? (
            <img src={preview.url} alt={preview.attachment.originalName} className="mx-auto max-h-[70vh] object-contain" />
          ) : preview.attachment.mimeType === "application/pdf" ? (
            <iframe title={preview.attachment.originalName} src={preview.url} className="h-[70vh] w-full rounded-lg border" />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Không xem trước được định dạng này — dùng nút Tải về.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
